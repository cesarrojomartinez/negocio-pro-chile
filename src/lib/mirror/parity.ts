/**
 * Paridad productiva entre el motor legado y la proyección de compatibilidad
 * (Etapa 6.8.1).
 *
 * Regla dura: `unified_raw` puede diferir del motor antiguo, pero
 * `compatibility_projection` no puede diferir en ningún campo productivo.
 * No existe tolerancia monetaria: una diferencia de $1 bloquea la promoción.
 *
 * Módulo puro.
 */
import type { ProductiveTaxSummary } from "./productiveSummary";

export type ProductiveDifferenceKind =
  | "compatibility_mapping_error"
  | "legacy_rounding_difference"
  | "missing_legacy_input"
  | "source_resolution_difference"
  | "known_legacy_bug"
  | "expected_rule_improvement"
  | "persistence_mapping_error"
  | "unexplained_difference";

/** Diferencias tolerables solo dentro de `dual_validation`. */
export const DIFERENCIAS_ADMISIBLES_EN_DUAL: ProductiveDifferenceKind[] = [
  "known_legacy_bug",
  "expected_rule_improvement",
];

export type CampoProductivo = keyof ProductiveTaxSummary;

/** Campos productivos comparados. Incluye montos, estados y fuentes. */
export const CAMPOS_PRODUCTIVOS: CampoProductivo[] = [
  "salesTotal",
  "exemptSales",
  "purchasesTotal",
  "vatDebit",
  "vatCredit",
  "previousVatCarryforward",
  "estimatedVatPayable",
  "estimatedNewCarryforward",
  "ppmTaxBase",
  "ppmRate",
  "estimatedPpm",
  "estimatedWithholdings",
  "vatAdvanceApplied",
  "estimatedTaxTotal",
  "preventiveMarginPercent",
  "preventiveMarginAmount",
  "recommendedReserve",
  "reservedAmount",
  "declaredTaxTotal",
  "carryforwardSource",
  "ppmSource",
  "withholdingsSource",
  "periodState",
];

export interface DiferenciaProductiva {
  field: CampoProductivo;
  legacyValue: number | string | null;
  compatibilityValue: number | string | null;
  difference: number | null;
  kind: ProductiveDifferenceKind;
  explanation: string;
}

export interface ReporteParidad {
  companyId: string | null;
  period: string;
  fieldsCompared: number;
  differences: DiferenciaProductiva[];
  /** Paridad exacta: cero diferencias en todos los campos productivos. */
  exactParity: boolean;
  /** Diferencias que impiden promover la empresa a `compatibility`. */
  blockingDifferences: DiferenciaProductiva[];
}

function clasificar(
  field: CampoProductivo,
  legacyValue: number | string | null,
  compatibilityValue: number | string | null,
  pistas: { legacyFallbackApplied?: boolean },
): DiferenciaProductiva {
  const numerico =
    typeof legacyValue === "number" && typeof compatibilityValue === "number";
  const difference = numerico
    ? Number(((legacyValue as number) - (compatibilityValue as number)).toFixed(2))
    : null;

  let kind: ProductiveDifferenceKind;
  let explanation: string;

  if (legacyValue == null || compatibilityValue == null) {
    kind = pistas.legacyFallbackApplied
      ? "missing_legacy_input"
      : "compatibility_mapping_error";
    explanation =
      "Uno de los motores entrega un valor ausente donde el otro entrega cifra.";
  } else if (typeof legacyValue === "string" || typeof compatibilityValue === "string") {
    kind = "source_resolution_difference";
    explanation = "El estado o la fuente resuelta difiere entre ambos motores.";
  } else if (difference != null && Math.abs(difference) <= 1) {
    kind = "legacy_rounding_difference";
    explanation = "Diferencia de redondeo de hasta un peso.";
  } else if (field === "recommendedReserve" || field === "preventiveMarginAmount") {
    kind = "persistence_mapping_error";
    explanation = "La reserva derivada no coincide con el total proyectado.";
  } else {
    kind = "unexplained_difference";
    explanation = "Diferencia sin causa declarada: requiere revisión.";
  }

  return { field, legacyValue, compatibilityValue, difference, kind, explanation };
}

/**
 * Compara campo a campo. La proyección de compatibilidad debe reproducir
 * exactamente lo que el motor antiguo mostraba.
 */
export function compararParidadProductiva(entrada: {
  companyId?: string | null;
  period: string;
  legacy: ProductiveTaxSummary;
  compatibility: ProductiveTaxSummary;
  legacyFallbackApplied?: boolean;
  /** Diferencias ya revisadas y aceptadas, por campo. */
  aceptadas?: Partial<Record<CampoProductivo, ProductiveDifferenceKind>>;
}): ReporteParidad {
  const differences: DiferenciaProductiva[] = [];

  for (const field of CAMPOS_PRODUCTIVOS) {
    const a = entrada.legacy[field] as number | string | null;
    const b = entrada.compatibility[field] as number | string | null;
    if (a === b) continue;
    const clasificada = clasificar(field, a, b, {
      legacyFallbackApplied: entrada.legacyFallbackApplied,
    });
    const aceptada = entrada.aceptadas?.[field];
    differences.push(aceptada ? { ...clasificada, kind: aceptada } : clasificada);
  }

  return {
    companyId: entrada.companyId ?? null,
    period: entrada.period,
    fieldsCompared: CAMPOS_PRODUCTIVOS.length,
    differences,
    exactParity: differences.length === 0,
    // Ninguna diferencia visible es admisible: la proyección debe reproducir
    // la pantalla actual incluso cuando el núcleo mejore la regla.
    blockingDifferences: differences,
  };
}
