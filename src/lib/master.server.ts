/**
 * Panel Master: lectura y acciones administrativas de la plataforma.
 *
 * Solo el rol global `admin` puede ejecutar cualquiera de estas funciones.
 * No consulta al SII ni al API Gateway (cero consumo de créditos), no toca el
 * motor tributario ni los cálculos, y nunca expone claves ni credenciales.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ErrorNegocio, registrarActividad } from "@/lib/companies.server";
import { mesActualChile, type EstadoCuenta, type Plan } from "@/lib/cuenta";
import { esAdministrador } from "@/lib/cuenta.server";
import {
  detectarAlertasConsumo,
  resumirConsumo,
  type CategoriaConsumo,
  type EventoConsumo,
  type ResumenConsumo,
} from "@/lib/costos";
import {
  serieIngresos,
  tasaConversion,
  tasaRetencion,
  ultimosMeses,
  type AudienciaComunicado,
  type Comunicado,
  type EventoPago,
  type PrioridadComunicado,
  type TipoComunicado,
} from "@/lib/master";

async function exigirAdmin(userId: string) {
  if (!(await esAdministrador(userId)))
    throw new ErrorNegocio("Esta sección es solo para el equipo de administración.");
}

/** Deja constancia de toda acción administrativa sensible. */
async function auditar(
  userId: string,
  accion: string,
  companyId: string | null,
  metadata: Record<string, string | number | boolean | null> = {},
) {
  await registrarActividad(companyId, userId, accion, "panel_master", metadata);
}

async function correosPorUsuario(): Promise<Map<string, string>> {
  try {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    return new Map(
      (data?.users ?? [])
        .filter((u) => !!u.email)
        .map((u) => [u.id, u.email as string] as const),
    );
  } catch (error) {
    console.error("[master] no se pudo listar correos", error);
    return new Map();
  }
}

// ---------------------------------------------------------------------------
// 1. Resumen
// ---------------------------------------------------------------------------

export interface ResumenMaster {
  totales: {
    clientes: number;
    activos: number;
    enPrueba: number;
    suspendidos: number;
    ingresosMes: number;
    pagosPendientes: number;
    consumoMes: number;
    erroresRecientes: number;
    nuevasEmpresas: number;
    conversiones: number;
  };
  porEstado: { estado: string; cantidad: number }[];
  ingresos: { mes: string; monto: number }[];
  consumo: { mes: string; unidades: number }[];
  altasBajas: { mes: string; altas: number; bajas: number }[];
  alertas: {
    id: string;
    empresa: string | null;
    tipo: string;
    severidad: string;
    mensaje: string;
    fecha: string;
  }[];
}

const ETIQUETA_ESTADO_GRAFICO: Record<string, string> = {
  active: "Activos",
  trial: "En prueba",
  suspended: "Suspendidos",
  payment_pending: "Pago pendiente",
  cancelled: "Cancelados",
};

export async function resumenMaster(userId: string): Promise<ResumenMaster> {
  await exigirAdmin(userId);
  const mes = mesActualChile();
  const meses = ultimosMeses(6, mes);

  const [empresas, subs, uso, cobros, corridas, alertas] = await Promise.all([
    supabaseAdmin
      .from("tax_companies")
      .select("id, business_name, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("tax_company_subscriptions")
      .select("company_id, status, cancelled_at, plan:tax_plans(code, name)"),
    supabaseAdmin
      .from("tax_usage_ledger")
      .select("company_id, usage_month, cost_units, requests, errors, cache_hits"),
    supabaseAdmin
      .from("tax_billing_events")
      .select("id, company_id, event_type, amount_clp, status, reference, notes, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("tax_sync_runs")
      .select("status, started_at")
      .order("started_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("tax_admin_alerts")
      .select("id, company_id, kind, severity, message, created_at")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const nombres = new Map((empresas.data ?? []).map((e) => [e.id, e.business_name]));
  const filasSub = subs.data ?? [];
  const conteo = new Map<string, number>();
  for (const s of filasSub) conteo.set(s.status, (conteo.get(s.status) ?? 0) + 1);

  const pagos: EventoPago[] = (cobros.data ?? []).map((c) => ({
    id: c.id,
    companyId: c.company_id,
    empresa: nombres.get(c.company_id) ?? "Empresa",
    tipo: c.event_type,
    monto: c.amount_clp === null ? null : Number(c.amount_clp),
    estado: c.status,
    referencia: c.reference,
    detalle: c.notes,
    fecha: c.occurred_at,
  }));

  const usoFilas = uso.data ?? [];
  const consumoPorMes = meses.map((m) => ({
    mes: m,
    unidades: usoFilas
      .filter((u) => u.usage_month === m)
      .reduce((a, u) => a + Number(u.cost_units), 0),
  }));

  const altasBajas = meses.map((m) => ({
    mes: m,
    altas: (empresas.data ?? []).filter((e) => e.created_at.slice(0, 7) === m).length,
    bajas: filasSub.filter((s) => (s.cancelled_at ?? "").slice(0, 7) === m).length,
  }));

  return {
    totales: {
      clientes: (empresas.data ?? []).length,
      activos: conteo.get("active") ?? 0,
      enPrueba: conteo.get("trial") ?? 0,
      suspendidos: (conteo.get("suspended") ?? 0) + (conteo.get("payment_pending") ?? 0),
      ingresosMes: pagos
        .filter((p) => p.estado === "aprobado" && p.fecha.slice(0, 7) === mes)
        .reduce((a, p) => a + (p.monto ?? 0), 0),
      pagosPendientes: pagos.filter(
        (p) => p.estado === "pendiente" || p.estado === "vencido",
      ).length,
      consumoMes: usoFilas
        .filter((u) => u.usage_month === mes)
        .reduce((a, u) => a + Number(u.cost_units), 0),
      erroresRecientes: (corridas.data ?? []).filter((c) => c.status === "failed").length,
      nuevasEmpresas: (empresas.data ?? []).filter(
        (e) => e.created_at.slice(0, 7) === mes,
      ).length,
      conversiones: conteo.get("active") ?? 0,
    },
    porEstado: [...conteo.entries()].map(([estado, cantidad]) => ({
      estado: ETIQUETA_ESTADO_GRAFICO[estado] ?? estado,
      cantidad,
    })),
    ingresos: serieIngresos(pagos, meses),
    consumo: consumoPorMes,
    altasBajas,
    alertas: (alertas.data ?? []).map((a) => ({
      id: a.id,
      empresa: a.company_id ? (nombres.get(a.company_id) ?? null) : null,
      tipo: a.kind,
      severidad: a.severity,
      mensaje: a.message,
      fecha: a.created_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// 2. Clientes
// ---------------------------------------------------------------------------

export interface ClienteMaster {
  companyId: string;
  empresa: string;
  rut: string;
  esDemo: boolean;
  contacto: string | null;
  correo: string | null;
  plan: string;
  planCodigo: string | null;
  estadoCuenta: EstadoCuenta;
  registro: string;
  ultimaActualizacion: string | null;
  usuarios: number;
  consultasMes: number;
  unidadesMes: number;
  cacheMes: number;
  erroresRecientes: number;
}

export async function listarClientes(userId: string): Promise<ClienteMaster[]> {
  await exigirAdmin(userId);
  const mes = mesActualChile();

  const { data: empresas } = await supabaseAdmin
    .from("tax_companies")
    .select("id, rut, business_name, is_demo, created_at, last_sync_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const ids = (empresas ?? []).map((e) => e.id);
  if (ids.length === 0) return [];

  const [subs, uso, miembros, corridas, correos] = await Promise.all([
    supabaseAdmin
      .from("tax_company_subscriptions")
      .select("company_id, status, plan:tax_plans(name, code)")
      .in("company_id", ids),
    supabaseAdmin
      .from("tax_usage_ledger")
      .select("company_id, requests, cache_hits, cost_units")
      .in("company_id", ids)
      .eq("usage_month", mes),
    supabaseAdmin
      .from("tax_company_members")
      .select("company_id, user_id, role, status")
      .in("company_id", ids)
      .eq("status", "active"),
    supabaseAdmin
      .from("tax_sync_runs")
      .select("company_id, status")
      .in("company_id", ids)
      .eq("status", "failed")
      .limit(500),
    correosPorUsuario(),
  ]);

  const perfilesIds = [...new Set((miembros.data ?? []).map((m) => m.user_id))];
  const { data: perfiles } = perfilesIds.length
    ? await supabaseAdmin.from("profiles").select("id, display_name").in("id", perfilesIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const nombrePerfil = new Map((perfiles ?? []).map((p) => [p.id, p.display_name]));

  const subPorEmpresa = new Map((subs.data ?? []).map((s) => [s.company_id, s]));

  return (empresas ?? []).map((e) => {
    const sub = subPorEmpresa.get(e.id);
    const plan = (sub?.plan ?? null) as { name: string; code: string } | null;
    const usos = (uso.data ?? []).filter((u) => u.company_id === e.id);
    const propietario = (miembros.data ?? []).find(
      (m) => m.company_id === e.id && m.role === "owner",
    );
    return {
      companyId: e.id,
      empresa: e.business_name,
      rut: e.rut,
      esDemo: e.is_demo,
      contacto: propietario ? (nombrePerfil.get(propietario.user_id) ?? null) : null,
      correo: propietario ? (correos.get(propietario.user_id) ?? null) : null,
      plan: plan?.name ?? "Sin plan",
      planCodigo: plan?.code ?? null,
      estadoCuenta: (sub?.status ?? "trial") as EstadoCuenta,
      registro: e.created_at,
      ultimaActualizacion: e.last_sync_at,
      usuarios: (miembros.data ?? []).filter((m) => m.company_id === e.id).length,
      consultasMes: usos.reduce((a, u) => a + u.requests, 0),
      unidadesMes: usos.reduce((a, u) => a + Number(u.cost_units), 0),
      cacheMes: usos.reduce((a, u) => a + u.cache_hits, 0),
      erroresRecientes: (corridas.data ?? []).filter((c) => c.company_id === e.id).length,
    };
  });
}

export interface NotaInterna {
  id: string;
  cuerpo: string;
  autor: string | null;
  fecha: string;
}

export interface FichaClienteMaster {
  cliente: ClienteMaster;
  suscripcion: {
    plan: string;
    planCodigo: string | null;
    estado: EstadoCuenta;
    inicio: string;
    finPrueba: string | null;
    proximaRenovacion: string | null;
    actualizacionesUsadas: number;
    motivoSuspension: string | null;
  } | null;
  miembros: { nombre: string | null; correo: string | null; rol: string; estado: string }[];
  pagos: EventoPago[];
  consumo: ResumenConsumo;
  periodos: { periodo: string; estado: string; fuente: string; actualizado: string }[];
  actividad: { accion: string; fecha: string; detalle: string | null }[];
  tickets: TicketMaster[];
  notas: NotaInterna[];
}

/**
 * Modo soporte seguro: solo lectura. Devuelve la ficha del cliente sin
 * credenciales, sin clave tributaria y sin ningún dato de autenticación.
 */
export async function fichaCliente(
  userId: string,
  companyId: string,
): Promise<FichaClienteMaster> {
  await exigirAdmin(userId);
  const clientes = await listarClientes(userId);
  const cliente = clientes.find((c) => c.companyId === companyId);
  if (!cliente) throw new ErrorNegocio("No encontramos esa empresa.");

  const [sub, miembros, pagos, uso, periodos, actividad, tickets, notas, correos] =
    await Promise.all([
      supabaseAdmin
        .from("tax_company_subscriptions")
        .select("*, plan:tax_plans(name, code)")
        .eq("company_id", companyId)
        .maybeSingle(),
      supabaseAdmin
        .from("tax_company_members")
        .select("user_id, role, status")
        .eq("company_id", companyId)
        .neq("status", "removed"),
      supabaseAdmin
        .from("tax_billing_events")
        .select("id, company_id, event_type, amount_clp, status, reference, notes, occurred_at")
        .eq("company_id", companyId)
        .order("occurred_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("tax_usage_ledger")
        .select("*")
        .eq("company_id", companyId)
        .order("occurred_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("tax_periods")
        .select("period, status, data_source, updated_at")
        .eq("company_id", companyId)
        .order("period", { ascending: false })
        .limit(24),
      supabaseAdmin
        .from("tax_activity_logs")
        .select("action, created_at, metadata")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("tax_support_tickets")
        .select("id, company_id, user_id, category, period, message, status, priority, created_at, resolved_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("tax_admin_notes")
        .select("id, body, author_id, created_at")
        .eq("entity_type", "company")
        .eq("entity_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50),
      correosPorUsuario(),
    ]);

  const perfilesIds = [...new Set((miembros.data ?? []).map((m) => m.user_id))];
  const { data: perfiles } = perfilesIds.length
    ? await supabaseAdmin.from("profiles").select("id, display_name").in("id", perfilesIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const nombrePerfil = new Map((perfiles ?? []).map((p) => [p.id, p.display_name]));

  const eventosConsumo: EventoConsumo[] = (uso.data ?? []).map((f) => ({
    categoria: f.category as CategoriaConsumo,
    consultas: f.requests,
    cacheHits: f.cache_hits,
    errores: f.errors,
    pdfsNuevos: f.new_pdfs,
    unidades: Number(f.cost_units),
    fueraDeFlujo: f.outside_economic_flow,
    periodo: f.period,
    mes: f.usage_month,
  }));

  const filaSub = sub.data as
    | (Record<string, unknown> & { plan: { name: string; code: string } | null })
    | null;

  await auditar(userId, "admin.support_view", companyId, { modo: "solo_lectura" });

  return {
    cliente,
    suscripcion: filaSub
      ? {
          plan: filaSub.plan?.name ?? "Sin plan",
          planCodigo: filaSub.plan?.code ?? null,
          estado: filaSub.status as EstadoCuenta,
          inicio: filaSub.started_at as string,
          finPrueba: (filaSub.trial_ends_at as string | null) ?? null,
          proximaRenovacion: (filaSub.next_renewal_at as string | null) ?? null,
          actualizacionesUsadas: Number(filaSub.updates_used ?? 0),
          motivoSuspension: (filaSub.suspension_reason as string | null) ?? null,
        }
      : null,
    miembros: (miembros.data ?? []).map((m) => ({
      nombre: nombrePerfil.get(m.user_id) ?? null,
      correo: correos.get(m.user_id) ?? null,
      rol: m.role,
      estado: m.status,
    })),
    pagos: (pagos.data ?? []).map((c) => ({
      id: c.id,
      companyId: c.company_id,
      empresa: cliente.empresa,
      tipo: c.event_type,
      monto: c.amount_clp === null ? null : Number(c.amount_clp),
      estado: c.status,
      referencia: c.reference,
      detalle: c.notes,
      fecha: c.occurred_at,
    })),
    consumo: resumirConsumo(eventosConsumo, mesActualChile()),
    periodos: (periodos.data ?? []).map((p) => ({
      periodo: p.period,
      estado: p.status,
      fuente: p.data_source,
      actualizado: p.updated_at,
    })),
    actividad: (actividad.data ?? []).map((a) => ({
      accion: a.action,
      fecha: a.created_at,
      detalle: a.metadata ? JSON.stringify(a.metadata) : null,
    })),
    tickets: (tickets.data ?? []).map((t) => mapTicket(t, cliente.empresa, null)),
    notas: (notas.data ?? []).map((n) => ({
      id: n.id,
      cuerpo: n.body,
      autor: n.author_id ? (correos.get(n.author_id) ?? null) : null,
      fecha: n.created_at,
    })),
  };
}

export async function agregarNotaInterna(
  userId: string,
  entrada: { entidad: string; entidadId: string; companyId?: string | null; cuerpo: string },
) {
  await exigirAdmin(userId);
  const cuerpo = entrada.cuerpo.trim();
  if (cuerpo.length < 3) throw new ErrorNegocio("Escribe una observación más completa.");
  const { error } = await supabaseAdmin.from("tax_admin_notes").insert({
    entity_type: entrada.entidad,
    entity_id: entrada.entidadId,
    company_id: entrada.companyId ?? null,
    author_id: userId,
    body: cuerpo,
  });
  if (error) throw new ErrorNegocio("No pudimos guardar la observación.");
  await auditar(userId, "admin.note_added", entrada.companyId ?? null, {
    entidad: entrada.entidad,
  });
  return { ok: true as const };
}

/** Cambia el plan de una empresa desde el panel (acción administrativa). */
export async function cambiarPlanCliente(
  userId: string,
  entrada: { companyId: string; codigoPlan: string },
) {
  await exigirAdmin(userId);
  const { data: plan } = await supabaseAdmin
    .from("tax_plans")
    .select("id, code, name, price_clp")
    .eq("code", entrada.codigoPlan)
    .maybeSingle();
  if (!plan) throw new ErrorNegocio("El plan indicado no está disponible.");

  const { error } = await supabaseAdmin
    .from("tax_company_subscriptions")
    .update({
      plan_id: plan.id,
      status: plan.code === "prueba" ? "trial" : "active",
      suspended_at: null,
      suspension_reason: null,
      cancelled_at: null,
    })
    .eq("company_id", entrada.companyId);
  if (error) throw new ErrorNegocio("No pudimos cambiar el plan de esta empresa.");

  await supabaseAdmin.from("tax_billing_events").insert({
    company_id: entrada.companyId,
    event_type: "cambio_plan",
    amount_clp: plan.price_clp,
    status: "registrado",
    notes: `Cambio administrativo a ${plan.name}`,
  });
  await auditar(userId, "admin.plan_changed", entrada.companyId, { plan: plan.code });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// 3. Pagos y facturación (suscripciones de la plataforma, nunca el F29)
// ---------------------------------------------------------------------------

export interface PagosMaster {
  eventos: EventoPago[];
  suscripciones: {
    companyId: string;
    empresa: string;
    plan: string;
    estado: EstadoCuenta;
    proximaRenovacion: string | null;
    metodoPago: string | null;
    precio: number | null;
  }[];
  ingresos: { mes: string; monto: number }[];
  totales: {
    aprobados: number;
    pendientes: number;
    fallidos: number;
    vencidos: number;
    cancelaciones: number;
    ingresosMes: number;
  };
}

export async function pagosMaster(userId: string): Promise<PagosMaster> {
  await exigirAdmin(userId);
  const mes = mesActualChile();

  const [empresas, cobros, subs] = await Promise.all([
    supabaseAdmin.from("tax_companies").select("id, business_name"),
    supabaseAdmin
      .from("tax_billing_events")
      .select("id, company_id, event_type, amount_clp, status, reference, notes, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("tax_company_subscriptions")
      .select(
        "company_id, status, next_renewal_at, payment_method_label, plan:tax_plans(name, price_clp)",
      ),
  ]);

  const nombres = new Map((empresas.data ?? []).map((e) => [e.id, e.business_name]));
  const eventos: EventoPago[] = (cobros.data ?? []).map((c) => ({
    id: c.id,
    companyId: c.company_id,
    empresa: nombres.get(c.company_id) ?? "Empresa",
    tipo: c.event_type,
    monto: c.amount_clp === null ? null : Number(c.amount_clp),
    estado: c.status,
    referencia: c.reference,
    detalle: c.notes,
    fecha: c.occurred_at,
  }));

  const contar = (estado: string) => eventos.filter((e) => e.estado === estado).length;

  return {
    eventos,
    suscripciones: (subs.data ?? []).map((s) => {
      const plan = s.plan as { name: string; price_clp: number | null } | null;
      return {
        companyId: s.company_id,
        empresa: nombres.get(s.company_id) ?? "Empresa",
        plan: plan?.name ?? "Sin plan",
        estado: s.status as EstadoCuenta,
        proximaRenovacion: s.next_renewal_at,
        metodoPago: s.payment_method_label,
        precio: plan?.price_clp === null || plan?.price_clp === undefined ? null : Number(plan.price_clp),
      };
    }),
    ingresos: serieIngresos(eventos, ultimosMeses(6, mes)),
    totales: {
      aprobados: contar("aprobado"),
      pendientes: contar("pendiente"),
      fallidos: contar("fallido"),
      vencidos: contar("vencido"),
      cancelaciones: eventos.filter((e) => e.tipo === "cancelacion").length,
      ingresosMes: eventos
        .filter((e) => e.estado === "aprobado" && e.fecha.slice(0, 7) === mes)
        .reduce((a, e) => a + (e.monto ?? 0), 0),
    },
  };
}

export async function registrarPagoManual(
  userId: string,
  entrada: {
    companyId: string;
    monto: number;
    referencia?: string | null;
    detalle?: string | null;
  },
) {
  await exigirAdmin(userId);
  if (!Number.isFinite(entrada.monto) || entrada.monto <= 0)
    throw new ErrorNegocio("Ingresa un monto válido.");
  const { error } = await supabaseAdmin.from("tax_billing_events").insert({
    company_id: entrada.companyId,
    event_type: "pago_manual",
    amount_clp: Math.round(entrada.monto),
    status: "aprobado",
    reference: entrada.referencia?.trim() || null,
    notes: entrada.detalle?.trim() || "Pago de suscripción registrado manualmente.",
  });
  if (error) throw new ErrorNegocio("No pudimos registrar el pago.");
  await auditar(userId, "admin.payment_registered", entrada.companyId, {
    monto: entrada.monto,
  });
  return { ok: true as const };
}

export async function cambiarEstadoPago(
  userId: string,
  entrada: { eventoId: string; estado: string },
) {
  await exigirAdmin(userId);
  const { data, error } = await supabaseAdmin
    .from("tax_billing_events")
    .update({ status: entrada.estado })
    .eq("id", entrada.eventoId)
    .select("company_id")
    .maybeSingle();
  if (error) throw new ErrorNegocio("No pudimos actualizar el pago.");
  await auditar(userId, "admin.payment_status_changed", data?.company_id ?? null, {
    estado: entrada.estado,
  });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// 4. Planes
// ---------------------------------------------------------------------------

export interface PlanMaster extends Plan {
  periodicidad: string;
  diasPrueba: number;
  caracteristicas: string[];
  visibleEnLanding: boolean;
  destacado: boolean;
  activo: boolean;
  empresasSuscritas: number;
}

export async function listarPlanesMaster(userId: string): Promise<PlanMaster[]> {
  await exigirAdmin(userId);
  const [planes, subs] = await Promise.all([
    supabaseAdmin.from("tax_plans").select("*").order("sort_order"),
    supabaseAdmin.from("tax_company_subscriptions").select("plan_id"),
  ]);
  const conteo = new Map<string, number>();
  for (const s of subs.data ?? [])
    conteo.set(s.plan_id, (conteo.get(s.plan_id) ?? 0) + 1);

  return (planes.data ?? []).map((f) => ({
    id: f.id,
    codigo: f.code,
    nombre: f.name,
    descripcion: f.description,
    maxEmpresas: f.max_companies,
    maxUsuarios: f.max_users,
    actualizacionesIncluidas: f.monthly_updates_included,
    periodosHistoricosIniciales: f.initial_history_periods,
    accesoContador: f.accountant_access,
    soporte: f.support_level,
    presupuestoGateway: Number(f.gateway_budget_units),
    precioClp: f.price_clp === null ? null : Number(f.price_clp),
    orden: f.sort_order,
    periodicidad: f.billing_period ?? "mensual",
    diasPrueba: f.trial_days ?? 30,
    caracteristicas: f.public_features ?? [],
    visibleEnLanding: f.is_public,
    destacado: f.is_featured,
    activo: f.is_active,
    empresasSuscritas: conteo.get(f.id) ?? 0,
  }));
}

export interface EntradaPlanMaster {
  id: string;
  nombre: string;
  descripcion: string;
  precioClp: number | null;
  periodicidad: string;
  diasPrueba: number;
  maxEmpresas: number;
  maxUsuarios: number;
  actualizacionesIncluidas: number;
  periodosHistoricosIniciales: number;
  accesoContador: boolean;
  soporte: string;
  presupuestoGateway: number;
  caracteristicas: string[];
  visibleEnLanding: boolean;
  destacado: boolean;
  activo: boolean;
  orden: number;
}

/**
 * Actualiza un plan completo. Los límites quedan disponibles de inmediato
 * para registro, suscripciones y landing porque todos leen `tax_plans`.
 */
export async function guardarPlanMaster(userId: string, entrada: EntradaPlanMaster) {
  await exigirAdmin(userId);
  if (!entrada.nombre.trim()) throw new ErrorNegocio("El plan necesita un nombre.");
  const { error } = await supabaseAdmin
    .from("tax_plans")
    .update({
      name: entrada.nombre.trim(),
      description: entrada.descripcion.trim() || null,
      price_clp: entrada.precioClp,
      billing_period: entrada.periodicidad.trim() || "mensual",
      trial_days: Math.max(0, Math.round(entrada.diasPrueba)),
      max_companies: Math.max(1, Math.round(entrada.maxEmpresas)),
      max_users: Math.max(1, Math.round(entrada.maxUsuarios)),
      monthly_updates_included: Math.max(0, Math.round(entrada.actualizacionesIncluidas)),
      initial_history_periods: Math.max(0, Math.round(entrada.periodosHistoricosIniciales)),
      accountant_access: entrada.accesoContador,
      support_level: entrada.soporte.trim() || "estandar",
      gateway_budget_units: Math.max(0, Math.round(entrada.presupuestoGateway)),
      public_features: entrada.caracteristicas.filter((c) => c.trim().length > 0),
      is_public: entrada.visibleEnLanding,
      is_featured: entrada.destacado,
      is_active: entrada.activo,
      sort_order: Math.round(entrada.orden),
    })
    .eq("id", entrada.id);
  if (error) throw new ErrorNegocio("No pudimos guardar el plan.");
  if (entrada.destacado)
    await supabaseAdmin.from("tax_plans").update({ is_featured: false }).neq("id", entrada.id);
  await auditar(userId, "admin.plan_updated", null, { plan: entrada.id });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// 5. Créditos API y consumo
// ---------------------------------------------------------------------------

export interface ConsumoMaster {
  global: ResumenConsumo;
  presupuestoTotal: number;
  porcentajeUtilizado: number;
  porEmpresa: {
    companyId: string;
    empresa: string;
    plan: string;
    resumen: ResumenConsumo;
    presupuesto: number;
    porcentaje: number;
    alertas: { tipo: string; severidad: string; mensaje: string }[];
  }[];
  movimientos: {
    id: string;
    empresa: string;
    companyId: string;
    categoria: string;
    periodo: string | null;
    mes: string;
    consultas: number;
    cacheHits: number;
    errores: number;
    unidades: number;
    fecha: string;
  }[];
  mesesDisponibles: string[];
}

export async function consumoMaster(
  userId: string,
  filtros: { mes?: string | null; companyId?: string | null; categoria?: string | null },
): Promise<ConsumoMaster> {
  await exigirAdmin(userId);
  const mes = filtros.mes ?? mesActualChile();

  const [empresas, subs, uso] = await Promise.all([
    supabaseAdmin.from("tax_companies").select("id, business_name"),
    supabaseAdmin
      .from("tax_company_subscriptions")
      .select("company_id, plan:tax_plans(name, gateway_budget_units)"),
    supabaseAdmin
      .from("tax_usage_ledger")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(2000),
  ]);

  const nombres = new Map((empresas.data ?? []).map((e) => [e.id, e.business_name]));
  const planPorEmpresa = new Map(
    (subs.data ?? []).map((s) => [
      s.company_id,
      s.plan as { name: string; gateway_budget_units: number } | null,
    ]),
  );

  const filas = (uso.data ?? []).filter(
    (f) =>
      (!filtros.companyId || f.company_id === filtros.companyId) &&
      (!filtros.categoria || f.category === filtros.categoria),
  );

  const evento = (f: (typeof filas)[number]): EventoConsumo => ({
    categoria: f.category as CategoriaConsumo,
    consultas: f.requests,
    cacheHits: f.cache_hits,
    errores: f.errors,
    pdfsNuevos: f.new_pdfs,
    unidades: Number(f.cost_units),
    fueraDeFlujo: f.outside_economic_flow,
    periodo: f.period,
    mes: f.usage_month,
  });

  const global = resumirConsumo(filas.map(evento), mes);
  const companyIds = [...new Set(filas.map((f) => f.company_id))];

  const porEmpresa = companyIds.map((id) => {
    const resumen = resumirConsumo(
      filas.filter((f) => f.company_id === id).map(evento),
      mes,
    );
    const plan = planPorEmpresa.get(id) ?? null;
    const presupuesto = Number(plan?.gateway_budget_units ?? 0);
    return {
      companyId: id,
      empresa: nombres.get(id) ?? "Empresa",
      plan: plan?.name ?? "Sin plan",
      resumen,
      presupuesto,
      porcentaje: presupuesto > 0 ? Math.round((resumen.unidadesTotales / presupuesto) * 100) : 0,
      alertas: detectarAlertasConsumo(resumen, { presupuesto }).map((a) => ({
        tipo: a.tipo,
        severidad: a.severidad,
        mensaje: a.mensaje,
      })),
    };
  });

  const presupuestoTotal = porEmpresa.reduce((a, e) => a + e.presupuesto, 0);

  return {
    global,
    presupuestoTotal,
    porcentajeUtilizado:
      presupuestoTotal > 0
        ? Math.round((global.unidadesTotales / presupuestoTotal) * 100)
        : 0,
    porEmpresa: porEmpresa.sort((a, b) => b.resumen.unidadesTotales - a.resumen.unidadesTotales),
    movimientos: filas
      .filter((f) => f.usage_month === mes)
      .slice(0, 200)
      .map((f) => ({
        id: f.id,
        empresa: nombres.get(f.company_id) ?? "Empresa",
        companyId: f.company_id,
        categoria: f.category,
        periodo: f.period,
        mes: f.usage_month,
        consultas: f.requests,
        cacheHits: f.cache_hits,
        errores: f.errors,
        unidades: Number(f.cost_units),
        fecha: f.occurred_at,
      })),
    mesesDisponibles: [...new Set((uso.data ?? []).map((f) => f.usage_month))].sort(
      (a, b) => b.localeCompare(a),
    ),
  };
}

// ---------------------------------------------------------------------------
// 6. Métricas
// ---------------------------------------------------------------------------

export interface MetricasMaster {
  usuariosActivos: number;
  empresasActivas: number;
  nuevasAltas: number;
  tasaConversion: number;
  cancelaciones: number;
  retencion: number;
  ingresoMensual: number;
  usoPromedio: number;
  errores: number;
  usoCache: number;
  clientesSinActividad: number;
  planes: { codigo: string; nombre: string }[];
}

export async function metricasMaster(
  userId: string,
  filtros: { desde?: string | null; hasta?: string | null; planCodigo?: string | null },
): Promise<MetricasMaster> {
  await exigirAdmin(userId);
  const desde = filtros.desde ? new Date(filtros.desde) : new Date("2000-01-01");
  const hasta = filtros.hasta ? new Date(`${filtros.hasta}T23:59:59`) : new Date();
  const dentro = (fecha: string | null | undefined) => {
    if (!fecha) return false;
    const t = new Date(fecha).getTime();
    return t >= desde.getTime() && t <= hasta.getTime();
  };

  const [empresas, subs, uso, corridas, miembros, planes] = await Promise.all([
    supabaseAdmin.from("tax_companies").select("id, created_at, last_sync_at"),
    supabaseAdmin
      .from("tax_company_subscriptions")
      .select("company_id, status, cancelled_at, plan:tax_plans(code, name, price_clp)"),
    supabaseAdmin.from("tax_usage_ledger").select("company_id, requests, cache_hits, errors, occurred_at"),
    supabaseAdmin.from("tax_sync_runs").select("status, started_at").limit(1000),
    supabaseAdmin.from("tax_company_members").select("company_id, user_id, status").eq("status", "active"),
    supabaseAdmin.from("tax_plans").select("code, name").order("sort_order"),
  ]);

  const subPorEmpresa = new Map(
    (subs.data ?? []).map((s) => [
      s.company_id,
      { ...s, plan: s.plan as { code: string; name: string; price_clp: number | null } | null },
    ]),
  );

  const empresasFiltradas = (empresas.data ?? []).filter((e) => {
    const sub = subPorEmpresa.get(e.id);
    if (filtros.planCodigo && sub?.plan?.code !== filtros.planCodigo) return false;
    return true;
  });
  const ids = new Set(empresasFiltradas.map((e) => e.id));

  const activas = empresasFiltradas.filter(
    (e) => subPorEmpresa.get(e.id)?.status === "active",
  );
  const canceladas = empresasFiltradas.filter((e) =>
    dentro(subPorEmpresa.get(e.id)?.cancelled_at ?? null),
  );
  const usoFiltrado = (uso.data ?? []).filter(
    (u) => ids.has(u.company_id) && dentro(u.occurred_at),
  );

  return {
    usuariosActivos: new Set(
      (miembros.data ?? []).filter((m) => ids.has(m.company_id)).map((m) => m.user_id),
    ).size,
    empresasActivas: activas.length,
    nuevasAltas: empresasFiltradas.filter((e) => dentro(e.created_at)).length,
    tasaConversion: tasaConversion(activas.length, empresasFiltradas.length),
    cancelaciones: canceladas.length,
    retencion: tasaRetencion(
      empresasFiltradas.length - canceladas.length,
      empresasFiltradas.length,
    ),
    ingresoMensual: activas.reduce(
      (a, e) => a + Number(subPorEmpresa.get(e.id)?.plan?.price_clp ?? 0),
      0,
    ),
    usoPromedio: empresasFiltradas.length
      ? Math.round(
          (usoFiltrado.reduce((a, u) => a + u.requests, 0) / empresasFiltradas.length) * 10,
        ) / 10
      : 0,
    errores: (corridas.data ?? []).filter((c) => c.status === "failed" && dentro(c.started_at))
      .length,
    usoCache: usoFiltrado.reduce((a, u) => a + u.cache_hits, 0),
    clientesSinActividad: empresasFiltradas.filter((e) => !e.last_sync_at).length,
    planes: (planes.data ?? []).map((p) => ({ codigo: p.code, nombre: p.name })),
  };
}

// ---------------------------------------------------------------------------
// 7. Comunicación
// ---------------------------------------------------------------------------

type FilaComunicado = {
  id: string;
  title: string;
  body: string;
  kind: string;
  priority: string;
  starts_at: string;
  ends_at: string | null;
  is_visible: boolean;
  button_label: string | null;
  button_url: string | null;
  audience: string;
  audience_plan_code: string | null;
  audience_company_id: string | null;
  published_at: string | null;
  created_at: string;
};

function mapComunicado(
  f: FilaComunicado,
  vistos: number,
  cerrados: number,
): Comunicado {
  return {
    id: f.id,
    titulo: f.title,
    mensaje: f.body,
    tipo: f.kind as TipoComunicado,
    prioridad: f.priority as PrioridadComunicado,
    inicia: f.starts_at,
    termina: f.ends_at,
    visible: f.is_visible,
    textoBoton: f.button_label,
    enlaceBoton: f.button_url,
    audiencia: f.audience as AudienciaComunicado,
    planAudiencia: f.audience_plan_code,
    empresaAudiencia: f.audience_company_id,
    publicado: f.published_at,
    creado: f.created_at,
    vistos,
    cerrados,
  };
}

export interface ComunicacionMaster {
  comunicados: Comunicado[];
  planes: { codigo: string; nombre: string }[];
  empresas: { id: string; nombre: string }[];
}

export async function comunicacionMaster(userId: string): Promise<ComunicacionMaster> {
  await exigirAdmin(userId);
  const [avisos, eventos, planes, empresas] = await Promise.all([
    supabaseAdmin
      .from("tax_announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin.from("tax_announcement_events").select("announcement_id, event_type"),
    supabaseAdmin.from("tax_plans").select("code, name").order("sort_order"),
    supabaseAdmin.from("tax_companies").select("id, business_name").order("business_name"),
  ]);

  const contar = (id: string, tipo: string) =>
    (eventos.data ?? []).filter((e) => e.announcement_id === id && e.event_type === tipo)
      .length;

  return {
    comunicados: ((avisos.data ?? []) as unknown as FilaComunicado[]).map((f) =>
      mapComunicado(f, contar(f.id, "visto"), contar(f.id, "cerrado")),
    ),
    planes: (planes.data ?? []).map((p) => ({ codigo: p.code, nombre: p.name })),
    empresas: (empresas.data ?? []).map((e) => ({ id: e.id, nombre: e.business_name })),
  };
}

export interface EntradaComunicado {
  id?: string | null;
  titulo: string;
  mensaje: string;
  tipo: TipoComunicado;
  prioridad: PrioridadComunicado;
  inicia: string;
  termina: string | null;
  visible: boolean;
  textoBoton: string | null;
  enlaceBoton: string | null;
  audiencia: AudienciaComunicado;
  planAudiencia: string | null;
  empresaAudiencia: string | null;
}

export async function guardarComunicado(userId: string, entrada: EntradaComunicado) {
  await exigirAdmin(userId);
  if (!entrada.titulo.trim() || !entrada.mensaje.trim())
    throw new ErrorNegocio("El título y el mensaje son obligatorios.");
  if (entrada.audiencia === "plan" && !entrada.planAudiencia)
    throw new ErrorNegocio("Selecciona el plan que recibirá el mensaje.");
  if (entrada.audiencia === "empresa" && !entrada.empresaAudiencia)
    throw new ErrorNegocio("Selecciona la empresa que recibirá el mensaje.");

  const fila = {
    title: entrada.titulo.trim(),
    body: entrada.mensaje.trim(),
    kind: entrada.tipo,
    priority: entrada.prioridad,
    starts_at: entrada.inicia,
    ends_at: entrada.termina,
    is_visible: entrada.visible,
    button_label: entrada.textoBoton?.trim() || null,
    button_url: entrada.enlaceBoton?.trim() || null,
    audience: entrada.audiencia,
    audience_plan_code: entrada.audiencia === "plan" ? entrada.planAudiencia : null,
    audience_company_id: entrada.audiencia === "empresa" ? entrada.empresaAudiencia : null,
    published_at: entrada.visible ? new Date().toISOString() : null,
    created_by: userId,
  };

  const { error } = entrada.id
    ? await supabaseAdmin.from("tax_announcements").update(fila).eq("id", entrada.id)
    : await supabaseAdmin.from("tax_announcements").insert(fila);
  if (error) throw new ErrorNegocio("No pudimos guardar el comunicado.");
  await auditar(userId, entrada.id ? "admin.announcement_updated" : "admin.announcement_created", null, {
    audiencia: entrada.audiencia,
    visible: entrada.visible,
  });
  return { ok: true as const };
}

export async function eliminarComunicado(userId: string, id: string) {
  await exigirAdmin(userId);
  const { error } = await supabaseAdmin.from("tax_announcements").delete().eq("id", id);
  if (error) throw new ErrorNegocio("No pudimos eliminar el comunicado.");
  await auditar(userId, "admin.announcement_deleted", null, { id });
  return { ok: true as const };
}

/** Comunicados vigentes para un cliente concreto (lectura desde la app). */
export async function comunicadosParaEmpresa(companyId: string | null) {
  const { data } = await supabaseAdmin
    .from("tax_announcements")
    .select("*")
    .eq("is_visible", true)
    .order("priority", { ascending: false })
    .limit(50);

  let estado: EstadoCuenta = "trial";
  let planCodigo: string | null = null;
  if (companyId) {
    const { data: sub } = await supabaseAdmin
      .from("tax_company_subscriptions")
      .select("status, plan:tax_plans(code)")
      .eq("company_id", companyId)
      .maybeSingle();
    if (sub) {
      estado = sub.status as EstadoCuenta;
      planCodigo = (sub.plan as { code: string } | null)?.code ?? null;
    }
  }

  const { comunicadoAplica } = await import("@/lib/master");
  return ((data ?? []) as unknown as FilaComunicado[])
    .map((f) => mapComunicado(f, 0, 0))
    .filter((c) => comunicadoAplica(c, { estadoCuenta: estado, planCodigo, companyId }));
}

export async function registrarEventoComunicado(
  userId: string,
  entrada: { comunicadoId: string; companyId: string | null; tipo: "visto" | "cerrado" },
) {
  await supabaseAdmin.from("tax_announcement_events").insert({
    announcement_id: entrada.comunicadoId,
    user_id: userId,
    company_id: entrada.companyId,
    event_type: entrada.tipo,
  });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// 10. Soporte y actividad
// ---------------------------------------------------------------------------

export interface TicketMaster {
  id: string;
  companyId: string | null;
  empresa: string | null;
  correo: string | null;
  categoria: string;
  periodo: string | null;
  mensaje: string;
  estado: string;
  prioridad: string;
  creado: string;
  resuelto: string | null;
}

function mapTicket(
  t: Record<string, unknown>,
  empresa: string | null,
  correo: string | null,
): TicketMaster {
  return {
    id: t.id as string,
    companyId: (t.company_id as string | null) ?? null,
    empresa,
    correo,
    categoria: t.category as string,
    periodo: (t.period as string | null) ?? null,
    mensaje: t.message as string,
    estado: (t.status as string) ?? "abierto",
    prioridad: (t.priority as string) ?? "normal",
    creado: t.created_at as string,
    resuelto: (t.resolved_at as string | null) ?? null,
  };
}

export interface SoporteMaster {
  tickets: TicketMaster[];
  actividad: {
    id: string;
    empresa: string | null;
    accion: string;
    fecha: string;
    detalle: string | null;
  }[];
  solicitudes: {
    id: string;
    empresa: string | null;
    tipo: string;
    estado: string;
    motivo: string | null;
    fecha: string;
  }[];
  errores: {
    id: string;
    empresa: string | null;
    estado: string;
    mensaje: string | null;
    fecha: string;
  }[];
  notas: NotaInterna[];
}

export async function soporteMaster(userId: string): Promise<SoporteMaster> {
  await exigirAdmin(userId);
  const [tickets, logs, solicitudes, corridas, empresas, notas, correos] =
    await Promise.all([
      supabaseAdmin
        .from("tax_support_tickets")
        .select("id, company_id, user_id, category, period, message, status, priority, created_at, resolved_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("tax_activity_logs")
        .select("id, company_id, action, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("tax_data_requests")
        .select("id, company_id, kind, status, reason, requested_at")
        .order("requested_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("tax_sync_runs")
        .select("id, company_id, status, error_message, started_at")
        .eq("status", "failed")
        .order("started_at", { ascending: false })
        .limit(100),
      supabaseAdmin.from("tax_companies").select("id, business_name"),
      supabaseAdmin
        .from("tax_admin_notes")
        .select("id, body, author_id, created_at, entity_type")
        .eq("entity_type", "ticket")
        .order("created_at", { ascending: false })
        .limit(200),
      correosPorUsuario(),
    ]);

  const nombres = new Map((empresas.data ?? []).map((e) => [e.id, e.business_name]));

  return {
    tickets: (tickets.data ?? []).map((t) =>
      mapTicket(
        t,
        t.company_id ? (nombres.get(t.company_id) ?? null) : null,
        correos.get(t.user_id) ?? null,
      ),
    ),
    actividad: (logs.data ?? []).map((l) => ({
      id: l.id,
      empresa: l.company_id ? (nombres.get(l.company_id) ?? null) : null,
      accion: l.action,
      fecha: l.created_at,
      detalle: l.metadata ? JSON.stringify(l.metadata) : null,
    })),
    solicitudes: (solicitudes.data ?? []).map((s) => ({
      id: s.id,
      empresa: nombres.get(s.company_id) ?? null,
      tipo: s.kind,
      estado: s.status,
      motivo: s.reason,
      fecha: s.requested_at,
    })),
    errores: (corridas.data ?? []).map((c) => ({
      id: c.id,
      empresa: c.company_id ? (nombres.get(c.company_id) ?? null) : null,
      estado: c.status,
      mensaje: c.error_message,
      fecha: c.started_at,
    })),
    notas: (notas.data ?? []).map((n) => ({
      id: n.id,
      cuerpo: n.body,
      autor: n.author_id ? (correos.get(n.author_id) ?? null) : null,
      fecha: n.created_at,
    })),
  };
}

export async function actualizarTicket(
  userId: string,
  entrada: { ticketId: string; estado?: string | null; prioridad?: string | null },
) {
  await exigirAdmin(userId);
  const cambios: {
    status?: string;
    resolved_at?: string | null;
    priority?: string;
  } = {};
  if (entrada.estado) {
    cambios.status = entrada.estado;
    cambios.resolved_at =
      entrada.estado === "resuelto" || entrada.estado === "cerrado"
        ? new Date().toISOString()
        : null;
  }
  if (entrada.prioridad) cambios.priority = entrada.prioridad;
  if (Object.keys(cambios).length === 0) return { ok: true as const };

  const { data, error } = await supabaseAdmin
    .from("tax_support_tickets")
    .update(cambios)
    .eq("id", entrada.ticketId)
    .select("company_id")
    .maybeSingle();
  if (error) throw new ErrorNegocio("No pudimos actualizar el ticket.");
  await auditar(userId, "admin.ticket_updated", data?.company_id ?? null, {
    estado: cambios.status ?? null,
    prioridad: cambios.priority ?? null,
  });
  return { ok: true as const };
}
