/**
 * Bandera interna del Motor Espejo.
 *
 * En esta etapa el único modo permitido es `shadow_only`: el motor espejo
 * calcula y registra, pero no manda sobre el dashboard, no cierra periodos y
 * no escribe cifras productivas.
 */

export type MirrorEngineMode =
  | "disabled"
  | "shadow_only"
  | "authoritative"
  | "replace_current_engine"
  | "write_dashboard_results";

export const MIRROR_ENGINE_FLAG = "tax_mirror_engine_enabled" as const;

/** Modos habilitados en la Etapa 6.6. */
export const MODOS_PERMITIDOS: MirrorEngineMode[] = ["disabled", "shadow_only"];

export function modoPermitido(modo: MirrorEngineMode): boolean {
  return MODOS_PERMITIDOS.includes(modo);
}

/**
 * Resuelve el modo activo. Desarrollo y pruebas quedan en `shadow_only`
 * activo; producción solo puede estar en `shadow_only` o apagado.
 * Cualquier intento de modo autoritativo se degrada a `shadow_only`.
 */
export function resolverModoMotorEspejo(entorno: {
  isProduction?: boolean;
  configured?: string | null;
}): { habilitado: boolean; modo: MirrorEngineMode } {
  const configurado = (entorno.configured ?? "").trim() as MirrorEngineMode | "";
  if (configurado === "disabled") return { habilitado: false, modo: "disabled" };
  if (configurado && !modoPermitido(configurado)) {
    return { habilitado: true, modo: "shadow_only" };
  }
  if (configurado === "shadow_only") return { habilitado: true, modo: "shadow_only" };
  return entorno.isProduction
    ? { habilitado: false, modo: "shadow_only" }
    : { habilitado: true, modo: "shadow_only" };
}

/** El motor espejo nunca puede escribir resultados productivos en esta etapa. */
export function puedeEscribirResultadosProductivos(): false {
  return false;
}
