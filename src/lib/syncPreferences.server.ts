/**
 * Preferencias de sincronización: lectura y escritura contra la base de datos.
 *
 * Este módulo NUNCA recibe, guarda ni devuelve la Clave Tributaria.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ErrorNegocio, exigirRol } from "@/lib/companies.server";
import {
  PREFERENCIAS_POR_DEFECTO,
  referenciaAutorizacionEsSegura,
  type AuthorizationMethod,
  type ReminderStatus,
  type SyncMode,
  type SyncPreferences,
} from "@/lib/syncPreferences";

type Fila = Record<string, unknown>;

function aPreferencias(fila: Fila): SyncPreferences {
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    companyId: String(fila.company_id),
    syncMode: (fila.sync_mode as SyncMode) ?? "manual_secure",
    automationStatus:
      (fila.automation_status as SyncPreferences["automationStatus"]) ?? "unavailable",
    authorizationMethod: (fila.authorization_method as AuthorizationMethod) ?? "none",
    authorizationReference: (fila.authorization_reference as string) ?? null,
    authorizationCreatedAt: (fila.authorization_created_at as string) ?? null,
    authorizationExpiresAt: (fila.authorization_expires_at as string) ?? null,
    authorizationRevokedAt: (fila.authorization_revoked_at as string) ?? null,
    automationSchedule: (fila.automation_schedule as string) ?? null,
    automationErrorCode: (fila.automation_error_code as string) ?? null,
    lastAutomatedAttemptAt: (fila.last_automated_attempt_at as string) ?? null,
    lastAutomatedSuccessAt: (fila.last_automated_success_at as string) ?? null,
    reminderEnabled: fila.reminder_enabled !== false,
    reminderDayOfMonth: Number(fila.reminder_day_of_month ?? 1),
    reminderStatus: (fila.reminder_status as ReminderStatus) ?? "scheduled",
    nextReminderAt: (fila.next_reminder_at as string) ?? null,
    lastReminderAt: (fila.last_reminder_at as string) ?? null,
    reminderDismissedAt: (fila.reminder_dismissed_at as string) ?? null,
    monthlyCreditBudget: n(fila.monthly_credit_budget),
    creditsUsedCurrentMonth: Number(fila.credits_used_current_month ?? 0),
    creditsMonth: (fila.credits_month as string) ?? null,
    warningThresholdPercent: Number(fila.warning_threshold_percent ?? 80),
    blockingThresholdPercent: Number(fila.blocking_threshold_percent ?? 100),
    lastProviderBalance: n(fila.last_provider_balance),
    lastProviderBalanceAt: (fila.last_provider_balance_at as string) ?? null,
  };
}

/** Lee (creando por primera vez si hace falta) las preferencias de la empresa. */
export async function obtenerPreferenciasSync(
  userId: string,
  companyId: string,
): Promise<SyncPreferences> {
  await exigirRol(userId, companyId, [
    "owner",
    "business_user",
    "accountant",
    "viewer",
  ]);

  const { data } = await supabaseAdmin
    .from("tax_sync_preferences")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (data) return aPreferencias(data as Fila);

  const { data: creada, error } = await supabaseAdmin
    .from("tax_sync_preferences")
    .insert({ company_id: companyId })
    .select("*")
    .single();
  if (error || !creada)
    return { ...PREFERENCIAS_POR_DEFECTO, companyId };
  return aPreferencias(creada as Fila);
}

export interface CambioPreferencias {
  companyId: string;
  syncMode?: SyncMode;
  reminderEnabled?: boolean;
  reminderDayOfMonth?: number;
  reminderStatus?: ReminderStatus;
  marcarRecordatorioMostrado?: boolean;
  descartarRecordatorio?: boolean;
}

/** Campos que jamás pueden llegar desde el cliente. */
const CAMPOS_PROHIBIDOS = [
  "sii_password",
  "tax_password",
  "encrypted_password",
  "tributary_password",
  "stored_credentials",
  "clave_sii",
  "clave_tributaria",
  "claveTributaria",
  "password",
];

export async function actualizarPreferenciasSync(
  userId: string,
  cambio: CambioPreferencias,
): Promise<SyncPreferences> {
  for (const campo of CAMPOS_PROHIBIDOS)
    if (campo in (cambio as Record<string, unknown>))
      throw new ErrorNegocio("Esta operación no admite datos de acceso.");

  await exigirRol(userId, cambio.companyId, ["owner", "business_user"]);
  await obtenerPreferenciasSync(userId, cambio.companyId);

  const ahora = new Date().toISOString();
  const parche: Record<string, unknown> = {};

  if (cambio.syncMode) {
    // La automatización autorizada no está disponible: se conserva el modo
    // seguro y se deja constancia del estado.
    if (cambio.syncMode === "automated_authorized")
      throw new ErrorNegocio(
        "La automatización avanzada todavía no está disponible.",
      );
    parche.sync_mode = "manual_secure";
    parche.automation_status = "unavailable";
    parche.authorization_method = "none";
  }
  if (cambio.reminderEnabled != null) {
    parche.reminder_enabled = cambio.reminderEnabled;
    parche.reminder_status = cambio.reminderEnabled ? "scheduled" : "disabled";
  }
  if (cambio.reminderDayOfMonth != null) {
    const dia = Math.min(28, Math.max(1, Math.round(cambio.reminderDayOfMonth)));
    parche.reminder_day_of_month = dia;
  }
  if (cambio.reminderStatus) parche.reminder_status = cambio.reminderStatus;
  if (cambio.marcarRecordatorioMostrado) {
    parche.last_reminder_at = ahora;
    parche.reminder_status = "due";
  }
  if (cambio.descartarRecordatorio) {
    parche.reminder_dismissed_at = ahora;
    parche.reminder_status = "dismissed";
  }

  const { data, error } = await supabaseAdmin
    .from("tax_sync_preferences")
    .update(parche)
    .eq("company_id", cambio.companyId)
    .select("*")
    .single();
  if (error || !data)
    throw new ErrorNegocio("No pudimos guardar tus preferencias de actualización.");
  return aPreferencias(data as Fila);
}

/**
 * Registra el consumo de una ejecución en el presupuesto mensual interno.
 * Solo cifras: nunca datos de acceso.
 */
export async function registrarConsumoEnPresupuesto(
  companyId: string,
  creditos: number,
  saldoProveedor: number | null,
): Promise<void> {
  if (!Number.isFinite(creditos) || creditos <= 0) return;
  const mes = new Date().toISOString().slice(0, 7);
  const { data } = await supabaseAdmin
    .from("tax_sync_preferences")
    .select("credits_used_current_month, credits_month")
    .eq("company_id", companyId)
    .maybeSingle();
  const acumulado =
    data && (data as Fila).credits_month === mes
      ? Number((data as Fila).credits_used_current_month ?? 0)
      : 0;

  await supabaseAdmin
    .from("tax_sync_preferences")
    .update({
      credits_used_current_month: Number((acumulado + creditos).toFixed(4)),
      credits_month: mes,
      last_provider_balance: saldoProveedor,
      last_provider_balance_at: saldoProveedor == null ? null : new Date().toISOString(),
    })
    .eq("company_id", companyId);
}

/** Marca el recordatorio como cumplido tras una sincronización exitosa. */
export async function marcarRecordatorioCompletado(companyId: string): Promise<void> {
  await supabaseAdmin
    .from("tax_sync_preferences")
    .update({
      reminder_status: "completed",
      reminder_dismissed_at: null,
      last_reminder_at: new Date().toISOString(),
    })
    .eq("company_id", companyId);
}
