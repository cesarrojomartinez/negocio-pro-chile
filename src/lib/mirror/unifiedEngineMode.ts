/**
 * Modos del núcleo tributario unificado (Etapas 6.8 y 6.8.1).
 *
 * shadow          — el motor antiguo produce; el unificado solo compara.
 * dual_validation — ambos calculan, el antiguo produce y toda diferencia
 *                   bloquea la promoción.
 * compatibility   — el motor unificado calcula una sola vez y la proyección
 *                   de compatibilidad conserva el contrato productivo.
 * authoritative   — la interfaz usa directamente estados y certeza del
 *                   núcleo unificado. No habilitado en esta etapa.
 *
 * El rollback consiste en volver a `shadow`: no borra cálculos, no revierte
 * migraciones y no altera periodos guardados.
 */

export type UnifiedEngineMode =
  | "shadow"
  | "dual_validation"
  | "compatibility"
  | "authoritative";

export const UNIFIED_ENGINE_FLAG = "unified_engine_mode" as const;

/** Modo seguro: nunca cambia una cifra productiva. */
export const MODO_UNIFICADO_SEGURO: UnifiedEngineMode = "shadow";

/** Modo por omisión de una empresa existente. */
export const MODO_UNIFICADO_POR_DEFECTO: UnifiedEngineMode = "shadow";

/** `authoritative` queda prohibido hasta la etapa siguiente. */
export const MODOS_UNIFICADOS_PERMITIDOS: UnifiedEngineMode[] = [
  "shadow",
  "dual_validation",
  "compatibility",
];

export const INVALID_UNIFIED_ENGINE_MODE = "INVALID_UNIFIED_ENGINE_MODE" as const;

export function modoUnificadoPermitido(modo: UnifiedEngineMode): boolean {
  return MODOS_UNIFICADOS_PERMITIDOS.includes(modo);
}

export interface ResolucionModoUnificado {
  modo: UnifiedEngineMode;
  /** Valor configurado tal como venía, para auditoría. */
  configurado: string | null;
  /** Código de error cuando el valor no es utilizable. */
  error: typeof INVALID_UNIFIED_ENGINE_MODE | null;
}

/**
 * Resuelve el modo activo. Un valor inválido, vacío o prohibido nunca escala
 * privilegios ni degrada silenciosamente a `compatibility`: cae al modo
 * seguro `shadow` y deja registrado `INVALID_UNIFIED_ENGINE_MODE`.
 */
export function resolverModoUnificadoDetallado(
  configurado?: string | null,
): ResolucionModoUnificado {
  const valor = (configurado ?? "").trim();
  if (valor === "") {
    return { modo: MODO_UNIFICADO_POR_DEFECTO, configurado: null, error: null };
  }
  if (modoUnificadoPermitido(valor as UnifiedEngineMode)) {
    return { modo: valor as UnifiedEngineMode, configurado: valor, error: null };
  }
  return {
    modo: MODO_UNIFICADO_SEGURO,
    configurado: valor,
    error: INVALID_UNIFIED_ENGINE_MODE,
  };
}

export function resolverModoUnificado(configurado?: string | null): UnifiedEngineMode {
  return resolverModoUnificadoDetallado(configurado).modo;
}

/** En modo `compatibility` el motor antiguo no puede calcular. */
export function motorLegadoPuedeCalcular(modo: UnifiedEngineMode): boolean {
  return modo !== "compatibility";
}

/** El núcleo unificado se ejecuta en todos los modos habilitados. */
export function nucleoUnificadoSeEjecuta(modo: UnifiedEngineMode): boolean {
  return modo === "shadow" || modo === "dual_validation" || modo === "compatibility";
}

export interface RegistroRollback {
  companyId: string | null;
  modo: UnifiedEngineMode;
  rollbackReason: string;
  rolledBackAt: string;
  rolledBackBy: string | null;
}

/** Procedimiento de rollback: volver a `shadow` sin tocar datos guardados. */
export function rollbackAModoSombra(
  _companyId?: string | null,
  _reason?: string,
): UnifiedEngineMode {
  return "shadow";
}

/** Variante que devuelve el registro completo de auditoría del rollback. */
export function registrarRollbackAModoSombra(entrada: {
  companyId?: string | null;
  reason: string;
  actor?: string | null;
  ahora?: string;
}): RegistroRollback {
  return {
    companyId: entrada.companyId ?? null,
    modo: "shadow",
    rollbackReason: entrada.reason,
    rolledBackAt: entrada.ahora ?? new Date().toISOString(),
    rolledBackBy: entrada.actor ?? null,
  };
}

/** En esta etapa la interfaz nunca lee estados de certeza directamente. */
export function interfazUsaCerteza(modo: UnifiedEngineMode): boolean {
  return modo === "authoritative";
}
