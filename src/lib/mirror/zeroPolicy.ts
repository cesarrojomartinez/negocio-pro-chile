/**
 * Política de ceros por regla del Motor Espejo.
 *
 * Cada regla declara qué significa un cero en su resultado. La política se
 * valida contra el valor calculado: un cero sin respaldo queda registrado
 * como aviso y nunca se presenta como cifra confirmada.
 *
 * Módulo puro.
 */
import type { TaxComponentValue } from "./certainty";

export type ZeroPolicy =
  /** Solo la fuente puede declarar el cero (F29, RCV, confirmación). */
  | "explicit_only"
  /** Vale el cero de fuente y el cero calculado con antecedentes completos. */
  | "explicit_or_calculated"
  /** El concepto no admite negativos: el cero puede venir del piso. */
  | "floor_at_zero"
  /** El cero no tiene sentido tributario en este concepto. */
  | "zero_forbidden";

export const POLITICA_CERO_POR_REGLA: Record<string, ZeroPolicy> = {
  SALES_TAXABLE: "explicit_only",
  SALES_EXEMPT: "explicit_only",
  SALES_TOTAL: "explicit_only",
  PURCHASES_TAXABLE: "explicit_only",
  PURCHASES_EXEMPT: "explicit_only",
  PURCHASES_TOTAL: "explicit_only",
  VAT_DEBIT_FROM_RCV_SUMMARY: "explicit_or_calculated",
  VAT_TOTAL_PURCHASES: "explicit_or_calculated",
  VAT_COMMON_USE: "explicit_only",
  VAT_NON_RECOVERABLE: "explicit_only",
  VAT_CREDIT_RECOVERABLE: "explicit_or_calculated",
  PREVIOUS_CARRYFORWARD: "explicit_only",
  ADJUSTMENT_FACTOR: "zero_forbidden",
  ADJUSTED_PREVIOUS_CARRYFORWARD: "explicit_or_calculated",
  VAT_POSITION: "floor_at_zero",
  NEXT_CARRYFORWARD: "floor_at_zero",
  PPM_BASE: "explicit_or_calculated",
  PPM_RATE: "zero_forbidden",
  PPM_AMOUNT: "explicit_or_calculated",
  WITHHOLDINGS: "explicit_only",
  VAT_ADVANCE_CHANGE_OF_SUBJECT: "explicit_only",
  TAX_TOTAL_BEFORE_SURCHARGES: "floor_at_zero",
  SURCHARGES: "explicit_or_calculated",
  TAX_TOTAL_DECLARED: "explicit_only",
  PAYMENT_STATUS_RESOLUTION: "explicit_only",
};

export function politicaCero(ruleId: string): ZeroPolicy {
  return POLITICA_CERO_POR_REGLA[ruleId] ?? "explicit_only";
}

/**
 * Comprueba que el cero de un componente esté respaldado por su política.
 * Devuelve la lista de infracciones; vacía significa que el cero es legítimo.
 */
export function validarPoliticaCero(valor: TaxComponentValue): string[] {
  if (valor.amount !== 0) return [];
  const politica = politicaCero(valor.ruleId);
  const infracciones: string[] = [];

  if (politica === "zero_forbidden") {
    infracciones.push(`cero_no_valido_para_${valor.ruleId}`);
    return infracciones;
  }
  if (!valor.explicitlyReportedZero) {
    infracciones.push(`cero_sin_respaldo_en_${valor.ruleId}`);
  }
  if (politica === "explicit_only" && valor.zeroKind === "calculated_zero") {
    infracciones.push(`cero_calculado_no_permitido_en_${valor.ruleId}`);
  }
  return infracciones;
}

export interface EntradaAuditoriaCero {
  concept: string;
  ruleId: string;
  policy: ZeroPolicy;
  violations: string[];
}

export type AuditoriaCeros = EntradaAuditoriaCero[];

/** Auditoría de todos los ceros de un periodo. */
export function auditarCeros(valores: TaxComponentValue[]): AuditoriaCeros {
  return valores
    .filter((v) => v.amount === 0)
    .map((v) => ({
      concept: v.concept,
      ruleId: v.ruleId,
      policy: politicaCero(v.ruleId),
      violations: validarPoliticaCero(v),
    }));
}
