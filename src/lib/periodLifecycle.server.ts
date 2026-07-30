/**
 * Ciclo de vida del periodo tributario y modo de actualización.
 *
 * Aquí vive todo lo que decide "en qué etapa está el mes": abierto, en
 * revisión del contador, confirmado, cerrado o reabierto. También guarda el
 * modo de actualización elegido por la empresa y la comparación entre lo que
 * estimó la aplicación y lo que finalmente se declaró en el Formulario 29.
 *
 * Nunca consulta al proveedor ni pide credenciales.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ErrorNegocio, exigirRol, registrarActividad } from "@/lib/companies.server";
import { recalculateTaxPeriod } from "@/lib/taxRecalc.server";
import { leerEstadoPeriodo, type EstadoSincronizacionPeriodo } from "@/lib/periodSyncState.server";

export type ModoActualizacion = "manual_secure" | "advanced_automation";
export type EstadoAutomatizacion =
  | "unavailable"
  | "requested"
  | "pending_authorization"
  | "active"
  | "revoked"
  | "error";
export type EstadoPeriodo =
  | "open"
  | "pending_review"
  | "confirmed"
  | "closed"
  | "reopened";

const ETIQUETA_ESTADO: Record<EstadoPeriodo, string> = {
  open: "Abierto",
  pending_review: "En revisión del contador",
  confirmed: "Confirmado",
  closed: "Cerrado",
  reopened: "Reabierto",
};

const DESCRIPCION_ESTADO: Record<EstadoPeriodo, string> = {
  open: "El mes sigue en curso o aún no lo revisas. Las cifras son una estimación informativa.",
  pending_review:
    "Le pediste a tu contador que revise este mes. Puedes seguir actualizando la información.",
  confirmed:
    "Los antecedentes del Formulario 29 fueron confirmados. Las cifras dejan de ser estimadas.",
  closed: "Este mes quedó cerrado. La información se conserva como referencia histórica.",
  reopened:
    "Este mes se reabrió para corregir algo. Vuelve a cerrarlo cuando termines la revisión.",
};

export function etiquetaEstadoPeriodo(estado: EstadoPeriodo): string {
  return ETIQUETA_ESTADO[estado] ?? "Abierto";
}

/** Transiciones permitidas: nunca se salta de abierto a cerrado sin confirmar. */
const TRANSICIONES: Record<EstadoPeriodo, EstadoPeriodo[]> = {
  open: ["pending_review", "confirmed"],
  pending_review: ["confirmed", "open"],
  confirmed: ["closed", "reopened"],
  closed: ["reopened"],
  reopened: ["pending_review", "confirmed"],
};

export function transicionValida(desde: EstadoPeriodo, hacia: EstadoPeriodo): boolean {
  return (TRANSICIONES[desde] ?? []).includes(hacia);
}

async function periodoDe(companyId: string, periodo: string) {
  const { data } = await supabaseAdmin
    .from("tax_periods")
    .select("*")
    .eq("company_id", companyId)
    .eq("period", periodo)
    .maybeSingle();
  if (!data) throw new ErrorNegocio("El periodo indicado no existe en tu empresa.");
  return data;
}

function normalizarEstado(valor: unknown): EstadoPeriodo {
  const v = String(valor ?? "open");
  if (v === "estimated") return "open";
  if (v === "reviewed") return "pending_review";
  return (["open", "pending_review", "confirmed", "closed", "reopened"].includes(v)
    ? v
    : "open") as EstadoPeriodo;
}

/* ------------------------------------------------------------------ */
/* Modo de actualización                                               */
/* ------------------------------------------------------------------ */

export interface ModoActualizacionEmpresa {
  modo: ModoActualizacion;
  automatizacion: EstadoAutomatizacion;
  motivoAutomatizacion: string | null;
  metodoAutorizacion: string;
  actualizadoEn: string | null;
  recordatorioSemanal: boolean;
}

export async function obtenerModoActualizacion(
  userId: string,
  companyId: string,
): Promise<ModoActualizacionEmpresa> {
  await exigirRol(userId, companyId, ["owner", "business_user", "accountant", "viewer"]);
  const { data } = await supabaseAdmin
    .from("tax_sii_connections")
    .select("sync_mode, automation_status, automation_reason, authorization_method, sync_mode_updated_at")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .limit(1);
  const { data: settings } = await supabaseAdmin
    .from("tax_company_settings")
    .select("weekly_sync_reminder_enabled")
    .eq("company_id", companyId)
    .maybeSingle();
  const fila = data?.[0];
  return {
    modo: ((fila?.sync_mode as ModoActualizacion) ?? "manual_secure"),
    automatizacion: ((fila?.automation_status as EstadoAutomatizacion) ?? "unavailable"),
    motivoAutomatizacion: (fila?.automation_reason as string) ?? null,
    metodoAutorizacion: (fila?.authorization_method as string) ?? "none",
    actualizadoEn: (fila?.sync_mode_updated_at as string) ?? null,
    recordatorioSemanal: settings?.weekly_sync_reminder_enabled ?? true,
  };
}

export async function elegirModoActualizacion(
  userId: string,
  entrada: { companyId: string; modo: ModoActualizacion },
): Promise<ModoActualizacionEmpresa> {
  await exigirRol(userId, entrada.companyId, ["owner"]);

  const { data } = await supabaseAdmin
    .from("tax_sii_connections")
    .select("id")
    .eq("company_id", entrada.companyId)
    .order("updated_at", { ascending: false })
    .limit(1);
  const conexionId = data?.[0]?.id;
  if (!conexionId)
    throw new ErrorNegocio(
      "Primero necesitas activar la conexión con el SII para elegir un modo de actualización.",
    );

  const automatizacion: EstadoAutomatizacion =
    entrada.modo === "advanced_automation" ? "requested" : "unavailable";
  const motivo =
    entrada.modo === "advanced_automation"
      ? "La automatización avanzada requiere una autorización formal y todavía no está disponible."
      : null;

  await supabaseAdmin
    .from("tax_sii_connections")
    .update({
      sync_mode: entrada.modo,
      automation_status: automatizacion,
      automation_reason: motivo,
      sync_mode_updated_at: new Date().toISOString(),
    })
    .eq("id", conexionId);

  await registrarActividad(
    entrada.companyId,
    userId,
    "sii.sync_mode_changed",
    "tax_sii_connections",
    { modo: entrada.modo },
  );

  return obtenerModoActualizacion(userId, entrada.companyId);
}

export async function cambiarRecordatorioSemanal(
  userId: string,
  entrada: { companyId: string; activo: boolean },
): Promise<boolean> {
  await exigirRol(userId, entrada.companyId, ["owner", "business_user"]);
  await supabaseAdmin
    .from("tax_company_settings")
    .update({ weekly_sync_reminder_enabled: entrada.activo })
    .eq("company_id", entrada.companyId);
  return entrada.activo;
}

/* ------------------------------------------------------------------ */
/* Estado del periodo                                                  */
/* ------------------------------------------------------------------ */

export interface AntecedentesF29 {
  ivaDeterminado: number;
  ppm: number;
  retenciones: number;
  total: number;
  remanenteAnterior: number;
  remanenteNuevo: number;
  tasaPpm: number | null;
  basePpm: number | null;
  folio: string | null;
  notas: string | null;
  confirmadoEn: string | null;
}

export interface ComparacionPeriodo {
  estimadoIva: number;
  declaradoIva: number;
  estimadoPpm: number;
  declaradoPpm: number;
  estimadoRetenciones: number;
  declaradoRetenciones: number;
  estimadoTotal: number;
  declaradoTotal: number;
  diferencia: number;
  diferenciaPorcentaje: number | null;
  explicacion: string | null;
}

export interface ResumenPeriodo {
  periodo: string;
  estado: EstadoPeriodo;
  etiqueta: string;
  descripcion: string;
  puedeConfirmar: boolean;
  puedeCerrar: boolean;
  puedeReabrir: boolean;
  puedePedirRevision: boolean;
  confirmadoEn: string | null;
  cerradoEn: string | null;
  reabiertoEn: string | null;
  motivoReapertura: string | null;
  revisionSolicitadaEn: string | null;
  antecedentes: AntecedentesF29 | null;
  comparacion: ComparacionPeriodo | null;
  sincronizacion: EstadoSincronizacionPeriodo | null;
}

function mapAntecedentes(fila: Record<string, unknown> | null): AntecedentesF29 | null {
  if (!fila) return null;
  const cruda = (fila.raw_data ?? {}) as Record<string, unknown>;
  return {
    ivaDeterminado: Number(fila.declared_vat ?? 0),
    ppm: Number(fila.declared_ppm ?? 0),
    retenciones: Number(fila.declared_withholdings ?? 0),
    total: Number(fila.declared_total ?? 0),
    remanenteAnterior: Number(
      fila.previous_vat_carryforward ?? cruda.previous_vat_carryforward ?? 0,
    ),
    remanenteNuevo: Number(fila.new_vat_carryforward ?? cruda.new_vat_carryforward ?? 0),
    tasaPpm: fila.declared_ppm_rate != null ? Number(fila.declared_ppm_rate) : null,
    basePpm: fila.declared_ppm_base != null ? Number(fila.declared_ppm_base) : null,
    folio: (fila.folio as string) ?? null,
    notas: (fila.notes as string) ?? null,
    confirmadoEn: (fila.confirmed_at as string) ?? null,
  };
}

function mapComparacion(fila: Record<string, unknown> | null): ComparacionPeriodo | null {
  if (!fila) return null;
  return {
    estimadoIva: Number(fila.estimated_vat ?? 0),
    declaradoIva: Number(fila.declared_vat ?? 0),
    estimadoPpm: Number(fila.estimated_ppm ?? 0),
    declaradoPpm: Number(fila.declared_ppm ?? 0),
    estimadoRetenciones: Number(fila.estimated_withholdings ?? 0),
    declaradoRetenciones: Number(fila.declared_withholdings ?? 0),
    estimadoTotal: Number(fila.estimated_total ?? 0),
    declaradoTotal: Number(fila.declared_total ?? 0),
    diferencia: Number(fila.difference_total ?? 0),
    diferenciaPorcentaje:
      fila.difference_percent != null ? Number(fila.difference_percent) : null,
    explicacion: (fila.explanation as string) ?? null,
  };
}

export async function obtenerResumenPeriodo(
  userId: string,
  entrada: { companyId: string; periodo: string },
  ahora: Date = new Date(),
): Promise<ResumenPeriodo> {
  const rol = await exigirRol(userId, entrada.companyId, [
    "owner",
    "business_user",
    "accountant",
    "viewer",
  ]);
  const periodoRow = await periodoDe(entrada.companyId, entrada.periodo);
  const estado = normalizarEstado(periodoRow.status);

  const [{ data: f29 }, { data: comparacion }] = await Promise.all([
    supabaseAdmin
      .from("tax_f29_history")
      .select("*")
      .eq("company_id", entrada.companyId)
      .eq("tax_period_id", periodoRow.id)
      .maybeSingle(),
    supabaseAdmin
      .from("tax_period_comparisons")
      .select("*")
      .eq("company_id", entrada.companyId)
      .eq("tax_period_id", periodoRow.id)
      .maybeSingle(),
  ]);

  const sincronizacion = await leerEstadoPeriodo(
    entrada.companyId,
    periodoRow.id,
    entrada.periodo,
    ahora,
    estado === "closed" || estado === "confirmed",
  );

  const escribe = rol === "owner" || rol === "business_user" || rol === "accountant";
  const contadorODueño = rol === "owner" || rol === "accountant";

  return {
    periodo: entrada.periodo,
    estado,
    etiqueta: ETIQUETA_ESTADO[estado],
    descripcion: DESCRIPCION_ESTADO[estado],
    puedePedirRevision: escribe && transicionValida(estado, "pending_review"),
    puedeConfirmar: contadorODueño && transicionValida(estado, "confirmed"),
    puedeCerrar: contadorODueño && transicionValida(estado, "closed"),
    puedeReabrir: rol === "owner" && transicionValida(estado, "reopened"),
    confirmadoEn: (periodoRow.confirmed_at as string) ?? null,
    cerradoEn: (periodoRow.closed_at as string) ?? null,
    reabiertoEn: (periodoRow.reopened_at as string) ?? null,
    motivoReapertura: (periodoRow.reopen_reason as string) ?? null,
    revisionSolicitadaEn: (periodoRow.review_requested_at as string) ?? null,
    antecedentes: mapAntecedentes(f29 as Record<string, unknown> | null),
    comparacion: mapComparacion(comparacion as Record<string, unknown> | null),
    sincronizacion,
  };
}

export async function solicitarRevisionContador(
  userId: string,
  entrada: { companyId: string; periodo: string },
): Promise<ResumenPeriodo> {
  await exigirRol(userId, entrada.companyId, ["owner", "business_user"]);
  const periodoRow = await periodoDe(entrada.companyId, entrada.periodo);
  const estado = normalizarEstado(periodoRow.status);
  if (!transicionValida(estado, "pending_review"))
    throw new ErrorNegocio(
      `No puedes pedir revisión de un periodo ${ETIQUETA_ESTADO[estado].toLowerCase()}.`,
    );

  await supabaseAdmin
    .from("tax_periods")
    .update({
      status: "pending_review",
      review_requested_at: new Date().toISOString(),
      review_requested_by: userId,
    })
    .eq("id", periodoRow.id);

  await registrarActividad(
    entrada.companyId,
    userId,
    "period.review_requested",
    "tax_periods",
    { periodo: entrada.periodo },
  );
  return obtenerResumenPeriodo(userId, entrada);
}

export interface EntradaConfirmacionF29 {
  companyId: string;
  periodo: string;
  ivaDeterminado: number;
  ppm: number;
  retenciones: number;
  remanenteAnterior: number;
  remanenteNuevo: number;
  tasaPpm: number | null;
  basePpm: number | null;
  folio?: string | null;
  notas?: string | null;
}

/** Guarda los antecedentes reales del F29 y recalcula el periodo con ellos. */
export async function confirmarAntecedentesF29(
  userId: string,
  entrada: EntradaConfirmacionF29,
): Promise<ResumenPeriodo> {
  await exigirRol(userId, entrada.companyId, ["owner", "accountant"]);
  const periodoRow = await periodoDe(entrada.companyId, entrada.periodo);
  const estado = normalizarEstado(periodoRow.status);
  if (estado === "closed")
    throw new ErrorNegocio(
      "Este periodo está cerrado. Reábrelo si necesitas corregir los antecedentes.",
    );

  const negativos = [
    entrada.ivaDeterminado,
    entrada.ppm,
    entrada.retenciones,
    entrada.remanenteAnterior,
    entrada.remanenteNuevo,
  ].some((v) => !Number.isFinite(v) || v < 0);
  if (negativos)
    throw new ErrorNegocio("Los montos del Formulario 29 no pueden ser negativos.");

  const total = entrada.ivaDeterminado + entrada.ppm + entrada.retenciones;
  const ahora = new Date().toISOString();

  const { data: existente } = await supabaseAdmin
    .from("tax_f29_history")
    .select("id")
    .eq("company_id", entrada.companyId)
    .eq("tax_period_id", periodoRow.id)
    .maybeSingle();

  const fila = {
    company_id: entrada.companyId,
    tax_period_id: periodoRow.id,
    declaration_status: "filed" as const,
    declared_vat: entrada.ivaDeterminado,
    declared_ppm: entrada.ppm,
    declared_withholdings: entrada.retenciones,
    declared_total: total,
    vat_carryforward: entrada.remanenteAnterior,
    previous_vat_carryforward: entrada.remanenteAnterior,
    new_vat_carryforward: entrada.remanenteNuevo,
    declared_ppm_rate: entrada.tasaPpm,
    declared_ppm_base: entrada.basePpm,
    folio: entrada.folio ?? null,
    notes: entrada.notas ?? null,
    source: "accountant" as const,
    confirmed_by: userId,
    confirmed_at: ahora,
    raw_data: {
      origin: "accountant_confirmed_f29",
      confirmation_status: "confirmed",
      ppm_rate: entrada.tasaPpm,
      ppm_tax_base: entrada.basePpm,
      previous_vat_carryforward: entrada.remanenteAnterior,
      new_vat_carryforward: entrada.remanenteNuevo,
    },
  };

  if (existente)
    await supabaseAdmin.from("tax_f29_history").update(fila).eq("id", existente.id);
  else await supabaseAdmin.from("tax_f29_history").insert(fila);

  // La tasa confirmada rige desde este periodo hacia adelante, nunca hacia atrás.
  if (entrada.tasaPpm != null) {
    const desde = `${entrada.periodo}-01`;
    const { data: vigente } = await supabaseAdmin
      .from("tax_company_tax_parameters")
      .select("id")
      .eq("company_id", entrada.companyId)
      .eq("parameter_type", "ppm_rate")
      .eq("effective_from", desde)
      .maybeSingle();
    const parametro = {
      company_id: entrada.companyId,
      parameter_type: "ppm_rate",
      value: entrada.tasaPpm,
      effective_from: desde,
      source: "accountant_confirmed",
      confirmed: true,
      confirmed_at: ahora,
      confirmed_by: userId,
    };
    if (vigente)
      await supabaseAdmin
        .from("tax_company_tax_parameters")
        .update(parametro)
        .eq("id", vigente.id);
    else await supabaseAdmin.from("tax_company_tax_parameters").insert(parametro);
  }

  await supabaseAdmin
    .from("tax_periods")
    .update({ status: "confirmed", confirmed_at: ahora, confirmed_by: userId })
    .eq("id", periodoRow.id);

  await recalculateTaxPeriod(userId, {
    companyId: entrada.companyId,
    periodo: entrada.periodo,
  });
  await guardarComparacion(entrada.companyId, periodoRow.id);

  await registrarActividad(
    entrada.companyId,
    userId,
    "period.f29_confirmed",
    "tax_f29_history",
    { periodo: entrada.periodo, total },
  );

  return obtenerResumenPeriodo(userId, {
    companyId: entrada.companyId,
    periodo: entrada.periodo,
  });
}

export async function cerrarPeriodo(
  userId: string,
  entrada: { companyId: string; periodo: string },
): Promise<ResumenPeriodo> {
  await exigirRol(userId, entrada.companyId, ["owner", "accountant"]);
  const periodoRow = await periodoDe(entrada.companyId, entrada.periodo);
  const estado = normalizarEstado(periodoRow.status);
  if (!transicionValida(estado, "closed"))
    throw new ErrorNegocio(
      "Antes de cerrar el mes necesitas confirmar los antecedentes del Formulario 29.",
    );

  await guardarComparacion(entrada.companyId, periodoRow.id);
  await supabaseAdmin
    .from("tax_periods")
    .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: userId })
    .eq("id", periodoRow.id);

  await registrarActividad(entrada.companyId, userId, "period.closed", "tax_periods", {
    periodo: entrada.periodo,
  });
  return obtenerResumenPeriodo(userId, entrada);
}

export async function reabrirPeriodo(
  userId: string,
  entrada: { companyId: string; periodo: string; motivo: string },
): Promise<ResumenPeriodo> {
  await exigirRol(userId, entrada.companyId, ["owner"]);
  const motivo = entrada.motivo?.trim() ?? "";
  if (motivo.length < 10)
    throw new ErrorNegocio(
      "Cuéntanos en pocas palabras por qué necesitas reabrir este mes (al menos 10 caracteres).",
    );
  const periodoRow = await periodoDe(entrada.companyId, entrada.periodo);
  const estado = normalizarEstado(periodoRow.status);
  if (!transicionValida(estado, "reopened"))
    throw new ErrorNegocio("Solo puedes reabrir un mes confirmado o cerrado.");

  await supabaseAdmin
    .from("tax_periods")
    .update({
      status: "reopened",
      reopened_at: new Date().toISOString(),
      reopened_by: userId,
      reopen_reason: motivo,
    })
    .eq("id", periodoRow.id);

  await registrarActividad(entrada.companyId, userId, "period.reopened", "tax_periods", {
    periodo: entrada.periodo,
    motivo,
  });
  return obtenerResumenPeriodo(userId, entrada);
}

/* ------------------------------------------------------------------ */
/* Comparación entre lo estimado y lo declarado                        */
/* ------------------------------------------------------------------ */

export function explicarDiferencia(
  diferencia: number,
  porcentaje: number | null,
): string {
  const magnitud = Math.abs(diferencia);
  if (magnitud < 1)
    return "Nuestra estimación coincidió con lo declarado en el Formulario 29.";
  const sentido = diferencia > 0 ? "más" : "menos";
  const detalle =
    porcentaje != null ? ` (${Math.abs(porcentaje).toFixed(1)}% de diferencia)` : "";
  return `Nuestra estimación fue ${sentido} alta que lo declarado${detalle}. Suele ocurrir por documentos que llegaron después, remanentes o ajustes que hace tu contador.`;
}

/** Recalcula y guarda la comparación estimado vs declarado del periodo. */
export async function guardarComparacion(
  companyId: string,
  periodId: string,
): Promise<void> {
  const [{ data: resumen }, { data: f29 }] = await Promise.all([
    supabaseAdmin
      .from("tax_monthly_summaries")
      .select(
        "estimated_vat_payable, estimated_ppm, estimated_withholdings, estimated_tax_total",
      )
      .eq("company_id", companyId)
      .eq("tax_period_id", periodId)
      .maybeSingle(),
    supabaseAdmin
      .from("tax_f29_history")
      .select("declared_vat, declared_ppm, declared_withholdings, declared_total")
      .eq("company_id", companyId)
      .eq("tax_period_id", periodId)
      .maybeSingle(),
  ]);
  if (!resumen || !f29) return;

  const estimadoTotal = Number(resumen.estimated_tax_total ?? 0);
  const declaradoTotal = Number(f29.declared_total ?? 0);
  const diferencia = estimadoTotal - declaradoTotal;
  const porcentaje = declaradoTotal !== 0 ? (diferencia / declaradoTotal) * 100 : null;

  await supabaseAdmin.from("tax_period_comparisons").upsert(
    {
      company_id: companyId,
      tax_period_id: periodId,
      estimated_vat: Number(resumen.estimated_vat_payable ?? 0),
      declared_vat: Number(f29.declared_vat ?? 0),
      estimated_ppm: Number(resumen.estimated_ppm ?? 0),
      declared_ppm: Number(f29.declared_ppm ?? 0),
      estimated_withholdings: Number(resumen.estimated_withholdings ?? 0),
      declared_withholdings: Number(f29.declared_withholdings ?? 0),
      estimated_total: estimadoTotal,
      declared_total: declaradoTotal,
      difference_total: diferencia,
      difference_percent: porcentaje,
      explanation: explicarDiferencia(diferencia, porcentaje),
    },
    { onConflict: "company_id,tax_period_id" },
  );
}
