/**
 * Modos del núcleo tributario unificado (Etapa 6.8).
 *
 * shadow          — el motor antiguo manda; el unificado solo compara.
 * compatibility   — el motor unificado calcula una sola vez y la proyección
 *                   de compatibilidad conserva el contrato productivo.
 * authoritative   — la interfaz usa directamente estados y certeza del
 *                   núcleo unificado. No habilitado en esta etapa.
 *
 * El rollback consiste en volver a `shadow`: no borra cálculos, no revierte
 * migraciones y no altera periodos guardados.
 */

export type UnifiedEngineMode = "shadow" | "compatibility" | "authoritative";

export const UNIFIED_ENGINE_FLAG = "unified_engine_mode" as const;

/** Modo por omisión de la Etapa 6.8. */
export const MODO_UNIFICADO_POR_DEFECTO: UnifiedEngineMode = "compatibility";

/** `authoritative` queda prohibido hasta la etapa siguiente. */
export const MODOS_UNIFICADOS_PERMITIDOS: UnifiedEngineMode[] = [
  "shadow",
  "compatibility",
];

export function modoUnificadoPermitido(modo: UnifiedEngineMode): boolean {
  return MODOS_UNIFICADOS_PERMITIDOS.includes(modo);
}

/**
 * Resuelve el modo activo. Un valor no permitido nunca escala privilegios:
 * degrada a `compatibility`, que conserva exactamente las cifras visibles.
 */
export function resolverModoUnificado(configurado?: string | null): UnifiedEngineMode {
  const valor = (configurado ?? "").trim() as UnifiedEngineMode | "";
  if (valor === "shadow") return "shadow";
  if (valor === "compatibility") return "compatibility";
  return MODO_UNIFICADO_POR_DEFECTO;
}

/** Procedimiento de rollback: volver a `shadow` sin tocar datos guardados. */
export function rollbackAModoSombra(): UnifiedEngineMode {
  return "shadow";
}

/** En esta etapa la interfaz nunca lee estados de certeza directamente. */
export function interfazUsaCerteza(modo: UnifiedEngineMode): boolean {
  return modo === "authoritative";
}
