/**
 * Comparación triple por periodo (Etapa 6.8.1).
 *
 * A. legacy_original            — motor anterior (shadow / dual_validation).
 * B. unified_raw                — resultado puro del núcleo.
 * C. compatibility_projection   — resultado adaptado al contrato antiguo.
 * D. official_f29               — resultado oficial cuando existe.
 *
 * Se comparan todos los pares exigidos, por componente y no solo por total.
 *
 * Módulo puro.
 */
import type { MirrorConcept } from "./types";
import type { PeriodCalculationResult } from "./unifiedTaxEngine";
import { montoUnificado } from "./unifiedTaxEngine";
import type { ProductiveTaxSummary } from "./productiveSummary";

export type ParComparado =
  | "legacy_vs_compatibility"
  | "legacy_vs_unified"
  | "unified_vs_official"
  | "compatibility_vs_official";

export interface FilaComparacionTriple {
  concept: MirrorConcept;
  label: string;
  pair: ParComparado;
  valueA: number | null;
  valueB: number | null;
  difference: number | null;
  percentage: number | null;
  category: "exact" | "difference" | "missing_reference";
  cause: string;
  ruleId: string | null;
  source: string;
  status: string;
}

export interface ComparacionTriple {
  companyId: string | null;
  period: string;
  engineVersion: string;
  rows: FilaComparacionTriple[];
  totals: {
    legacy: number | null;
    unified: number | null;
    compatibility: number | null;
    official: number | null;
  };
}

/** Conceptos comparables y su equivalente en el contrato productivo. */
const MAPA: {
  concept: MirrorConcept;
  label: string;
  productive: keyof ProductiveTaxSummary;
}[] = [
  { concept: "vat_debit", label: "IVA débito", productive: "vatDebit" },
  {
    concept: "recoverable_vat_credit",
    label: "IVA crédito",
    productive: "vatCredit",
  },
  {
    concept: "previous_nominal_carryforward",
    label: "Remanente anterior",
    productive: "previousVatCarryforward",
  },
  {
    concept: "vat_determined",
    label: "IVA determinado",
    productive: "estimatedVatPayable",
  },
  {
    concept: "next_carryforward",
    label: "Remanente siguiente",
    productive: "estimatedNewCarryforward",
  },
  { concept: "ppm_base", label: "Base del PPM", productive: "ppmTaxBase" },
  { concept: "ppm_rate", label: "Tasa de PPM", productive: "ppmRate" },
  { concept: "ppm_amount", label: "PPM", productive: "estimatedPpm" },
  {
    concept: "withholdings",
    label: "Retenciones",
    productive: "estimatedWithholdings",
  },
  {
    concept: "vat_advance_change_of_subject",
    label: "Anticipo de IVA",
    productive: "vatAdvanceApplied",
  },
  {
    concept: "tax_total_before_surcharges",
    label: "Total del periodo",
    productive: "estimatedTaxTotal",
  },
];

function numero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function fila(
  concept: MirrorConcept,
  label: string,
  pair: ParComparado,
  a: number | null,
  b: number | null,
  extra: { ruleId: string | null; source: string; status: string; cause: string },
): FilaComparacionTriple {
  const difference = a == null || b == null ? null : Number((a - b).toFixed(2));
  return {
    concept,
    label,
    pair,
    valueA: a,
    valueB: b,
    difference,
    percentage:
      difference != null && b != null && b !== 0
        ? Number(((difference / Math.abs(b)) * 100).toFixed(2))
        : null,
    category:
      difference == null ? "missing_reference" : difference === 0 ? "exact" : "difference",
    cause: difference == null || difference === 0 ? "" : extra.cause,
    ruleId: extra.ruleId,
    source: extra.source,
    status: extra.status,
  };
}

export function construirComparacionTriple(entrada: {
  companyId?: string | null;
  period: string;
  legacy: ProductiveTaxSummary | null;
  unified: PeriodCalculationResult;
  compatibility: ProductiveTaxSummary;
  official?: Partial<Record<MirrorConcept, number | null>>;
  officialTotal?: number | null;
}): ComparacionTriple {
  const rows: FilaComparacionTriple[] = [];

  for (const { concept, label, productive } of MAPA) {
    const componente = entrada.unified.components.find((c) => c.concept === concept);
    const extra = {
      ruleId: componente?.ruleId ?? null,
      source: componente?.sources.join(",") ?? "",
      status: componente?.status ?? "unavailable",
      cause: componente?.warnings.join("; ") || `diferencia_en_${concept}`,
    };
    const unified = montoUnificado(entrada.unified, concept);
    const compat = numero(entrada.compatibility[productive]);
    const legacy = entrada.legacy ? numero(entrada.legacy[productive]) : null;
    const oficial = entrada.official?.[concept] ?? null;

    if (entrada.legacy) {
      rows.push(fila(concept, label, "legacy_vs_compatibility", legacy, compat, extra));
      rows.push(fila(concept, label, "legacy_vs_unified", legacy, unified, extra));
    }
    rows.push(fila(concept, label, "unified_vs_official", unified, oficial, extra));
    rows.push(
      fila(concept, label, "compatibility_vs_official", compat, oficial, extra),
    );
  }

  return {
    companyId: entrada.companyId ?? null,
    period: entrada.period,
    engineVersion: entrada.unified.engineVersion,
    rows,
    totals: {
      legacy: entrada.legacy?.estimatedTaxTotal ?? null,
      unified: montoUnificado(entrada.unified, "tax_total_before_surcharges"),
      compatibility: entrada.compatibility.estimatedTaxTotal,
      official: entrada.officialTotal ?? null,
    },
  };
}
