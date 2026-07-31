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
  /**
   * Diagnóstico interno: autoriza el detalle documento por documento. La
   * actualización normal jamás lo usa.
   */
  incluirDetalle?: boolean;
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
 * ORDEN AUTORITATIVO (no se puede alterar):
 *  1. usuario autenticado (lo garantiza la capa de servidor que llama);
 *  2. usuario activo;
 *  3. acceso a la empresa;
 *  4. rol autorizado para sincronizar;
 *  5. bloqueo de sincronización;
 *  6. caché y estado tributario guardado;
 *  7. plan de ejecución;
 *  8. límites;
 *  9. presupuesto;
 * 10. determinación de credenciales necesarias.
 *
 * Antes del paso 4 NO se lee ningún periodo, folio, extracción de F29 ni
 * presupuesto, no se construye plan y no se revela si la empresa existe.
 * La Clave Tributaria NUNCA participa de este proceso.
 */
export async function prepararEjecucionPlanificada(
  entrada: EntradaPreparacion,
): Promise<Preparacion> {
  const ahora = entrada.ahora ?? new Date();

  // --- 2, 3 y 4. Usuario activo, acceso a la empresa y rol autorizado. -----
  // `exigirRol` exige membresía ACTIVA en esta empresa con rol suficiente. Si
  // falla, se lanza de inmediato y no se lee ni se revela nada tributario.
  await exigirRol(entrada.userId, entrada.companyId, ["owner"]);

  // Formato de los periodos. No consulta la base de datos.
  const periodos = Array.from(
    new Set(
      entrada.periodos
        .map((p) => normalizarPeriodo(p))
        .filter((p): p is string => !!p),
    ),
  ).sort();
  if (periodos.length === 0)
    throw new ErrorNegocio("El periodo debe tener el formato AAAA-MM.");

  // --- 5. Bloqueo de sincronización, ANTES de leer datos tributarios. ------
  const planId = await adquirirBloqueo(entrada, periodos);
  if (!planId)
    return {
      estado: "bloqueado",
      plan: planVacio(entrada.companyId, periodos),
      control: new ControlPlanEjecucion(planVacio(entrada.companyId, periodos)),
      planId: null,
      mensaje:
        "Ya hay una actualización en curso para esta empresa. Espera a que termine para no consultar dos veces.",
      errorCodigo: "SYNC_ALREADY_RUNNING",
    };

  try {
    // Modo de ejecución: la automatización avanzada sigue sin estar disponible.
    const preferencias = await obtenerPreferenciasSync(
      entrada.userId,
      entrada.companyId,
    );
    if (preferencias.syncMode !== "manual_secure")
      throw new ErrorNegocio("La automatización avanzada todavía no está disponible.");

    // --- 6. Caché y estado tributario guardado. ---------------------------
    const estados = await construirEstadosPeriodos(entrada.companyId, periodos, ahora);

    // --- 7. Plan. ---------------------------------------------------------
    const plan = construirPlanEjecucion({
      companyId: entrada.companyId,
      requestedPeriods: periodos,
      estados,
      ahora,
      executionMode: "manual_secure",
      permitirDetalleDocumental: entrada.incluirDetalle === true,
    });
    const control = new ControlPlanEjecucion(plan);

    // --- 8. Límites del plan, antes de recibir o usar la clave. -----------
    const limites = verificarLimitesPlan(plan);
    if (!limites.ok) {
      await liberarBloqueo(planId, plan, "stopped_by_guard", CODIGO_GUARDA_CREDITOS);
      return {
        estado: "bloqueado",
        plan,
        control,
        planId: null,
        mensaje: limites.mensajeUsuario ?? "Detuvimos la actualización por precaución.",
        errorCodigo: CODIGO_GUARDA_CREDITOS,
      };
    }

    // --- 9. Presupuesto mensual. ------------------------------------------
    const presupuesto = evaluarPresupuesto(preferencias);
    if (presupuesto.estado === "bloqueado" && plan.requiresCredentials) {
      await liberarBloqueo(planId, plan, "stopped_by_guard", CODIGO_GUARDA_CREDITOS);
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

    // --- 10. Credenciales: un plan sin llamadas no las necesita. ----------
    if (!plan.requiresCredentials) {
      await liberarBloqueo(planId, plan, "cache_only", null);
      return {
        estado: "cache_only",
        plan,
        control,
        planId: null,
        mensaje: MENSAJE_CACHE_ONLY,
        errorCodigo: null,
      };
    }

    await guardarPlanAprobado(planId, plan);

    return {
      estado: "aprobado",
      plan,
      control,
      planId,
      mensaje: "Plan aprobado.",
      errorCodigo: null,
    };
  } catch (error) {
    // El bloqueo nunca queda tomado si la preparación falla.
    await supabaseAdmin
      .from("tax_sync_plans")
      .update({
        in_progress: false,
        plan_status: "failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", planId);
    throw error;
  }
}

/** Plan vacío para responder sin revelar nada cuando no se llegó a construir. */
function planVacio(companyId: string, periodos: string[]): SyncExecutionPlan {
  return construirPlanEjecucion({
    companyId,
    requestedPeriods: periodos,
    estados: [],
    ahora: new Date(),
    executionMode: "manual_secure",
  });
}

/**
 * Toma el bloqueo por empresa. El índice único parcial de la base de datos
 * garantiza que solo una ejecución quede en curso: si ya hay otra, el insert
 * falla y devolvemos null sin leer nada del contribuyente.
 */
async function adquirirBloqueo(
  entrada: EntradaPreparacion,
  periodos: string[],
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("tax_sync_plans")
    .insert({
      company_id: entrada.companyId,
      created_by: entrada.userId,
      requested_periods: periodos,
      execution_mode: "manual_secure",
      requires_credentials: false,
      plan: {} as never,
      plan_status: "planned",
      in_progress: true,
      planned_calls: 0,
      planned_credit_min: 0,
      planned_credit_max: 0,
      calls_avoided_by_cache: 0,
    })
    .select("id")
    .maybeSingle();
  return data ? String(data.id) : null;
}

/** Escribe el plan aprobado sobre la fila del bloqueo, que sigue vigente. */
async function guardarPlanAprobado(planId: string, plan: SyncExecutionPlan) {
  await supabaseAdmin
    .from("tax_sync_plans")
    .update({
      plan: plan as never,
      plan_status: "approved",
      requires_credentials: plan.requiresCredentials,
      planned_calls: plan.expectedProviderCalls,
      planned_credit_min: plan.expectedCreditRange.min,
      planned_credit_max: plan.expectedCreditRange.max,
      calls_avoided_by_cache: plan.periodsUsingCache.length,
    })
    .eq("id", planId);
}

/** Cierra la fila y libera el bloqueo cuando no habrá consultas. */
async function liberarBloqueo(
  planId: string,
  plan: SyncExecutionPlan,
  planStatus: string,
  errorCodigo: string | null,
) {
  await supabaseAdmin
    .from("tax_sync_plans")
    .update({
      plan: plan as never,
      plan_status: planStatus,
      requires_credentials: plan.requiresCredentials,
      planned_calls: plan.expectedProviderCalls,
      planned_credit_min: plan.expectedCreditRange.min,
      planned_credit_max: plan.expectedCreditRange.max,
      calls_avoided_by_cache: plan.periodsUsingCache.length,
      error_code: errorCodigo,
      in_progress: false,
      completed_at: new Date().toISOString(),
    })
    .eq("id", planId);
}

/* --------------------- Ampliación controlada del plan --------------------- */

export interface EntradaAmpliacion {
  userId: string;
  companyId: string;
  planId: string;
  control: ControlPlanEjecucion;
  periodo: string;
  folioNuevo: string;
  folioAnterior: string | null;
  /** El folio ya está descargado y leído: no corresponde pagar de nuevo. */
  folioYaDescargado: boolean;
}

export type ResultadoAmpliacionServidor =
  | { autorizada: true }
  | { autorizada: false; codigo: string; motivo: string; mensajeUsuario: string };

/**
 * Única vía para que un folio nuevo o rectificatorio entre al plan. Revalida
 * permisos, bloqueo, idempotencia, límites y presupuesto; si algo falla, la
 * ampliación queda registrada como rechazada y NO se llama al proveedor.
 */
export async function solicitarAmpliacionF29(
  entrada: EntradaAmpliacion,
): Promise<ResultadoAmpliacionServidor> {
  const propuesta = construirPropuestaAmpliacionF29({
    planId: entrada.planId,
    companyId: entrada.companyId,
    periodo: entrada.periodo,
    folioNuevo: entrada.folioNuevo,
    folioAnterior: entrada.folioAnterior,
  });

  // Permisos y bloqueo se revalidan aquí, no se dan por heredados.
  let permisosOk = true;
  try {
    await exigirRol(entrada.userId, entrada.companyId, ["owner"]);
  } catch {
    permisosOk = false;
  }

  const { data: fila } = await supabaseAdmin
    .from("tax_sync_plans")
    .select("id, in_progress, company_id")
    .eq("id", entrada.planId)
    .maybeSingle();
  const bloqueoVigente =
    !!fila && fila.in_progress === true && fila.company_id === entrada.companyId;

  const { data: previa } = await supabaseAdmin
    .from("tax_sync_plan_amendments")
    .select("id, status")
    .eq("plan_id", entrada.planId)
    .eq("period", entrada.periodo)
    .eq("new_folio", entrada.folioNuevo)
    .maybeSingle();

  const preferencias = await obtenerPreferenciasSync(entrada.userId, entrada.companyId);
  const presupuesto = evaluarPresupuesto(preferencias);

  const evaluacion = evaluarAmpliacion(entrada.control.plan, propuesta, {
    permisosOk,
    bloqueoVigente,
    folioYaDescargado: entrada.folioYaDescargado,
    ampliacionPrevia: !!previa,
    descargasDelFolio: entrada.control.consumoDeRecurso(propuesta.recursoId),
    llamadasRealizadas: entrada.control.llamadasRealizadas(),
    maximoLlamadasPorEjecucion: MAX_REAL_PROVIDER_REQUESTS_PER_SYNC,
    presupuestoBloqueado: presupuesto.estado === "bloqueado",
    creditoDisponible: presupuesto.creditosRestantes ?? null,
  });

  const aprobada = evaluacion.aprobada;
  await supabaseAdmin.from("tax_sync_plan_amendments").insert({
    plan_id: entrada.planId,
    company_id: entrada.companyId,
    requested_by: entrada.userId,
    period: propuesta.periodo,
    new_folio: propuesta.folioNuevo,
    previous_folio: propuesta.folioAnterior,
    reason: propuesta.motivo,
    resource_id: propuesta.recursoId,
    additional_calls: propuesta.llamadasAdicionales,
    additional_credit_min: propuesta.creditoAdicionalMin,
    additional_credit_max: propuesta.creditoAdicionalMax,
    status: aprobada ? "approved" : "rejected",
    rejection_code: aprobada ? null : evaluacion.codigo,
    rejection_detail: aprobada ? null : evaluacion.motivo,
  });

  if (!aprobada)
    return {
      autorizada: false,
      codigo: evaluacion.codigo,
      motivo: evaluacion.motivo,
      mensajeUsuario: evaluacion.mensajeUsuario,
    };

  // Recién aquí el recurso existe para el portero.
  entrada.control.aplicarAmpliacion(propuesta);

  await supabaseAdmin
    .from("tax_sync_plans")
    .update({
      plan: entrada.control.plan as never,
      plan_amended: true,
      amendment_reason: propuesta.motivo,
      approved_additional_calls: propuesta.llamadasAdicionales,
      approved_additional_credit_min: propuesta.creditoAdicionalMin,
      approved_additional_credit_max: propuesta.creditoAdicionalMax,
      amendment_created_at: new Date().toISOString(),
      planned_calls: entrada.control.plan.expectedProviderCalls,
      planned_credit_max: entrada.control.plan.expectedCreditRange.max,
    })
    .eq("id", entrada.planId);

  return { autorizada: true };
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
