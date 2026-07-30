import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  EMPRESA_DEMO,
  HISTORIAL_METAS,
  obtenerPeriodoData,
  PERIODOS,
} from "@/data/mockTaxData";
import { normalizarRut, esRutValido } from "@/lib/rut";
import {
  confianzaADb,
  diasDePeriodo,
  periodoAnterior,
  rcvDesdeEstado,
} from "@/lib/taxMappers";
import {
  construirMeta,
  construirResumenMensual,
} from "@/utils/taxCalculations";
import type { DocumentoTributario } from "@/types/tax";

type Rol = "owner" | "business_user" | "accountant" | "viewer";

export class ErrorNegocio extends Error {}

/** Verifica que el usuario pertenezca a la empresa con un rol suficiente. */
async function exigirRol(userId: string, companyId: string, roles: Rol[]) {
  const { data, error } = await supabaseAdmin
    .from("tax_company_members")
    .select("role, status")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new ErrorNegocio("No pudimos verificar tus permisos.");
  if (!data) throw new ErrorNegocio("No tienes acceso a esta empresa.");
  if (!roles.includes(data.role as Rol))
    throw new ErrorNegocio("No tienes permisos para realizar esta acción.");
  return data.role as Rol;
}

async function registrarActividad(
  companyId: string | null,
  userId: string,
  action: string,
  entityType?: string,
  metadata: Record<string, string | number | boolean | null> = {},
) {
  await supabaseAdmin
    .from("tax_activity_logs")
    .insert({ company_id: companyId, user_id: userId, action, entity_type: entityType ?? null, metadata });
}

async function idPeriodo(companyId: string, periodo: string) {
  const { data } = await supabaseAdmin
    .from("tax_periods")
    .select("id")
    .eq("company_id", companyId)
    .eq("period", periodo)
    .maybeSingle();
  return data?.id ?? null;
}

async function crearPeriodos(companyId: string, periodos: string[], demo: boolean) {
  const filas = periodos.map((period, i) => {
    const [year, month] = period.split("-").map(Number);
    return {
      company_id: companyId,
      period,
      year,
      month,
      status: i === 0 ? ("open" as const) : ("estimated" as const),
      data_source: demo ? ("mock" as const) : ("manual" as const),
      confidence_level: demo ? ("medium" as const) : ("unknown" as const),
    };
  });
  await supabaseAdmin.from("tax_periods").upsert(filas, { onConflict: "company_id,period" });
}

function filaDocumento(
  companyId: string,
  periodId: string,
  direccion: "sale" | "purchase",
  d: DocumentoTributario,
) {
  return {
    company_id: companyId,
    tax_period_id: periodId,
    external_id: d.id,
    document_direction: direccion,
    document_type: d.tipoDocumento,
    folio: d.folio,
    document_date: d.fecha.slice(0, 10),
    counterparty_name: d.contraparte,
    counterparty_rut: d.rutContraparte,
    net_amount: d.neto,
    vat_amount: d.iva,
    exempt_amount: d.exento,
    total_amount: d.total,
    rcv_status: rcvDesdeEstado(direccion, d.estado),
    source: "mock" as const,
    raw_metadata: { origen: "demostrativo" },
  };
}

/** Puebla la empresa demostrativa. Idempotente: no duplica documentos. */
export async function poblarDatosDemo(companyId: string) {
  const periodos = PERIODOS.map((p) => p.id);
  await crearPeriodos(companyId, periodos, true);

  for (const periodo of periodos) {
    const periodId = await idPeriodo(companyId, periodo);
    if (!periodId) continue;

    const data = obtenerPeriodoData("equilibrado", periodo);
    const anteriorId = periodoAnterior(periodo);
    const dataAnterior = periodos.includes(anteriorId)
      ? obtenerPeriodoData("equilibrado", anteriorId)
      : null;

    const docs = [
      ...data.documentosVenta.map((d) => filaDocumento(companyId, periodId, "sale", d)),
      ...data.documentosCompra.map((d) =>
        filaDocumento(companyId, periodId, "purchase", d),
      ),
    ];
    await supabaseAdmin.from("tax_documents").upsert(docs, {
      onConflict: "company_id,document_direction,document_type,folio,counterparty_rut",
      ignoreDuplicates: true,
    });

    const resumen = construirResumenMensual(data, {
      margenPorcentaje: 10,
      dineroReservado: data.dineroReservado,
    });
    const meta = construirMeta(data, resumen.ventasTotales, data.metaMensual);

    await supabaseAdmin.from("tax_monthly_summaries").upsert(
      {
        company_id: companyId,
        tax_period_id: periodId,
        sales_total: resumen.ventasTotales,
        invoice_sales: resumen.ventasFacturas,
        receipt_sales: resumen.ventasBoletas,
        exempt_sales: resumen.ventasExentas,
        sales_credit_notes: resumen.notasCreditoVentas,
        purchases_total: resumen.comprasTotales,
        net_purchases: resumen.comprasNetas,
        exempt_purchases: resumen.comprasExentas,
        vat_debit: resumen.ivaDebito,
        vat_credit: resumen.ivaCredito,
        previous_vat_carryforward: resumen.remanenteAnterior,
        estimated_vat_payable: resumen.ivaEstimado,
        estimated_new_carryforward: resumen.nuevoRemanente,
        estimated_ppm: resumen.ppmEstimado,
        estimated_withholdings: resumen.retencionesEstimadas,
        estimated_tax_total: resumen.totalTributarioEstimado,
        preventive_margin_amount: resumen.margenPreventivo,
        recommended_reserve: resumen.reservaRecomendada,
        reserved_amount_snapshot: resumen.dineroReservado,
        projected_sales: meta.proyeccionCierre,
        source: "mock" as const,
      },
      { onConflict: "company_id,tax_period_id" },
    );

    await supabaseAdmin.from("tax_periods").update({
      last_calculated_at: new Date().toISOString(),
      confidence_level: confianzaADb(data.confiabilidad),
    }).eq("id", periodId);

    const historial = HISTORIAL_METAS.find((h) => h.periodo === periodo);
    await supabaseAdmin.from("tax_sales_goals").upsert(
      {
        company_id: companyId,
        tax_period_id: periodId,
        goal_amount: historial?.meta ?? data.metaMensual,
      },
      { onConflict: "company_id,tax_period_id" },
    );

    const esActual = periodo === periodos[0];
    await supabaseAdmin.from("tax_f29_history").upsert(
      {
        company_id: companyId,
        tax_period_id: periodId,
        declaration_status: esActual ? ("not_available" as const) : ("filed" as const),
        declared_vat: esActual ? null : resumen.ivaEstimado,
        declared_ppm: esActual ? null : resumen.ppmEstimado,
        declared_withholdings: esActual ? null : resumen.retencionesEstimadas,
        declared_total: esActual ? null : resumen.totalTributarioEstimado,
        vat_carryforward: esActual ? null : resumen.nuevoRemanente,
        filed_at: esActual ? null : new Date(`${periodo}-12T12:00:00Z`).toISOString(),
        source: "mock" as const,
        raw_data: { origen: "demostrativo", anterior: dataAnterior ? true : false },
      },
      { onConflict: "company_id,tax_period_id" },
    );
  }

  const periodoActual = await idPeriodo(companyId, periodos[0]);
  const { count } = await supabaseAdmin
    .from("tax_alerts")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  if (!count) {
    await supabaseAdmin.from("tax_alerts").insert([
      {
        company_id: companyId,
        tax_period_id: periodoActual,
        alert_type: "reserve_insufficient" as const,
        severity: "warning" as const,
        title: "Tu reserva aún no cubre la estimación",
        message:
          "Según los datos demostrativos del mes, conviene apartar dinero adicional. Estimación informativa.",
      },
      {
        company_id: companyId,
        tax_period_id: periodoActual,
        alert_type: "stale_data" as const,
        severity: "info" as const,
        title: "Datos demostrativos",
        message:
          "Esta empresa usa información ficticia. No proviene del SII ni reemplaza a tu contador.",
      },
    ]);
  }
}

export async function listarEmpresasDeUsuario(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("tax_company_members")
    .select("role, company:tax_companies(*)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw new ErrorNegocio("No pudimos cargar tus empresas.");
  return data ?? [];
}

export async function crearEmpresa(
  userId: string,
  entrada: {
    rut: string;
    razonSocial: string;
    nombreFantasia?: string | null;
    actividad?: string | null;
    esDemo?: boolean;
  },
) {
  const rut = normalizarRut(entrada.rut);
  if (!esRutValido(rut)) throw new ErrorNegocio("El RUT ingresado no es válido.");
  if (!entrada.razonSocial.trim())
    throw new ErrorNegocio("La razón social es obligatoria.");

  const { data: existente } = await supabaseAdmin
    .from("tax_companies")
    .select("id")
    .eq("created_by", userId)
    .eq("rut", rut)
    .maybeSingle();
  if (existente) throw new ErrorNegocio("Ya registraste una empresa con este RUT.");

  const { data: empresa, error } = await supabaseAdmin
    .from("tax_companies")
    .insert({
      rut,
      business_name: entrada.razonSocial.trim(),
      fantasy_name: entrada.nombreFantasia?.trim() || null,
      business_activity: entrada.actividad?.trim() || null,
      connection_status: entrada.esDemo ? "connected" : "disconnected",
      active_period: PERIODOS[0].id,
      is_demo: !!entrada.esDemo,
      created_by: userId,
      last_sync_at: entrada.esDemo ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  if (error || !empresa) throw new ErrorNegocio("No pudimos crear la empresa.");

  await supabaseAdmin.from("tax_company_members").insert({
    company_id: empresa.id,
    user_id: userId,
    role: "owner",
    status: "active",
    joined_at: new Date().toISOString(),
  });

  await supabaseAdmin.from("tax_company_settings").insert({
    company_id: empresa.id,
    monthly_sales_goal: entrada.esDemo ? obtenerPeriodoData("equilibrado", PERIODOS[0].id).metaMensual : null,
    reserved_amount: entrada.esDemo
      ? obtenerPeriodoData("equilibrado", PERIODOS[0].id).dineroReservado
      : 0,
  });

  if (entrada.esDemo) {
    await poblarDatosDemo(empresa.id);
  } else {
    await crearPeriodos(empresa.id, PERIODOS.map((p) => p.id), false);
  }

  await supabaseAdmin.from("profiles").update({ onboarding_completed: true }).eq("id", userId);
  await registrarActividad(empresa.id, userId, "company.created", "tax_companies", {
    is_demo: !!entrada.esDemo,
  });

  return empresa;
}

/** Crea (una sola vez) la empresa demostrativa del usuario. */
export async function asegurarEmpresaDemo(userId: string) {
  const { data: existente } = await supabaseAdmin
    .from("tax_companies")
    .select("*")
    .eq("created_by", userId)
    .eq("is_demo", true)
    .maybeSingle();
  if (existente) {
    await poblarDatosDemo(existente.id);
    return existente;
  }
  return crearEmpresa(userId, {
    rut: EMPRESA_DEMO.rut,
    razonSocial: EMPRESA_DEMO.razonSocial,
    nombreFantasia: EMPRESA_DEMO.nombreFantasia,
    actividad: EMPRESA_DEMO.actividad,
    esDemo: true,
  });
}

export async function actualizarConfiguracion(
  userId: string,
  entrada: {
    companyId: string;
    periodo?: string | null;
    metaMensual?: number | null;
    dineroReservado?: number | null;
    margenPorcentaje?: number | null;
    tasaPpm?: number | null;
    alertasActivas?: boolean | null;
  },
) {
  const rol = await exigirRol(userId, entrada.companyId, [
    "owner",
    "business_user",
    "accountant",
  ]);
  if (rol === "accountant" && (entrada.metaMensual != null || entrada.dineroReservado != null))
    throw new ErrorNegocio("El contador no puede modificar la meta ni la reserva.");

  const cambios: Record<string, number | boolean> = {};
  if (entrada.metaMensual != null) cambios.monthly_sales_goal = Math.round(entrada.metaMensual);
  if (entrada.dineroReservado != null)
    cambios.reserved_amount = Math.round(entrada.dineroReservado);
  if (entrada.margenPorcentaje != null)
    cambios.preventive_margin_percent = entrada.margenPorcentaje;
  if (entrada.tasaPpm != null) cambios.estimated_ppm_rate = entrada.tasaPpm;
  if (entrada.alertasActivas != null) cambios.alerts_enabled = entrada.alertasActivas;

  if (Object.keys(cambios).length) {
    const { error } = await supabaseAdmin
      .from("tax_company_settings")
      .update(cambios)
      .eq("company_id", entrada.companyId);
    if (error) throw new ErrorNegocio("No pudimos guardar la configuración.");
  }

  if (entrada.metaMensual != null && entrada.periodo) {
    const periodId = await idPeriodo(entrada.companyId, entrada.periodo);
    if (periodId) {
      await supabaseAdmin.from("tax_sales_goals").upsert(
        {
          company_id: entrada.companyId,
          tax_period_id: periodId,
          goal_amount: Math.round(entrada.metaMensual),
          created_by: userId,
        },
        { onConflict: "company_id,tax_period_id" },
      );
    }
  }

  await registrarActividad(entrada.companyId, userId, "settings.updated", "tax_company_settings", {
    campos: Object.keys(cambios),
  });
  return { ok: true };
}

export async function registrarSincronizacionDemo(
  userId: string,
  entrada: { companyId: string; periodo?: string | null },
) {
  await exigirRol(userId, entrada.companyId, ["owner", "business_user", "accountant"]);
  const periodId = entrada.periodo ? await idPeriodo(entrada.companyId, entrada.periodo) : null;

  const { data: run } = await supabaseAdmin
    .from("tax_sync_runs")
    .insert({
      company_id: entrada.companyId,
      tax_period_id: periodId,
      sync_type: "demo",
      status: "running",
      source: "mock",
    })
    .select("id")
    .single();

  const { count } = await supabaseAdmin
    .from("tax_documents")
    .select("id", { count: "exact", head: true })
    .eq("company_id", entrada.companyId);

  const ahora = new Date().toISOString();
  if (run)
    await supabaseAdmin
      .from("tax_sync_runs")
      .update({
        status: "success",
        completed_at: ahora,
        records_received: count ?? 0,
        records_updated: count ?? 0,
      })
      .eq("id", run.id);

  await supabaseAdmin
    .from("tax_companies")
    .update({ last_sync_at: ahora, connection_status: "connected" })
    .eq("id", entrada.companyId);

  await registrarActividad(entrada.companyId, userId, "sync.demo", "tax_sync_runs");
  return { ultimaSincronizacion: ahora };
}

export async function cambiarConexionDemo(
  userId: string,
  entrada: { companyId: string; conectar: boolean },
) {
  await exigirRol(userId, entrada.companyId, ["owner", "business_user"]);
  const ahora = new Date().toISOString();
  await supabaseAdmin
    .from("tax_companies")
    .update({
      connection_status: entrada.conectar ? "connected" : "disconnected",
      last_sync_at: entrada.conectar ? ahora : undefined,
    })
    .eq("id", entrada.companyId);
  await registrarActividad(
    entrada.companyId,
    userId,
    entrada.conectar ? "connection.demo_enabled" : "connection.demo_disabled",
    "tax_companies",
  );
  return { ultimaSincronizacion: entrada.conectar ? ahora : null };
}

export async function actualizarEmpresa(
  userId: string,
  entrada: {
    companyId: string;
    razonSocial?: string;
    nombreFantasia?: string | null;
    actividad?: string | null;
    direccion?: string | null;
    comuna?: string | null;
    region?: string | null;
  },
) {
  await exigirRol(userId, entrada.companyId, ["owner"]);
  const { error } = await supabaseAdmin
    .from("tax_companies")
    .update({
      business_name: entrada.razonSocial?.trim() || undefined,
      fantasy_name: entrada.nombreFantasia ?? undefined,
      business_activity: entrada.actividad ?? undefined,
      address: entrada.direccion ?? undefined,
      commune: entrada.comuna ?? undefined,
      region: entrada.region ?? undefined,
    })
    .eq("id", entrada.companyId);
  if (error) throw new ErrorNegocio("No pudimos guardar los datos de la empresa.");
  await registrarActividad(entrada.companyId, userId, "company.updated", "tax_companies");
  return { ok: true };
}

export async function cambiarRolMiembro(
  userId: string,
  entrada: {
    companyId: string;
    memberId: string;
    rol?: Rol | null;
    estado?: "active" | "suspended" | "removed" | null;
  },
) {
  await exigirRol(userId, entrada.companyId, ["owner"]);
  const { data: miembro } = await supabaseAdmin
    .from("tax_company_members")
    .select("id, user_id, role")
    .eq("id", entrada.memberId)
    .eq("company_id", entrada.companyId)
    .maybeSingle();
  if (!miembro) throw new ErrorNegocio("El miembro no pertenece a esta empresa.");
  if (miembro.user_id === userId)
    throw new ErrorNegocio("No puedes cambiar tu propio rol de propietario.");

  await supabaseAdmin
    .from("tax_company_members")
    .update({
      role: entrada.rol ?? undefined,
      status: entrada.estado ?? undefined,
    })
    .eq("id", entrada.memberId);

  await registrarActividad(entrada.companyId, userId, "member.updated", "tax_company_members", {
    member_id: entrada.memberId,
  });
  return { ok: true };
}

export const _diasDePeriodo = diasDePeriodo;
