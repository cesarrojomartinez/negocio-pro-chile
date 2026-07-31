/**
 * Operación comercial: planes, estado de cuenta, límites, invitaciones,
 * control de costos, soporte y panel de administración.
 *
 * No toca el motor tributario ni realiza consultas al SII o al API Gateway.
 * Nunca almacena ni devuelve claves tributarias.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ErrorNegocio, exigirRol, registrarActividad } from "@/lib/companies.server";
import {
  evaluarLimiteActualizaciones,
  mesActualChile,
  permisosPorEstado,
  type EstadoCuenta,
  type EvaluacionLimite,
  type Plan,
  type Suscripcion,
} from "@/lib/cuenta";
import {
  detectarAlertasConsumo,
  resumirConsumo,
  type CategoriaConsumo,
  type EventoConsumo,
  type ResumenConsumo,
} from "@/lib/costos";
import { evaluarInvitacion, fechaCaducidad, correoValido } from "@/lib/invitaciones";
import { capacidades, type CapacidadesRol, type RolEmpresa } from "@/lib/permisos";
import { prepararReporte, type CategoriaSoporte } from "@/lib/soporte";

type FilaPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  max_companies: number;
  max_users: number;
  monthly_updates_included: number;
  initial_history_periods: number;
  accountant_access: boolean;
  support_level: string;
  gateway_budget_units: number | string;
  price_clp: number | string | null;
  sort_order: number;
};

function mapPlan(f: FilaPlan): Plan {
  return {
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
  };
}

export async function listarPlanes(): Promise<Plan[]> {
  const { data, error } = await supabaseAdmin
    .from("tax_plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new ErrorNegocio("No pudimos cargar los planes.");
  return (data ?? []).map((f) => mapPlan(f as unknown as FilaPlan));
}

async function planPorCodigo(codigo: string): Promise<Plan> {
  const { data } = await supabaseAdmin
    .from("tax_plans")
    .select("*")
    .eq("code", codigo)
    .maybeSingle();
  if (!data) throw new ErrorNegocio("El plan indicado no está disponible.");
  return mapPlan(data as unknown as FilaPlan);
}

/** Devuelve la suscripción de la empresa; si no existe, crea una de prueba. */
export async function asegurarSuscripcion(companyId: string): Promise<Suscripcion> {
  const { data } = await supabaseAdmin
    .from("tax_company_subscriptions")
    .select("*, plan:tax_plans(*)")
    .eq("company_id", companyId)
    .maybeSingle();

  if (data) return mapSuscripcion(data);

  const prueba = await planPorCodigo("prueba");
  const ahora = new Date();
  const fin = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: creada, error } = await supabaseAdmin
    .from("tax_company_subscriptions")
    .insert({
      company_id: companyId,
      plan_id: prueba.id,
      status: "trial",
      trial_ends_at: fin,
      next_renewal_at: fin,
      usage_month: mesActualChile(ahora),
      updates_used: 0,
    })
    .select("*, plan:tax_plans(*)")
    .single();
  if (error || !creada) throw new ErrorNegocio("No pudimos preparar tu plan.");
  return mapSuscripcion(creada);
}

type FilaSuscripcion = {
  id: string;
  company_id: string;
  status: EstadoCuenta;
  started_at: string;
  trial_ends_at: string | null;
  next_renewal_at: string | null;
  payment_method_label: string | null;
  cancelled_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  usage_month: string | null;
  updates_used: number;
  plan: FilaPlan;
};

function mapSuscripcion(fila: unknown): Suscripcion {
  const f = fila as FilaSuscripcion;
  return {
    id: f.id,
    companyId: f.company_id,
    plan: mapPlan(f.plan),
    estado: f.status,
    inicio: f.started_at,
    finPrueba: f.trial_ends_at,
    proximaRenovacion: f.next_renewal_at,
    metodoPago: f.payment_method_label,
    canceladaEl: f.cancelled_at,
    suspendidaEl: f.suspended_at,
    motivoSuspension: f.suspension_reason,
    mesUso: f.usage_month,
    actualizacionesUsadas: f.updates_used,
  };
}

export async function rolEnEmpresa(
  userId: string,
  companyId: string,
): Promise<RolEmpresa> {
  const { data } = await supabaseAdmin
    .from("tax_company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) throw new ErrorNegocio("No tienes acceso a esta empresa.");
  return data.role as RolEmpresa;
}

export interface ResumenCuenta {
  suscripcion: Suscripcion;
  rol: RolEmpresa;
  capacidades: CapacidadesRol;
  limite: EvaluacionLimite;
  consumoMes: ResumenConsumo;
  mensajeEstado: string;
}

export async function resumenCuenta(
  userId: string,
  companyId: string,
): Promise<ResumenCuenta> {
  const rol = await rolEnEmpresa(userId, companyId);
  const suscripcion = await asegurarSuscripcion(companyId);
  const mes = mesActualChile();
  const consumoMes = await consumoDeEmpresa(companyId, mes);

  return {
    suscripcion,
    rol,
    capacidades: capacidades(rol, suscripcion.estado),
    limite: evaluarLimiteActualizaciones({
      estado: suscripcion.estado,
      incluidas: suscripcion.plan.actualizacionesIncluidas,
      usadas: suscripcion.actualizacionesUsadas,
      mesUso: suscripcion.mesUso,
      mesActual: mes,
    }),
    consumoMes,
    mensajeEstado: permisosPorEstado(suscripcion.estado).mensaje,
  };
}

// ---------------------------------------------------------------------------
// Control de costos
// ---------------------------------------------------------------------------

export async function consumoDeEmpresa(
  companyId: string,
  mes: string,
): Promise<ResumenConsumo> {
  const { data } = await supabaseAdmin
    .from("tax_usage_ledger")
    .select("*")
    .eq("company_id", companyId)
    .order("occurred_at", { ascending: false })
    .limit(500);

  const eventos: EventoConsumo[] = (data ?? []).map((f) => ({
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

  return resumirConsumo(eventos, mes);
}

/**
 * Registra el consumo comercial de una actualización y descuenta una
 * actualización incluida del mes. No cambia la política de créditos:
 * solo deja trazabilidad para el administrador.
 */
export async function registrarUsoComercial(entrada: {
  companyId: string;
  categoria: CategoriaConsumo;
  periodo?: string | null;
  consultas: number;
  cacheHits?: number;
  errores?: number;
  pdfsNuevos?: number;
  unidades: number;
  syncRunId?: string | null;
  fueraDeFlujo?: boolean;
  descuentaActualizacion?: boolean;
}) {
  const mes = mesActualChile();
  try {
    await supabaseAdmin.from("tax_usage_ledger").insert({
      company_id: entrada.companyId,
      usage_month: mes,
      category: entrada.categoria,
      period: entrada.periodo ?? null,
      requests: entrada.consultas,
      cache_hits: entrada.cacheHits ?? 0,
      errors: entrada.errores ?? 0,
      new_pdfs: entrada.pdfsNuevos ?? 0,
      cost_units: entrada.unidades,
      sync_run_id: entrada.syncRunId ?? null,
      outside_economic_flow: entrada.fueraDeFlujo ?? false,
    });

    if (entrada.descuentaActualizacion !== false && entrada.consultas > 0) {
      const suscripcion = await asegurarSuscripcion(entrada.companyId);
      const usadas =
        suscripcion.mesUso === mes ? suscripcion.actualizacionesUsadas + 1 : 1;
      await supabaseAdmin
        .from("tax_company_subscriptions")
        .update({ usage_month: mes, updates_used: usadas })
        .eq("company_id", entrada.companyId);
    }

    await evaluarAlertasDeConsumo(entrada.companyId, mes);
  } catch (error) {
    // El registro comercial nunca puede interrumpir una actualización.
    console.error("[consumo]", error);
  }
}

async function evaluarAlertasDeConsumo(companyId: string, mes: string) {
  const suscripcion = await asegurarSuscripcion(companyId);
  const resumen = await consumoDeEmpresa(companyId, mes);
  const alertas = detectarAlertasConsumo(resumen, {
    presupuesto: suscripcion.plan.presupuestoGateway,
  });
  if (alertas.length === 0) return;

  const { data: existentes } = await supabaseAdmin
    .from("tax_admin_alerts")
    .select("kind")
    .eq("company_id", companyId)
    .is("resolved_at", null);
  const vigentes = new Set((existentes ?? []).map((a) => a.kind));

  const nuevas = alertas
    .filter((a) => !vigentes.has(a.tipo))
    .map((a) => ({
      company_id: companyId,
      kind: a.tipo,
      severity: a.severidad,
      message: a.mensaje,
      details: { mes },
    }));
  if (nuevas.length > 0) await supabaseAdmin.from("tax_admin_alerts").insert(nuevas);
}

/** Verifica el límite antes de permitir una actualización real. */
export async function exigirActualizacionDisponible(companyId: string) {
  const suscripcion = await asegurarSuscripcion(companyId);
  const evaluacion = evaluarLimiteActualizaciones({
    estado: suscripcion.estado,
    incluidas: suscripcion.plan.actualizacionesIncluidas,
    usadas: suscripcion.actualizacionesUsadas,
    mesUso: suscripcion.mesUso,
    mesActual: mesActualChile(),
  });
  if (!evaluacion.permitido) throw new ErrorNegocio(evaluacion.mensaje);
  return evaluacion;
}

// ---------------------------------------------------------------------------
// Plan y suscripción
// ---------------------------------------------------------------------------

export async function cambiarPlan(
  userId: string,
  companyId: string,
  codigoPlan: string,
) {
  await exigirRol(userId, companyId, ["owner"]);
  const plan = await planPorCodigo(codigoPlan);
  const ahora = new Date();
  const renovacion = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await asegurarSuscripcion(companyId);
  const { error } = await supabaseAdmin
    .from("tax_company_subscriptions")
    .update({
      plan_id: plan.id,
      status: plan.codigo === "prueba" ? "trial" : "active",
      next_renewal_at: renovacion,
      cancelled_at: null,
      suspended_at: null,
      suspension_reason: null,
    })
    .eq("company_id", companyId);
  if (error) throw new ErrorNegocio("No pudimos cambiar tu plan.");

  await supabaseAdmin.from("tax_billing_events").insert({
    company_id: companyId,
    event_type: "cambio_plan",
    amount_clp: plan.precioClp,
    status: "registrado",
    notes: `Plan ${plan.nombre}`,
  });
  await registrarActividad(companyId, userId, "plan.changed", "tax_company_subscriptions", {
    plan: plan.codigo,
  });
  return asegurarSuscripcion(companyId);
}

export async function cancelarSuscripcion(userId: string, companyId: string) {
  await exigirRol(userId, companyId, ["owner"]);
  const { error } = await supabaseAdmin
    .from("tax_company_subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("company_id", companyId);
  if (error) throw new ErrorNegocio("No pudimos registrar la cancelación.");
  await supabaseAdmin.from("tax_billing_events").insert({
    company_id: companyId,
    event_type: "cancelacion",
    status: "registrado",
    notes: "Cancelación solicitada por el propietario. La información se conserva.",
  });
  await registrarActividad(companyId, userId, "plan.cancelled", "tax_company_subscriptions");
  return asegurarSuscripcion(companyId);
}

export async function reactivarSuscripcion(userId: string, companyId: string) {
  await exigirRol(userId, companyId, ["owner"]);
  const { error } = await supabaseAdmin
    .from("tax_company_subscriptions")
    .update({
      status: "active",
      cancelled_at: null,
      suspended_at: null,
      suspension_reason: null,
    })
    .eq("company_id", companyId);
  if (error) throw new ErrorNegocio("No pudimos reactivar tu cuenta.");
  await registrarActividad(companyId, userId, "plan.reactivated", "tax_company_subscriptions");
  return asegurarSuscripcion(companyId);
}

export interface CobroHistorico {
  id: string;
  tipo: string;
  monto: number | null;
  estado: string;
  fecha: string;
  detalle: string | null;
}

export async function historialCobros(
  userId: string,
  companyId: string,
): Promise<CobroHistorico[]> {
  await rolEnEmpresa(userId, companyId);
  const { data } = await supabaseAdmin
    .from("tax_billing_events")
    .select("id, event_type, amount_clp, status, occurred_at, notes")
    .eq("company_id", companyId)
    .order("occurred_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((f) => ({
    id: f.id,
    tipo: f.event_type,
    monto: f.amount_clp === null ? null : Number(f.amount_clp),
    estado: f.status,
    fecha: f.occurred_at,
    detalle: f.notes,
  }));
}

// ---------------------------------------------------------------------------
// Miembros e invitaciones
// ---------------------------------------------------------------------------

async function hashToken(token: string): Promise<string> {
  const datos = new TextEncoder().encode(token);
  const buffer = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function nuevoToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface MiembroEmpresa {
  id: string;
  userId: string;
  rol: RolEmpresa;
  estado: string;
  correo: string | null;
  nombre: string | null;
  desde: string | null;
}

export async function listarMiembros(
  userId: string,
  companyId: string,
): Promise<MiembroEmpresa[]> {
  await rolEnEmpresa(userId, companyId);
  const { data } = await supabaseAdmin
    .from("tax_company_members")
    .select("id, user_id, role, status, joined_at, created_at")
    .eq("company_id", companyId)
    .neq("status", "removed");

  const ids = (data ?? []).map((m) => m.user_id);
  const { data: perfiles } = ids.length
    ? await supabaseAdmin.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] as { id: string; display_name: string | null }[] };
  const nombres = new Map((perfiles ?? []).map((p) => [p.id, p.display_name]));

  return (data ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    rol: m.role as RolEmpresa,
    estado: m.status,
    correo: null,
    nombre: nombres.get(m.user_id) ?? null,
    desde: m.joined_at ?? m.created_at,
  }));
}

export interface InvitacionEmpresa {
  id: string;
  correo: string;
  rol: RolEmpresa;
  estado: string;
  caduca: string;
  creada: string;
}

export async function listarInvitaciones(
  userId: string,
  companyId: string,
): Promise<InvitacionEmpresa[]> {
  await exigirRol(userId, companyId, ["owner", "business_user"]);
  const { data } = await supabaseAdmin
    .from("tax_company_invitations")
    .select("id, email, role, status, expires_at, created_at, accepted_at, revoked_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);

  const ahora = new Date();
  return (data ?? []).map((f) => {
    const evaluacion = evaluarInvitacion(
      {
        status: f.status,
        expiresAt: f.expires_at,
        acceptedAt: f.accepted_at,
        revokedAt: f.revoked_at,
      },
      ahora,
    );
    const estado = evaluacion.valida
      ? "pendiente"
      : evaluacion.motivo === "usada"
        ? "aceptada"
        : evaluacion.motivo === "revocada"
          ? "anulada"
          : "caducada";
    return {
      id: f.id,
      correo: f.email,
      rol: f.role as RolEmpresa,
      estado,
      caduca: f.expires_at,
      creada: f.created_at,
    };
  });
}

export async function invitarUsuario(
  userId: string,
  entrada: { companyId: string; correo: string; rol: RolEmpresa },
) {
  await exigirRol(userId, entrada.companyId, ["owner"]);
  if (entrada.rol === "owner")
    throw new ErrorNegocio("La propiedad de la empresa no se puede invitar.");
  const correo = entrada.correo.trim().toLowerCase();
  if (!correoValido(correo)) throw new ErrorNegocio("Revisa el correo ingresado.");

  const suscripcion = await asegurarSuscripcion(entrada.companyId);
  if (!permisosPorEstado(suscripcion.estado).puedeConfigurar)
    throw new ErrorNegocio(
      "Tu cuenta no permite invitar usuarios en este momento. Tu información guardada continúa disponible.",
    );

  const { count } = await supabaseAdmin
    .from("tax_company_members")
    .select("id", { count: "exact", head: true })
    .eq("company_id", entrada.companyId)
    .eq("status", "active");
  if ((count ?? 0) >= suscripcion.plan.maxUsuarios)
    throw new ErrorNegocio(
      `Tu plan ${suscripcion.plan.nombre} permite hasta ${suscripcion.plan.maxUsuarios} usuarios.`,
    );

  if (entrada.rol === "accountant" && !suscripcion.plan.accesoContador)
    throw new ErrorNegocio(
      `El acceso de contador está disponible en el plan Profesional.`,
    );

  const token = nuevoToken();
  const { error } = await supabaseAdmin.from("tax_company_invitations").insert({
    company_id: entrada.companyId,
    email: correo,
    role: entrada.rol,
    token_hash: await hashToken(token),
    expires_at: fechaCaducidad().toISOString(),
    invited_by: userId,
  });
  if (error) throw new ErrorNegocio("No pudimos crear la invitación.");

  await registrarActividad(entrada.companyId, userId, "member.invited", "tax_company_invitations", {
    rol: entrada.rol,
  });

  // El enlace se entrega una sola vez: el token no queda en texto plano.
  return { token };
}

export async function revocarInvitacion(
  userId: string,
  entrada: { companyId: string; invitacionId: string },
) {
  await exigirRol(userId, entrada.companyId, ["owner"]);
  const { error } = await supabaseAdmin
    .from("tax_company_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", entrada.invitacionId)
    .eq("company_id", entrada.companyId)
    .eq("status", "pending");
  if (error) throw new ErrorNegocio("No pudimos anular la invitación.");
  await registrarActividad(entrada.companyId, userId, "member.invite_revoked");
  return { ok: true };
}

export interface DetalleInvitacion {
  empresa: string;
  rol: RolEmpresa;
  correo: string;
  caduca: string;
}

export async function revisarInvitacion(token: string): Promise<DetalleInvitacion> {
  const hash = await hashToken(token);
  const { data } = await supabaseAdmin
    .from("tax_company_invitations")
    .select(
      "id, email, role, status, expires_at, accepted_at, revoked_at, company:tax_companies(business_name)",
    )
    .eq("token_hash", hash)
    .maybeSingle();
  if (!data) throw new ErrorNegocio("Esta invitación no existe.");

  const evaluacion = evaluarInvitacion({
    status: data.status,
    expiresAt: data.expires_at,
    acceptedAt: data.accepted_at,
    revokedAt: data.revoked_at,
  });
  if (!evaluacion.valida) throw new ErrorNegocio(evaluacion.mensaje);

  const empresa = data.company as { business_name: string } | null;
  return {
    empresa: empresa?.business_name ?? "Empresa",
    rol: data.role as RolEmpresa,
    correo: data.email,
    caduca: data.expires_at,
  };
}

export async function aceptarInvitacion(userId: string, token: string) {
  const hash = await hashToken(token);
  const { data } = await supabaseAdmin
    .from("tax_company_invitations")
    .select("id, company_id, role, status, expires_at, accepted_at, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!data) throw new ErrorNegocio("Esta invitación no existe.");

  const evaluacion = evaluarInvitacion({
    status: data.status,
    expiresAt: data.expires_at,
    acceptedAt: data.accepted_at,
    revokedAt: data.revoked_at,
  });
  if (!evaluacion.valida) throw new ErrorNegocio(evaluacion.mensaje);

  const { error: errorMiembro } = await supabaseAdmin
    .from("tax_company_members")
    .upsert(
      {
        company_id: data.company_id,
        user_id: userId,
        role: data.role,
        status: "active",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "company_id,user_id" },
    );
  if (errorMiembro) throw new ErrorNegocio("No pudimos completar tu acceso.");

  // Un solo uso: la invitación queda cerrada de inmediato.
  await supabaseAdmin
    .from("tax_company_invitations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq("id", data.id)
    .eq("status", "pending");

  await registrarActividad(data.company_id, userId, "member.joined", "tax_company_members", {
    rol: data.role,
  });
  return { companyId: data.company_id };
}

export async function cambiarRolUsuario(
  userId: string,
  entrada: { companyId: string; miembroId: string; rol: RolEmpresa },
) {
  await exigirRol(userId, entrada.companyId, ["owner"]);
  if (entrada.rol === "owner")
    throw new ErrorNegocio("La propiedad de la empresa no se puede traspasar aquí.");
  const { error } = await supabaseAdmin
    .from("tax_company_members")
    .update({ role: entrada.rol })
    .eq("id", entrada.miembroId)
    .eq("company_id", entrada.companyId)
    .neq("role", "owner");
  if (error) throw new ErrorNegocio("No pudimos cambiar el rol.");
  await registrarActividad(entrada.companyId, userId, "member.role_changed");
  return { ok: true };
}

export async function quitarUsuario(
  userId: string,
  entrada: { companyId: string; miembroId: string },
) {
  await exigirRol(userId, entrada.companyId, ["owner"]);
  const { error } = await supabaseAdmin
    .from("tax_company_members")
    .update({ status: "removed" })
    .eq("id", entrada.miembroId)
    .eq("company_id", entrada.companyId)
    .neq("role", "owner");
  if (error) throw new ErrorNegocio("No pudimos quitar el acceso.");
  await registrarActividad(entrada.companyId, userId, "member.removed");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Soporte
// ---------------------------------------------------------------------------

export async function crearTicketSoporte(
  userId: string,
  entrada: {
    companyId: string | null;
    periodo: string | null;
    categoria: CategoriaSoporte;
    mensaje: string;
    syncRunId: string | null;
    codigo: string | null;
    adjunto?: string | null;
  },
) {
  if (entrada.companyId) await rolEnEmpresa(userId, entrada.companyId);
  const limpio = prepararReporte({
    companyId: entrada.companyId,
    periodo: entrada.periodo,
    categoria: entrada.categoria,
    mensaje: entrada.mensaje,
    syncRunId: entrada.syncRunId,
    codigoSanitizado: entrada.codigo,
    adjunto: entrada.adjunto ?? null,
  });
  if (limpio.mensaje.length < 5)
    throw new ErrorNegocio("Cuéntanos brevemente qué ocurrió.");

  const { data, error } = await supabaseAdmin
    .from("tax_support_tickets")
    .insert({
      company_id: limpio.companyId,
      user_id: userId,
      category: limpio.categoria,
      period: limpio.periodo,
      message: limpio.mensaje,
      sanitized_code: limpio.codigoSanitizado,
      sync_run_id: limpio.syncRunId,
      attachment_path: limpio.adjunto,
    })
    .select("id")
    .single();
  if (error || !data) throw new ErrorNegocio("No pudimos enviar tu reporte.");
  return { id: data.id };
}

// ---------------------------------------------------------------------------
// Exportación y eliminación
// ---------------------------------------------------------------------------

export async function exportarDatos(userId: string, companyId: string) {
  await exigirRol(userId, companyId, ["owner", "business_user", "accountant"]);
  const { data: empresa } = await supabaseAdmin
    .from("tax_companies")
    .select("rut, business_name, fantasy_name, business_activity, created_at")
    .eq("id", companyId)
    .maybeSingle();
  const { data: resumenes } = await supabaseAdmin
    .from("tax_monthly_summaries")
    .select("*")
    .eq("company_id", companyId)
    .order("period", { ascending: false })
    .limit(120);
  const { data: periodos } = await supabaseAdmin
    .from("tax_periods")
    .select("period, status, data_source, confidence_level, updated_at")
    .eq("company_id", companyId)
    .order("period", { ascending: false })
    .limit(120);

  await supabaseAdmin.from("tax_data_requests").insert({
    company_id: companyId,
    user_id: userId,
    kind: "export",
    status: "completada",
    completed_at: new Date().toISOString(),
  });
  await registrarActividad(companyId, userId, "data.exported", "tax_data_requests");

  return {
    generado: new Date().toISOString(),
    empresa,
    periodos: periodos ?? [],
    resumenesMensuales: resumenes ?? [],
    nota:
      "Exportación informativa generada por Mi Negocio al Día. No reemplaza los registros oficiales del SII ni la revisión de tu contador.",
  };
}

export async function solicitarEliminacion(
  userId: string,
  entrada: { companyId: string; motivo?: string | null },
) {
  await exigirRol(userId, entrada.companyId, ["owner"]);
  const { error } = await supabaseAdmin.from("tax_data_requests").insert({
    company_id: entrada.companyId,
    user_id: userId,
    kind: "deletion",
    status: "solicitada",
    reason: entrada.motivo ?? null,
  });
  if (error) throw new ErrorNegocio("No pudimos registrar tu solicitud.");

  // Se detienen las actualizaciones y se revoca el acceso de terceros, pero
  // la información tributaria NO se elimina automáticamente: existen
  // obligaciones legales de conservación.
  await supabaseAdmin
    .from("tax_company_subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("company_id", entrada.companyId);
  await supabaseAdmin
    .from("tax_company_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("company_id", entrada.companyId)
    .eq("status", "pending");
  await registrarActividad(entrada.companyId, userId, "account.deletion_requested", "tax_data_requests");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Panel master (administración de la plataforma)
// ---------------------------------------------------------------------------

export async function esAdministrador(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

async function exigirAdministrador(userId: string) {
  if (!(await esAdministrador(userId)))
    throw new ErrorNegocio("Esta sección es solo para el equipo de administración.");
}

export interface FichaCliente {
  companyId: string;
  razonSocial: string;
  rut: string;
  esDemo: boolean;
  plan: string;
  estadoCuenta: EstadoCuenta;
  alta: string;
  ultimaActualizacion: string | null;
  conexionSii: string;
  periodosSincronizados: number;
  consultasMes: number;
  unidadesMes: number;
  cacheMes: number;
  erroresRecientes: number;
  usuarios: number;
}

export interface PanelMaster {
  empresas: FichaCliente[];
  totales: {
    empresasActivas: number;
    empresasSuspendidas: number;
    enPrueba: number;
    conversiones: number;
    actualizacionesExitosas: number;
    errores: number;
    usoCache: number;
    consumoMedio: number;
  };
  alertas: {
    id: string;
    empresa: string | null;
    tipo: string;
    severidad: string;
    mensaje: string;
    fecha: string;
  }[];
}

export async function panelMaster(userId: string): Promise<PanelMaster> {
  await exigirAdministrador(userId);
  const mes = mesActualChile();

  const { data: empresas } = await supabaseAdmin
    .from("tax_companies")
    .select("id, rut, business_name, is_demo, created_at, last_sync_at, connection_status")
    .order("created_at", { ascending: false })
    .limit(200);

  const ids = (empresas ?? []).map((e) => e.id);
  const { data: subs } = ids.length
    ? await supabaseAdmin
        .from("tax_company_subscriptions")
        .select("company_id, status, plan:tax_plans(name, code)")
        .in("company_id", ids)
    : { data: [] as { company_id: string; status: EstadoCuenta; plan: { name: string; code: string } }[] };

  const { data: uso } = ids.length
    ? await supabaseAdmin
        .from("tax_usage_ledger")
        .select("company_id, requests, cache_hits, errors, cost_units, usage_month")
        .in("company_id", ids)
        .eq("usage_month", mes)
    : { data: [] as { company_id: string; requests: number; cache_hits: number; errors: number; cost_units: number | string; usage_month: string }[] };

  const { data: miembros } = ids.length
    ? await supabaseAdmin
        .from("tax_company_members")
        .select("company_id")
        .in("company_id", ids)
        .eq("status", "active")
    : { data: [] as { company_id: string }[] };

  const { data: periodos } = ids.length
    ? await supabaseAdmin
        .from("tax_periods")
        .select("company_id, data_source")
        .in("company_id", ids)
    : { data: [] as { company_id: string; data_source: string }[] };

  const { data: corridas } = ids.length
    ? await supabaseAdmin
        .from("tax_sync_runs")
        .select("company_id, status, started_at")
        .in("company_id", ids)
        .order("started_at", { ascending: false })
        .limit(500)
    : { data: [] as { company_id: string; status: string; started_at: string }[] };

  const subPorEmpresa = new Map((subs ?? []).map((s) => [s.company_id, s]));

  const fichas: FichaCliente[] = (empresas ?? []).map((e) => {
    const usos = (uso ?? []).filter((u) => u.company_id === e.id);
    const sub = subPorEmpresa.get(e.id);
    const plan = (sub?.plan ?? null) as { name: string } | null;
    return {
      companyId: e.id,
      razonSocial: e.business_name,
      rut: e.rut,
      esDemo: e.is_demo,
      plan: plan?.name ?? "Sin plan",
      estadoCuenta: (sub?.status ?? "trial") as EstadoCuenta,
      alta: e.created_at,
      ultimaActualizacion: e.last_sync_at,
      conexionSii: e.connection_status,
      periodosSincronizados: (periodos ?? []).filter(
        (p) => p.company_id === e.id && (p.data_source === "gateway" || p.data_source === "sii"),
      ).length,
      consultasMes: usos.reduce((a, u) => a + u.requests, 0),
      unidadesMes: usos.reduce((a, u) => a + Number(u.cost_units), 0),
      cacheMes: usos.reduce((a, u) => a + u.cache_hits, 0),
      erroresRecientes: (corridas ?? []).filter(
        (c) => c.company_id === e.id && c.status === "failed",
      ).length,
      usuarios: (miembros ?? []).filter((m) => m.company_id === e.id).length,
    };
  });

  const { data: alertas } = await supabaseAdmin
    .from("tax_admin_alerts")
    .select("id, company_id, kind, severity, message, created_at")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const nombres = new Map(fichas.map((f) => [f.companyId, f.razonSocial]));
  const consumoTotal = fichas.reduce((a, f) => a + f.unidadesMes, 0);

  return {
    empresas: fichas,
    totales: {
      empresasActivas: fichas.filter((f) => f.estadoCuenta === "active").length,
      empresasSuspendidas: fichas.filter((f) => f.estadoCuenta === "suspended").length,
      enPrueba: fichas.filter((f) => f.estadoCuenta === "trial").length,
      conversiones: fichas.filter((f) => f.estadoCuenta === "active" && !f.esDemo).length,
      actualizacionesExitosas: (corridas ?? []).filter((c) => c.status === "success").length,
      errores: (corridas ?? []).filter((c) => c.status === "failed").length,
      usoCache: fichas.reduce((a, f) => a + f.cacheMes, 0),
      consumoMedio: fichas.length ? consumoTotal / fichas.length : 0,
    },
    alertas: (alertas ?? []).map((a) => ({
      id: a.id,
      empresa: a.company_id ? (nombres.get(a.company_id) ?? null) : null,
      tipo: a.kind,
      severidad: a.severity,
      mensaje: a.message,
      fecha: a.created_at,
    })),
  };
}

export async function cambiarEstadoCuenta(
  userId: string,
  entrada: { companyId: string; estado: EstadoCuenta; motivo?: string | null },
) {
  await exigirAdministrador(userId);
  await asegurarSuscripcion(entrada.companyId);
  const ahora = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("tax_company_subscriptions")
    .update({
      status: entrada.estado,
      suspended_at: entrada.estado === "suspended" ? ahora : null,
      suspension_reason: entrada.estado === "suspended" ? (entrada.motivo ?? null) : null,
      cancelled_at: entrada.estado === "cancelled" ? ahora : null,
    })
    .eq("company_id", entrada.companyId);
  if (error) throw new ErrorNegocio("No pudimos cambiar el estado de la cuenta.");
  await registrarActividad(entrada.companyId, userId, `admin.account_${entrada.estado}`);
  return { ok: true };
}
