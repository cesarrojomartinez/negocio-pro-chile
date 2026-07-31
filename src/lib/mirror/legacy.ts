/**
 * Interpretación de valores heredados del motor actual.
 *
 * Las columnas productivas se crearon con `NOT NULL DEFAULT 0`, por lo que un
 * cero guardado puede significar tres cosas distintas: cero real, nunca
 * calculado o dato desconocido. Este módulo traduce ese valor legado al
 * modelo de certeza sin modificar la base de datos ni la interfaz.
 *
 * Módulo puro.
 */
import type { TaxSourceStatus } from "./certainty";

export type LegacyInterpretation =
  | "real_value"
  | "explicit_zero"
  | "unknown_zero"
  | "never_calculated"
  | "absent";

export interface EntradaValorLegado {
  /** Valor guardado en la columna productiva. */
  raw: number | null | undefined;
  /** La columna tiene `DEFAULT 0` y no distingue ausencia. */
  columnDefaultsToZero: boolean;
  /** Hubo un cálculo que escribió esta fila. */
  wasCalculated: boolean;
  /** Existe una fuente que respalda el valor (F29, RCV, confirmación). */
  hasBackingSource: boolean;
  /** Procedencia declarada por el motor actual, si la hay. */
  declaredSource?: TaxSourceStatus | null;
}

export interface ValorLegadoInterpretado {
  /** Monto utilizable. `null` cuando el cero no es confiable. */
  amount: number | null;
  interpretation: LegacyInterpretation;
  trustworthy: boolean;
  reason: string;
}

/**
 * Traduce un valor legado. Un cero sin cálculo ni fuente nunca se considera
 * un cero real: se degrada a desconocido.
 */
export function interpretarValorLegado(
  entrada: EntradaValorLegado,
): ValorLegadoInterpretado {
  const { raw } = entrada;

  if (raw == null || !Number.isFinite(raw)) {
    return {
      amount: null,
      interpretation: "absent",
      trustworthy: false,
      reason: "La columna no tiene valor guardado.",
    };
  }

  if (raw !== 0) {
    return {
      amount: raw,
      interpretation: "real_value",
      trustworthy: entrada.wasCalculated || entrada.hasBackingSource,
      reason: entrada.hasBackingSource
        ? "Valor distinto de cero con fuente que lo respalda."
        : "Valor distinto de cero guardado por el motor.",
    };
  }

  if (!entrada.wasCalculated) {
    return {
      amount: null,
      interpretation: "never_calculated",
      trustworthy: false,
      reason:
        "La fila nunca se calculó: el cero proviene del valor por omisión de la columna.",
    };
  }

  if (entrada.hasBackingSource) {
    return {
      amount: 0,
      interpretation: "explicit_zero",
      trustworthy: true,
      reason: "Cero respaldado por una fuente tributaria.",
    };
  }

  if (entrada.columnDefaultsToZero) {
    return {
      amount: null,
      interpretation: "unknown_zero",
      trustworthy: false,
      reason:
        "La columna tiene cero por omisión y no hay fuente que confirme el cero: se trata como desconocido.",
    };
  }

  return {
    amount: 0,
    interpretation: "explicit_zero",
    trustworthy: true,
    reason: "La columna admite nulos, por lo que el cero fue escrito a propósito.",
  };
}

/** Traduce un conjunto de columnas legadas de una sola fila. */
export function interpretarFilaLegada<K extends string>(
  campos: Record<K, EntradaValorLegado>,
): Record<K, ValorLegadoInterpretado> {
  const salida = {} as Record<K, ValorLegadoInterpretado>;
  for (const clave of Object.keys(campos) as K[]) {
    salida[clave] = interpretarValorLegado(campos[clave]);
  }
  return salida;
}
