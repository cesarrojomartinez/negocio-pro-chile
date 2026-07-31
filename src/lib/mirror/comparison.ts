/**
 * Comparación entre el motor actual, el Motor Espejo y el F29 oficial.
 *
 * Solo mide y explica: no sobrescribe cifras ni corrige al motor productivo.
 * La comparación es por componente, no solo por total, y conserva las causas
 * detectadas y los antecedentes faltantes.
 *
 * Módulo puro.
 */
import { montoDe } from "./engine";
import type { MirrorConcept, MirrorEngineResult } from "./types";

export type ComparisonStatus =
  | "exact"
  | "within_tolerance"
  | "material_difference"
  | "missing_inputs"
  | "unsupported"
  | "no_official_reference";

export interface DiferenciaComponente {
  concept: MirrorConcept;
  label: string;
  currentEngine: number | null;
  mirrorEngine: number | null;
  official: number | null;
  /** espejo − oficial. */
  mirrorVsOfficial: number | null;
  /** actual − espejo. */
  currentVsMirror: number | null;
  percentage: number | null;
  causes: string[];
  missingInputs: string[];
  ruleId: string | null;
  ruleVersion: string | null;
  status: ComparisonStatus;
}

export interface ComparacionMotores {
  companyId: string | null;
  period: string;
  currentEngineTotal: number | null;
  mirrorEngineTotal: number | null;
  officialTotal: number | null;
  currentVsMirrorDifference: number | null;
  currentVsOfficialDifference: number | null;
  mirrorVsOfficialDifference: number | null;
  componentDifferences: DiferenciaComponente[];
  comparisonStatus: ComparisonStatus;
}

/** Componentes comparables y su etiqueta en español. */
export const COMPONENTES_COMPARABLES: { concept: MirrorConcept; label: string }[] = [
  { concept: "vat_debit", label: "IVA débito" },
  { concept: "recoverable_vat_credit", label: "IVA crédito" },
  { concept: "previous_nominal_carryforward", label: "Remanente anterior" },
  { concept: "next_carryforward", label: "Remanente siguiente" },
  { concept: "vat_determined", label: "IVA determinado" },
  { concept: "ppm_base", label: "Base del PPM" },
  { concept: "ppm_rate", label: "Tasa de PPM" },
  { concept: "ppm_amount", label: "PPM" },
  { concept: "withholdings", label: "Retenciones" },
  { concept: "vat_advance_change_of_subject", label: "Anticipo de IVA" },
  { concept: "surcharges", label: "Recargos" },
  { concept: "tax_total_before_surcharges", label: "Total del periodo" },
];

/** Montos del motor productivo, en los mismos conceptos comparables. */
export type MontosMotorActual = Partial<Record<MirrorConcept, number | null>>;
/** Montos oficiales del F29, en los mismos conceptos comparables. */
export type MontosOficiales = Partial<Record<MirrorConcept, number | null>>;

const TOLERANCIA_ABSOLUTA = 1;
const TOLERANCIA_PORCENTUAL = 1; // 1 %

function diferencia(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return Number((a - b).toFixed(2));
}

function estadoDeDiferencia(
  espejo: number | null,
  oficial: number | null,
  faltantes: string[],
  unsupported: boolean,
): ComparisonStatus {
  if (unsupported) return "unsupported";
  if (oficial == null) return "no_official_reference";
  if (espejo == null) return faltantes.length > 0 ? "missing_inputs" : "no_official_reference";
  const dif = Math.abs(espejo - oficial);
  if (dif < 0.5) return "exact";
  const pct = oficial === 0 ? Infinity : (dif / Math.abs(oficial)) * 100;
  if (dif <= TOLERANCIA_ABSOLUTA || pct <= TOLERANCIA_PORCENTUAL) return "within_tolerance";
  return "material_difference";
}

function causas(
  concepto: MirrorConcept,
  espejo: number | null,
  oficial: number | null,
  warnings: string[],
): string[] {
  const salida = [...warnings];
  if (espejo != null && oficial != null && Math.abs(espejo - oficial) >= 1) {
    salida.push(`diferencia_en_${concepto}`);
  }
  if (espejo == null && oficial != null) salida.push(`sin_estimacion_para_${concepto}`);
  return salida;
}

export function compararMotores(entrada: {
  companyId?: string | null;
  period: string;
  mirror: MirrorEngineResult;
  currentEngine: MontosMotorActual;
  official: MontosOficiales;
  /** Total declarado oficial (código 91). */
  officialTotal: number | null;
  /** Total del motor productivo. */
  currentEngineTotal: number | null;
}): ComparacionMotores {
  const { mirror, currentEngine, official } = entrada;
  const mirrorTotal = montoDe(mirror, "tax_total_before_surcharges");

  const componentDifferences: DiferenciaComponente[] = COMPONENTES_COMPARABLES.map(
    ({ concept, label }) => {
      const comp = mirror.components.find((c) => c.concept === concept) ?? null;
      const espejo = comp?.amount ?? null;
      const oficial = official[concept] ?? null;
      const actual = currentEngine[concept] ?? null;
      const dif = diferencia(espejo, oficial);
      return {
        concept,
        label,
        currentEngine: actual,
        mirrorEngine: espejo,
        official: oficial,
        mirrorVsOfficial: dif,
        currentVsMirror: diferencia(actual, espejo),
        percentage:
          dif != null && oficial != null && oficial !== 0
            ? Number(((dif / Math.abs(oficial)) * 100).toFixed(2))
            : null,
        causes: causas(concept, espejo, oficial, comp?.warnings ?? []),
        missingInputs: comp?.missingInputs ?? [],
        ruleId: comp?.ruleId ?? null,
        ruleVersion: comp?.ruleVersion ?? null,
        status: estadoDeDiferencia(
          espejo,
          oficial,
          comp?.missingInputs ?? [],
          comp?.status === "unsupported",
        ),
      };
    },
  );

  const estadoTotal = estadoDeDiferencia(
    mirrorTotal,
    entrada.officialTotal,
    mirror.components.flatMap((c) => c.missingInputs),
    false,
  );

  return {
    companyId: entrada.companyId ?? null,
    period: entrada.period,
    currentEngineTotal: entrada.currentEngineTotal,
    mirrorEngineTotal: mirrorTotal,
    officialTotal: entrada.officialTotal,
    currentVsMirrorDifference: diferencia(entrada.currentEngineTotal, mirrorTotal),
    currentVsOfficialDifference: diferencia(entrada.currentEngineTotal, entrada.officialTotal),
    mirrorVsOfficialDifference: diferencia(mirrorTotal, entrada.officialTotal),
    componentDifferences,
    comparisonStatus: estadoTotal,
  };
}
