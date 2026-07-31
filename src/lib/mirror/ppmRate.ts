/**
 * Normalización de la tasa de PPM (Cierre Fase 6).
 *
 * El código 115 del F29 no tiene una unidad estable: el mismo 1 % aparece
 * guardado como `1`, como `0.01` y, en formularios antiguos, como `0.010`.
 * Interpretarlo mal multiplica o divide el PPM por cien.
 *
 * Regla: cuando el formulario informa base (563) y monto (62), la tasa
 * implícita manda y se elige la candidata más cercana. Sin esos antecedentes
 * se usa una convención explícita y el resultado queda marcado como ambiguo,
 * nunca silenciosamente convertido.
 *
 * Módulo puro: sin red, sin reloj, sin base de datos.
 */

export type UnidadTasaPpm = "fraction" | "percent" | "unknown";

export interface TasaPpmNormalizada {
  /** Tasa expresada siempre como fracción (1 % = 0.01). `null` si no hay dato. */
  rate: number | null;
  /** Unidad detectada en el dato de origen. */
  unit: UnidadTasaPpm;
  /** Verdadero cuando no se pudo confirmar la unidad con base y monto. */
  ambiguous: boolean;
  /** Tasa implícita calculada como monto / base, cuando ambos existen. */
  impliedRate: number | null;
}

export interface AntecedentesTasaPpm {
  /** Código 563: base imponible del PPM. */
  base?: number | null;
  /** Código 62: PPM declarado. */
  amount?: number | null;
}

const SIN_TASA: TasaPpmNormalizada = {
  rate: null,
  unit: "unknown",
  ambiguous: false,
  impliedRate: null,
};

/**
 * Devuelve la tasa como fracción. Nunca inventa un valor: sin dato entrega
 * `null`, y cuando la unidad no puede confirmarse lo declara en `ambiguous`.
 */
export function normalizarTasaPpm(
  valor: number | null | undefined,
  antecedentes: AntecedentesTasaPpm = {},
): TasaPpmNormalizada {
  if (valor == null || !Number.isFinite(valor)) return SIN_TASA;
  if (valor === 0) {
    return { rate: 0, unit: "fraction", ambiguous: false, impliedRate: null };
  }
  if (valor < 0) return SIN_TASA;

  const base = antecedentes.base ?? null;
  const monto = antecedentes.amount ?? null;
  const impliedRate =
    base != null && base > 0 && monto != null ? monto / base : null;

  const candidatas: Array<{ rate: number; unit: UnidadTasaPpm }> = [
    { rate: valor, unit: "fraction" },
    { rate: valor / 100, unit: "percent" },
  ];

  if (impliedRate != null) {
    let mejor = candidatas[0];
    let mejorDistancia = Number.POSITIVE_INFINITY;
    for (const c of candidatas) {
      const d = Math.abs(c.rate - impliedRate);
      if (d < mejorDistancia) {
        mejorDistancia = d;
        mejor = c;
      }
    }
    return {
      rate: mejor.rate,
      unit: mejor.unit,
      ambiguous: false,
      impliedRate,
    };
  }

  // Sin base ni monto: un valor de 1 o más solo puede ser un porcentaje.
  if (valor >= 1) {
    return {
      rate: valor / 100,
      unit: "percent",
      ambiguous: false,
      impliedRate: null,
    };
  }

  // Bajo 1 la lectura habitual es fracción, pero no puede confirmarse.
  return {
    rate: valor,
    unit: "fraction",
    ambiguous: true,
    impliedRate: null,
  };

}

/**
 * Verdadero cuando la tasa normalizada es incompatible con la base y el monto
 * declarados. Una tasa incoherente no se arrastra a otros periodos.
 */
export function tasaPpmIncoherente(
  normalizada: TasaPpmNormalizada,
  antecedentes: AntecedentesTasaPpm = {},
): boolean {
  const { rate } = normalizada;
  const base = antecedentes.base ?? null;
  const monto = antecedentes.amount ?? null;
  if (rate == null || base == null || monto == null || base <= 0) return false;
  const esperado = base * rate;
  return Math.abs(esperado - monto) > Math.max(1000, Math.abs(monto) * 0.05);
}

/** Tasa mostrada en pantalla, siempre en porcentaje. */
export function tasaPpmParaVisualizacion(rate: number | null): number | null {
  return rate == null ? null : rate * 100;
}
