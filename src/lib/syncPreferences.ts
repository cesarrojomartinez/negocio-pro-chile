/**
 * Preferencias de actualización de una empresa (módulo puro).
 *
 * Aquí viven los tipos y las reglas de decisión que NO tocan red ni base de
 * datos: modo de sincronización, estado de la automatización preparada,
 * recordatorios y presupuesto interno de créditos.
 *
 * Regla infranqueable: en ninguna parte de este módulo (ni de la tabla que
 * representa) puede existir la Clave Tributaria, ni cifrada ni derivada.
 */

/** Cómo se traen los datos del SII. */
export type SyncMode = "manual_secure" | "automated_authorized";

/** Estado de la automatización avanzada. Hoy siempre "unavailable". */
export type AutomationStatus =
  | "unavailable"
  | "pending_setup"
  | "active"
  | "paused"
  | "error"
  | "revoked";

/** Método legal/técnico con el que se autorizaría una automatización. */
export type AuthorizationMethod =
  | "none"
  | "digital_certificate"
  | "digital_mandate"
  | "provider_authorization"
  | "other_compatible_method";

export type ReminderStatus =
  | "disabled"
  | "scheduled"
  | "due"
  | "dismissed"
  | "completed";

export interface SyncPreferences {
  companyId: string;
  syncMode: SyncMode;
  automationStatus: AutomationStatus;
  authorizationMethod: AuthorizationMethod;
  /** Referencia OPACA entregada por un proveedor compatible. Nunca un secreto. */
  authorizationReference: string | null;
  authorizationCreatedAt: string | null;
  authorizationExpiresAt: string | null;
  authorizationRevokedAt: string | null;
  automationSchedule: string | null;
  automationErrorCode: string | null;
  lastAutomatedAttemptAt: string | null;
  lastAutomatedSuccessAt: string | null;
  reminderEnabled: boolean;
  reminderDayOfMonth: number;
  reminderStatus: ReminderStatus;
  nextReminderAt: string | null;
  lastReminderAt: string | null;
  reminderDismissedAt: string | null;
  monthlyCreditBudget: number | null;
  creditsUsedCurrentMonth: number;
  creditsMonth: string | null;
  warningThresholdPercent: number;
  blockingThresholdPercent: number;
  lastProviderBalance: number | null;
  lastProviderBalanceAt: string | null;
}

export const PREFERENCIAS_POR_DEFECTO: Omit<SyncPreferences, "companyId"> = {
  syncMode: "manual_secure",
  automationStatus: "unavailable",
  authorizationMethod: "none",
  authorizationReference: null,
  authorizationCreatedAt: null,
  authorizationExpiresAt: null,
  authorizationRevokedAt: null,
  automationSchedule: null,
  automationErrorCode: null,
  lastAutomatedAttemptAt: null,
  lastAutomatedSuccessAt: null,
  reminderEnabled: true,
  reminderDayOfMonth: 1,
  reminderStatus: "scheduled",
  nextReminderAt: null,
  lastReminderAt: null,
  reminderDismissedAt: null,
  monthlyCreditBudget: null,
  creditsUsedCurrentMonth: 0,
  creditsMonth: null,
  warningThresholdPercent: 80,
  blockingThresholdPercent: 100,
  lastProviderBalance: null,
  lastProviderBalanceAt: null,
};

/**
 * La automatización solo puede activarse cuando existe un método verificado.
 * Guardar la Clave Tributaria (aunque sea cifrada) nunca cuenta como método.
 */
export function puedeActivarAutomatizacion(p: SyncPreferences): boolean {
  return (
    p.authorizationMethod !== "none" &&
    p.authorizationReference != null &&
    p.automationStatus !== "revoked"
  );
}

/** Palabras que jamás pueden aparecer en una referencia de autorización. */
const PATRON_CREDENCIAL = /(clave|password|contrase|secret|pass=|pwd|tributaria)/i;

export function referenciaAutorizacionEsSegura(valor: string | null): boolean {
  if (valor == null) return true;
  return valor.length <= 200 && !PATRON_CREDENCIAL.test(valor);
}

/* --------------------------- Recordatorios --------------------------- */

export interface EntradaRecordatorio {
  ahora: Date;
  preferencias: Pick<
    SyncPreferences,
    | "reminderEnabled"
    | "reminderDayOfMonth"
    | "lastReminderAt"
    | "reminderDismissedAt"
  >;
  /** Última sincronización exitosa de cualquier periodo de la empresa. */
  ultimaSincronizacion: string | null;
}

export interface ResultadoRecordatorio {
  estado: ReminderStatus;
  /** Texto único y amable. No dispara ninguna consulta al proveedor. */
  mensaje: string | null;
  proximoAviso: string | null;
}

const DIA = 86_400_000;

/** Día del mes en Chile continental. */
function diaDelMesChile(fecha: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      day: "2-digit",
    }).format(fecha),
  );
}

/**
 * Decide si corresponde mostrar el recordatorio. Nunca consulta al proveedor
 * ni consume créditos: solo mira fechas ya guardadas.
 *
 * Reglas iniciales:
 * - un aviso al comenzar el mes (desde `reminderDayOfMonth`);
 * - un segundo aviso cuando ya puede existir el F29 del mes anterior (día 12);
 * - nunca dos avisos el mismo día ni avisos diarios insistentes;
 * - si ya se sincronizó hoy, queda "completed".
 */
export function evaluarRecordatorio(
  entrada: EntradaRecordatorio,
): ResultadoRecordatorio {
  const { preferencias: p, ahora } = entrada;
  if (!p.reminderEnabled)
    return { estado: "disabled", mensaje: null, proximoAviso: null };

  const dia = diaDelMesChile(ahora);
  const sincronizadoHoy =
    entrada.ultimaSincronizacion != null &&
    ahora.getTime() - new Date(entrada.ultimaSincronizacion).getTime() < DIA;
  if (sincronizadoHoy)
    return { estado: "completed", mensaje: null, proximoAviso: null };

  const avisadoRecientemente =
    p.lastReminderAt != null &&
    ahora.getTime() - new Date(p.lastReminderAt).getTime() < 7 * DIA;
  if (avisadoRecientemente)
    return { estado: "scheduled", mensaje: null, proximoAviso: null };

  const descartadoRecientemente =
    p.reminderDismissedAt != null &&
    ahora.getTime() - new Date(p.reminderDismissedAt).getTime() < 7 * DIA;
  if (descartadoRecientemente)
    return { estado: "dismissed", mensaje: null, proximoAviso: null };

  const ventanaInicioMes = dia >= p.reminderDayOfMonth && dia <= p.reminderDayOfMonth + 2;
  const ventanaF29 = dia >= 12 && dia <= 14;

  if (ventanaInicioMes || ventanaF29)
    return {
      estado: "due",
      mensaje: "Ya puedes actualizar la información tributaria de tu negocio.",
      proximoAviso: null,
    };

  return { estado: "scheduled", mensaje: null, proximoAviso: null };
}

/* ------------------------ Presupuesto de créditos ------------------------ */

export type EstadoPresupuesto = "sin_limite" | "normal" | "advertencia" | "bloqueado";

export function evaluarPresupuesto(p: SyncPreferences): {
  estado: EstadoPresupuesto;
  porcentaje: number | null;
} {
  if (p.monthlyCreditBudget == null || p.monthlyCreditBudget <= 0)
    return { estado: "sin_limite", porcentaje: null };
  const porcentaje = (p.creditsUsedCurrentMonth / p.monthlyCreditBudget) * 100;
  if (porcentaje >= p.blockingThresholdPercent)
    return { estado: "bloqueado", porcentaje };
  if (porcentaje >= p.warningThresholdPercent)
    return { estado: "advertencia", porcentaje };
  return { estado: "normal", porcentaje };
}
