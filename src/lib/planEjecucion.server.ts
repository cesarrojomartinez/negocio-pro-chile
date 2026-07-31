/**
 * Construcción y gobierno del plan de ejecución en el SERVIDOR.
 *
 * Regla central de esta etapa: ninguna sincronización real puede llamar al
 * proveedor sin que el servidor haya construido el plan con datos persistidos,
 * validado la caché, los límites, el presupuesto y los permisos.
 *
 * Nunca recibe, guarda ni registra la Clave Tributaria. El plan persistido solo
 * contiene periodos, recursos, cupos y cifras.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ErrorNegocio, exigirRol } from "@/lib/companies.server";
import { normalizarPeriodo } from "@/lib/periodo";
import {
  CODIGO_GUARDA_CREDITOS,
  ControlPlanEjecucion,
  construirPlanEjecucion,
  resumenPlanVsReal,
  verificarLimitesPlan,
  type EstadoPeriodoConocido,
  type SyncExecutionPlan,
} from "@/lib/syncPlan";
import { evaluarPresupuesto } from "@/lib/syncPreferences";
import { obtenerPreferenciasSync } from "@/lib/syncPreferences.server";

/** Un periodo cuyo mes calendario ya terminó. Misma regla del orquestador. */
function periodoYaCerrado(periodo: string, ahora: Date): boolean {
  const [anio, mes] = periodo.split("-").map(Number);
  return ahora.getTime() >= Date.UTC(anio, mes, 1);
}

/** Folio interno con el que se anota un fallo de descarga del PDF. */
function folioFalloDescarga(periodo: string): string {
  return `descarga-fallida:${periodo}`;
}

/**
 * Lee de la BASE DE DATOS todo lo que el plan necesita saber de un periodo.
 * No consulta al proveedor ni consume créditos.
 */
export async function construirEstadosPeriodos(
  companyId: string,
  periodos: string[],
  ahora: Date,
): Promise<EstadoPeriodoConocido[]> {
  const estados: EstadoPeriodoConocido[] = [];

  for (const periodo of periodos) {
    const { data: periodoFila } = await supabaseAdmin
      .from("tax_periods")
      .select("id")
      .eq("company_id", companyId)
      .eq("period", periodo)
      .maybeSingle();
    const periodId = periodoFila ? String(periodoFila.id) : null;

    const [ultima, f29, documentos, snapshots, extracciones] = await Promise.all([
      periodId
        ? supabaseAdmin
            .from("tax_sync_runs")
            .select("completed_at")
            .eq("company_id", companyId)
            .eq("tax_period_id", periodId)
            .eq("status", "success")
            .not("completed_at", "is", null)
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from("tax_f29_extractions")
        .select("folio, extraction_status, pdf_storage_path, pdf_sha256")
        .eq("company_id", companyId)
        .eq("period", periodo)
        .eq("superseded", false)
        .in("extraction_status", ["success", "needs_review", "partial"])
        .limit(1)
        .maybeSingle(),
      periodId
        ? supabaseAdmin
            .from("tax_documents")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("tax_period_id", periodId)
        : Promise.resolve({ count: 0 }),
      periodId
        ? supabaseAdmin
            .from("tax_provider_snapshots")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("tax_period_id", periodId)
            .in("module", ["rcv_sales_documents", "rcv_purchases_registered"])
        : Promise.resolve({ count: 0 }),
      supabaseAdmin
        .from("tax_f29_extractions")
        .select("folio, extraction_status, pdf_storage_path, updated_at, created_at")
        .eq("company_id", companyId)
        .eq("period", periodo),
    ]);

    const filas = (extracciones.data ?? []) as Array<Record<string, unknown>>;
    const fallo = filas.find((f) => String(f.folio) === folioFalloDescarga(periodo));
    const pdfGuardadoPendienteDeLectura = filas.some(
      (f) =>
        !!f.pdf_storage_path &&
        !["success", "needs_review", "partial"].includes(String(f.extraction_status)),
    );

    estados.push({
      periodo,
      ultimaSincronizacionRcv:
        ((ultima as { data: { completed_at?: string } | null }).data?.completed_at as
          | string
          | undefined) ?? null,
      tieneDatosRcv:
        (((documentos as { count?: number }).count ?? 0) > 0) ||
        (((snapshots as { count?: number }).count ?? 0) > 0),
      tieneF29Vigente: !!f29.data,
      periodoCerrado: periodoYaCerrado(periodo, ahora),
      folioConocido: f29.data ? String((f29.data as { folio: unknown }).folio) : null,
      ultimoFalloDescargaF29: fallo
        ? String(fallo.updated_at ?? fallo.created_at ?? "") || null
        : null,
      pdfGuardadoPendienteDeLectura,
    });
  }

  return estados;
}

/* ------------------------------ Bloqueo ------------------------------ */

export interface BloqueoSync {
  id: string;
  reutilizado: boolean;
}

/** Ejecución activa de la empresa, si la hay. */
async function ejecucionActiva(companyId: string) {
  const { data } = await supabaseAdmin
    .from("tax_sync_plans")
    .select("id, started_at")
    .eq("company_id", companyId)
    .eq("in_progress", true)
    .maybeSingle();
  return data ?? null;
}

/* ------------------------- Preparación completa ------------------------- */

export interface EntradaPreparacion {
  userId: string;
  companyId: string;
  periodos: string[];
  ahora?: Date;
}

export type EstadoPreparacion = "aprobado" | "cache_only" | "bloqueado";

export interface Preparacion {
  estado: EstadoPreparacion;
  plan: SyncExecutionPlan;
  control: ControlPlanEjecucion;
  /** Solo presente cuando el plan quedó aprobado y hay que consultar. */
  planId: string | null;
  mensaje: string;
  errorCodigo: string | null;
}

export const MENSAJE_CACHE_ONLY = "Tus datos ya están actualizados.";

/**
 * Construye y valida el plan definitivo. El navegador solo indica empresa y
 * periodos: todo lo demás lo decide el servidor con datos persistidos.
 *
 * Orden: rol → periodos → estado en base de datos → plan → límites →
 * presupuesto → concurrencia. La clave NUNCA participa de este proceso.
 */
export async function prepararEjecucionPlanificada(
  entrada: EntradaPreparacion,
): Promise<Preparacion> {
  const ahora = entrada.ahora ?? new Date();

  // B. Rol y acceso a la empresa.
  await exigirRol(entrada.userId, entrada.companyId, ["owner"]);

  // C. Normalización de periodos.
  const periodos = Array.from(
    new Set(
      entrada.periodos
        .map((p) => normalizarPeriodo(p))
        .filter((p): p is string => !!p),
    ),
  ).sort();
  if (periodos.length === 0)
    throw new ErrorNegocio("El periodo debe tener el formato AAAA-MM.");

  // Modo de ejecución: la automatización avanzada sigue sin estar disponible.
  const preferencias = await obtenerPreferenciasSync(entrada.userId, entrada.companyId);
  if (preferencias.syncMode !== "manual_secure")
    throw new ErrorNegocio("La automatización avanzada todavía no está disponible.");

  // D. Estado real guardado.
  const estados = await construirEstadosPeriodos(entrada.companyId, periodos, ahora);

  // E. Plan.
  const plan = construirPlanEjecucion({
    companyId: entrada.companyId,
    requestedPeriods: periodos,
    estados,
    ahora,
    executionMode: "manual_secure",
  });
  const control = new ControlPlanEjecucion(plan);

  // F. Límites del plan, antes de recibir o usar la clave.
  const limites = verificarLimitesPlan(plan);
  if (!limites.ok) {
    await registrarPlan(entrada, plan, {
      planStatus: "stopped_by_guard",
      errorCodigo: CODIGO_GUARDA_CREDITOS,
      enCurso: false,
    });
    return {
      estado: "bloqueado",
      plan,
      control,
      planId: null,
      mensaje: limites.mensajeUsuario ?? "Detuvimos la actualización por precaución.",
      errorCodigo: CODIGO_GUARDA_CREDITOS,
    };
  }

  // G. Presupuesto mensual.
  const presupuesto = evaluarPresupuesto(preferencias);
  if (presupuesto.estado === "bloqueado" && plan.requiresCredentials) {
    await registrarPlan(entrada, plan, {
      planStatus: "stopped_by_guard",
      errorCodigo: CODIGO_GUARDA_CREDITOS,
      enCurso: false,
    });
    return {
      estado: "bloqueado",
      plan,
      control,
      planId: null,
      mensaje:
        "Alcanzaste el presupuesto mensual de actualizaciones que definiste. No se consumieron créditos y tus datos guardados siguen disponibles.",
      errorCodigo: CODIGO_GUARDA_CREDITOS,
    };
  }

  // H. Plan sin llamadas: se responde con la información guardada.
  if (!plan.requiresCredentials) {
    await registrarPlan(entrada, plan, {
      planStatus: "cache_only",
      errorCodigo: null,
      enCurso: false,
    });
    return {
      estado: "cache_only",
      plan,
      control,
      planId: null,
      mensaje: MENSAJE_CACHE_ONLY,
      errorCodigo: null,
    };
  }

  // K. Concurrencia: una sola ejecución activa por empresa.
  const activa = await ejecucionActiva(entrada.companyId);
  if (activa)
    return {
      estado: "bloqueado",
      plan,
      control,
      planId: null,
      mensaje:
        "Ya hay una actualización en curso para esta empresa. Espera a que termine para no consultar dos veces.",
      errorCodigo: "SYNC_ALREADY_RUNNING",
    };

  const planId = await registrarPlan(entrada, plan, {
    planStatus: "approved",
    errorCodigo: null,
    enCurso: true,
  });
  if (!planId)
    return {
      estado: "bloqueado",
      plan,
      control,
      planId: null,
      mensaje:
        "Ya hay una actualización en curso para esta empresa. Espera a que termine para no consultar dos veces.",
      errorCodigo: "SYNC_ALREADY_RUNNING",
    };

  return {
    estado: "aprobado",
    plan,
    control,
    planId,
    mensaje: "Plan aprobado.",
    errorCodigo: null,
  };
}

/** Guarda el plan. Solo cifras y recursos: nunca datos de acceso. */
async function registrarPlan(
  entrada: EntradaPreparacion,
  plan: SyncExecutionPlan,
  extra: { planStatus: string; errorCodigo: string | null; enCurso: boolean },
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("tax_sync_plans")
    .insert({
      company_id: entrada.companyId,
      created_by: entrada.userId,
      requested_periods: plan.requestedPeriods,
      execution_mode: plan.executionMode,
      requires_credentials: plan.requiresCredentials,
      plan: plan as never,
      plan_status: extra.planStatus,
      in_progress: extra.enCurso,
      planned_calls: plan.expectedProviderCalls,
      planned_credit_min: plan.expectedCreditRange.min,
      planned_credit_max: plan.expectedCreditRange.max,
      calls_avoided_by_cache: plan.periodsUsingCache.length,
      error_code: extra.errorCodigo,
      completed_at: extra.enCurso ? null : new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  return data ? String(data.id) : null;
}

/**
 * Cierra la ejecución: libera el bloqueo y deja la comparación entre lo
 * planificado y lo realmente consumido.
 */
export async function cerrarEjecucionPlanificada(
  planId: string | null,
  control: ControlPlanEjecucion,
  creditosReales: number,
  fallo = false,
  errorCodigo: string | null = null,
): Promise<void> {
  if (!planId) return;
  const resumen = resumenPlanVsReal(control, creditosReales, fallo);
  await supabaseAdmin
    .from("tax_sync_plans")
    .update({
      in_progress: false,
      plan_status: resumen.planStatus,
      actual_calls: resumen.actualCalls,
      actual_credits: resumen.actualCredits,
      unplanned_calls_blocked: resumen.unplannedCallsBlocked,
      calls_avoided_by_cache: resumen.callsAvoidedByCache,
      error_code: errorCodigo,
      completed_at: new Date().toISOString(),
    })
    .eq("id", planId);
}
