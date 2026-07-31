/**
 * Política de precisión y redondeo del núcleo unificado (Etapa 6.8).
 *
 * Regla general: precisión completa durante las operaciones intermedias y
 * redondeo únicamente donde la regla tributaria lo exige. Un componente ya
 * redondeado no vuelve a redondearse.
 *
 * Módulo puro: sin red, sin reloj, sin base de datos.
 */

export const ROUNDING_POLICY_VERSION = "rounding-1.0.0";

export type RoundingRule = "none" | "round_to_peso";

export interface ValorRedondeado {
  value: number | null;
  /** Regla aplicada; `none` significa que se conservó la precisión. */
  roundingRule: RoundingRule;
  /** Verdadero cuando el redondeo cambió el valor. */
  changed: boolean;
}

/**
 * Redondeo tributario a peso entero: medio peso se aleja de cero, igual que
 * hace el SII con los montos declarados. `Math.round(-0.5)` daría `-0`, por
 * eso no se usa directamente.
 */
export function redondearAPeso(valor: number): number {
  if (!Number.isFinite(valor)) return valor;
  const entero = valor < 0 ? -Math.round(Math.abs(valor)) : Math.round(valor);
  return Object.is(entero, -0) ? 0 : entero;
}

export function aplicarRedondeo(
  valor: number | null,
  regla: RoundingRule,
): ValorRedondeado {
  if (valor == null || !Number.isFinite(valor)) {
    return { value: valor == null ? null : valor, roundingRule: regla, changed: false };
  }
  if (regla === "none") return { value: valor, roundingRule: regla, changed: false };
  const redondeado = redondearAPeso(valor);
  return {
    value: redondeado,
    roundingRule: regla,
    changed: redondeado !== valor,
  };
}

/** Verdadero cuando el valor ya está expresado en pesos enteros. */
export function yaRedondeado(valor: number | null): boolean {
  return valor == null || Number.isInteger(valor);
}

/**
 * Producto tasa × base con precisión completa y un solo redondeo final.
 * Las tasas vienen como fracción (0,006 = 0,6 %).
 */
export function montoPorTasa(
  base: number | null,
  tasa: number | null,
): ValorRedondeado {
  if (base == null || tasa == null) {
    return { value: null, roundingRule: "round_to_peso", changed: false };
  }
  return aplicarRedondeo(base * tasa, "round_to_peso");
}
