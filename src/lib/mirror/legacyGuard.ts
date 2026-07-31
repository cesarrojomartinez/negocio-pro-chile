/**
 * Instrumentación de desarrollo contra el doble motor (Etapa 6.8.1).
 *
 * En modo `compatibility` ninguna fórmula tributaria antigua puede ejecutarse
 * de forma productiva. Este contador lo hace verificable en pruebas y
 * bloquea la persistencia del run cuando ocurre.
 */
import type { UnifiedEngineMode } from "./unifiedEngineMode";

export const LEGACY_ENGINE_CALLED_IN_COMPATIBILITY =
  "LEGACY_ENGINE_CALLED_IN_COMPATIBILITY" as const;

export interface InvocacionLegada {
  origin: string;
  period: string | null;
  companyId: string | null;
  mode: UnifiedEngineMode;
  code: typeof LEGACY_ENGINE_CALLED_IN_COMPATIBILITY | null;
}

const invocaciones: InvocacionLegada[] = [];

/** Registra una invocación productiva del motor legado. */
export function registrarInvocacionLegada(entrada: {
  origin: string;
  mode: UnifiedEngineMode;
  period?: string | null;
  companyId?: string | null;
}): InvocacionLegada {
  const registro: InvocacionLegada = {
    origin: entrada.origin,
    period: entrada.period ?? null,
    companyId: entrada.companyId ?? null,
    mode: entrada.mode,
    code:
      entrada.mode === "compatibility" ? LEGACY_ENGINE_CALLED_IN_COMPATIBILITY : null,
  };
  invocaciones.push(registro);
  return registro;
}

export function legacyCalculationInvocationCount(filtro?: {
  mode?: UnifiedEngineMode;
  companyId?: string | null;
}): number {
  return invocaciones.filter(
    (i) =>
      (filtro?.mode == null || i.mode === filtro.mode) &&
      (filtro?.companyId === undefined || i.companyId === filtro.companyId),
  ).length;
}

export function invocacionesLegadasProhibidas(): InvocacionLegada[] {
  return invocaciones.filter((i) => i.code === LEGACY_ENGINE_CALLED_IN_COMPATIBILITY);
}

export function reiniciarInstrumentacionLegada(): void {
  invocaciones.length = 0;
}
