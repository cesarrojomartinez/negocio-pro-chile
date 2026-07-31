/**
 * Aritmética tributaria segura del Motor Espejo.
 *
 * Ninguna operación convierte un desconocido en cero. Si falta un operando
 * obligatorio, el resultado es `null` y se registra qué faltó.
 *
 * Módulo puro.
 */

export interface OperandoTributario {
  key: string;
  amount: number | null;
  /** Un operando opcional ausente no invalida la operación, pero se registra. */
  optional?: boolean;
}

export interface ResultadoAritmetico {
  amount: number | null;
  missingInputs: string[];
  /** Operandos opcionales ausentes que se omitieron de la operación. */
  omittedOptionalInputs: string[];
  complete: boolean;
}

function vacio(): ResultadoAritmetico {
  return { amount: null, missingInputs: [], omittedOptionalInputs: [], complete: false };
}

function faltantes(operandos: OperandoTributario[]) {
  const missing: string[] = [];
  const omitted: string[] = [];
  for (const o of operandos) {
    if (o.amount != null && Number.isFinite(o.amount)) continue;
    if (o.optional) omitted.push(o.key);
    else missing.push(o.key);
  }
  return { missing, omitted };
}

/** Suma. Un obligatorio ausente anula el resultado. */
export function sumarConocidos(operandos: OperandoTributario[]): ResultadoAritmetico {
  const { missing, omitted } = faltantes(operandos);
  if (missing.length > 0) {
    return { ...vacio(), missingInputs: missing, omittedOptionalInputs: omitted };
  }
  const presentes = operandos.filter((o) => o.amount != null);
  if (presentes.length === 0) {
    return { ...vacio(), omittedOptionalInputs: omitted };
  }
  const total = presentes.reduce((acc, o) => acc + (o.amount as number), 0);
  return {
    amount: Math.round(total),
    missingInputs: [],
    omittedOptionalInputs: omitted,
    complete: omitted.length === 0,
  };
}

/** Resta: minuendo menos cada sustraendo. */
export function restarConocidos(
  minuendo: OperandoTributario,
  sustraendos: OperandoTributario[],
): ResultadoAritmetico {
  return sumarConocidos([
    minuendo,
    ...sustraendos.map((s) => ({
      ...s,
      amount: s.amount == null ? null : -s.amount,
    })),
  ]);
}

/** Producto. Ambos factores deben existir. */
export function multiplicarConocidos(
  a: OperandoTributario,
  b: OperandoTributario,
  opciones: { redondear?: boolean } = {},
): ResultadoAritmetico {
  const { missing, omitted } = faltantes([a, b]);
  if (missing.length > 0 || a.amount == null || b.amount == null) {
    return { ...vacio(), missingInputs: missing, omittedOptionalInputs: omitted };
  }
  const bruto = a.amount * b.amount;
  return {
    amount: opciones.redondear === false ? bruto : Math.round(bruto),
    missingInputs: [],
    omittedOptionalInputs: omitted,
    complete: true,
  };
}

/**
 * Piso en cero para conceptos que no admiten monto negativo. El cero
 * resultante es un cero calculado, no un cero de fuente.
 */
export function pisoCero(resultado: ResultadoAritmetico): ResultadoAritmetico {
  if (resultado.amount == null) return resultado;
  return { ...resultado, amount: Math.max(0, resultado.amount) };
}

/** Compara dos montos tolerando el redondeo al peso. */
export function coincidenEnPesos(
  a: number | null,
  b: number | null,
  tolerancia = 1,
): boolean | null {
  if (a == null || b == null) return null;
  return Math.abs(a - b) <= tolerancia;
}
