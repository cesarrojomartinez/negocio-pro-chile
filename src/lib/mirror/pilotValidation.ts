/**
 * Validación dual piloto y resultados de paridad persistibles (Etapa 6.8.2).
 *
 * Compara, por periodo y por campo visible:
 *   legacy_original vs compatibility_projection  → diferencia obligatoria 0.
 *   unified_raw     vs official_f29              → diferencia informativa.
 *
 * Cero consultas externas: solo consume el resultado del orquestador único.
 * Módulo puro.
 */
import type { ResultadoCalculoPeriodo } from "./calculationOrchestrator";
import { CAMPOS_PRODUCTIVOS, type CampoProductivo } from "./parity";
import type { ProductiveTaxSummary } from "./productiveSummary";
import type { FilaComparacionTriple } from "./tripleComparison";
import {
  crearSnapshotParidadProductiva,
  revisarSanitizacionSnapshot,
  type AliasPiloto,
  type SnapshotParidadProductiva,
} from "./pilot";
import { COMPATIBILITY_PROJECTION_VERSION } from "./legacyProjection";
import { UNIFIED_ENGINE_VERSION } from "./unifiedTaxEngine";

export const PILOT_PROMOTION_BLOCKED = "PILOT_PROMOTION_BLOCKED" as const;

export type CategoriaParidad =
  | "exact"
  | "compatibility_exact_unified_improved"
  | "known_legacy_difference"
  | "missing_input"
  | "unexplained_difference"
  | "blocked";

export interface FilaResultadoParidad {
  companyAlias: AliasPiloto;
  period: string;
  field: string;
  legacyValue: string | null;
  unifiedRawValue: string | null;
  compatibilityValue: string | null;
  officialValue: string | null;
  legacyVsCompatibilityDifference: number | null;
  unifiedVsOfficialDifference: number | null;
  differenceCategory: CategoriaParidad;
  explanation: string;
  blocking: boolean;
  calculationInputHash: string;
  validatedAt: string;
}

/** Campos visibles que no viven en `ProductiveTaxSummary`. */
export interface ContextoVisiblePiloto {
  mainLabels?: string[];
  legacyMainLabels?: string[];
  declarationPresented?: boolean;
  legacyDeclarationPresented?: boolean;
  paymentSituation?: string;
  legacyPaymentSituation?: string;
  incompletenessMessage?: string | null;
  legacyIncompletenessMessage?: string | null;
  periodSource?: string;
  legacyPeriodSource?: string;
  salesCount?: number | null;
  purchasesCount?: number | null;
  legacySalesCount?: number | null;
  legacyPurchasesCount?: number | null;
  officialFolio?: string | number | null;
  hasOfficialF29?: boolean;
}

export interface EntradaValidacionPiloto {
  companyAlias: AliasPiloto;
  period: string;
  resultado: ResultadoCalculoPeriodo;
  /** Salida del motor antiguo tal como se muestra hoy. */
  legacy: ProductiveTaxSummary | null;
  /** Salida de la proyección de compatibilidad. */
  compatibility: ProductiveTaxSummary;
  visible?: ContextoVisiblePiloto;
  /**
   * Campos que el contrato antiguo nunca persistió (por ejemplo el anticipo
   * de IVA). Su ausencia se registra como `missing_input` informativo y no
   * bloquea: no representa una diferencia visible en pantalla.
   */
  camposSinRegistroLegado?: string[];
  validatedAt?: string;

}

export interface ResultadoValidacionPiloto {
  companyAlias: AliasPiloto;
  period: string;
  calculationInputHash: string;
  rows: FilaResultadoParidad[];
  snapshot: SnapshotParidadProductiva;
  exact: boolean;
  blockingReasons: string[];
  compatibilityDifferences: number;
  officialDifferences: number;
  compatibilityFallbacks: number;
  runReused: boolean;
}

function texto(valor: unknown): string | null {
  if (valor == null) return null;
  return `${valor}`;
}

function diferenciaNumerica(a: unknown, b: unknown): number | null {
  if (typeof a !== "number" || typeof b !== "number") return null;
  return Number((a - b).toFixed(2));
}

function unifiedYOficial(
  rows: FilaComparacionTriple[] | undefined,
  campo: CampoProductivo,
): { unified: number | null; official: number | null; difference: number | null } {
  const mapa: Partial<Record<CampoProductivo, string>> = {
    vatDebit: "vat_debit",
    vatCredit: "recoverable_vat_credit",
    previousVatCarryforward: "previous_nominal_carryforward",
    estimatedVatPayable: "vat_determined",
    estimatedNewCarryforward: "next_carryforward",
    ppmTaxBase: "ppm_base",
    ppmRate: "ppm_rate",
    estimatedPpm: "ppm_amount",
    estimatedWithholdings: "withholdings",
    vatAdvanceApplied: "vat_advance_change_of_subject",
    estimatedTaxTotal: "tax_total_before_surcharges",
  };
  const concepto = mapa[campo];
  if (!concepto || !rows) return { unified: null, official: null, difference: null };
  const fila = rows.find(
    (r) => r.concept === concepto && r.pair === "unified_vs_official",
  );
  if (!fila) return { unified: null, official: null, difference: null };
  return { unified: fila.valueA, official: fila.valueB, difference: fila.difference };
}

function clasificar(
  diferenciaCompat: number | null,
  igualesCompat: boolean,
  diferenciaOficial: number | null,
  faltaEntrada: boolean,
): { categoria: CategoriaParidad; explicacion: string; blocking: boolean } {
  if (igualesCompat) {
    if (diferenciaOficial != null && diferenciaOficial !== 0) {
      return {
        categoria: "compatibility_exact_unified_improved",
        explicacion:
          "La proyección reproduce la pantalla actual; el núcleo difiere del F29 y queda registrado.",
        blocking: false,
      };
    }
    return { categoria: "exact", explicacion: "Sin diferencias.", blocking: false };
  }
  // El motor antiguo se aparta del formulario y el núcleo lo reproduce exacto:
  // es una corrección deliberada, documentada y no bloqueante.
  if (diferenciaOficial === 0) {
    return {
      categoria: "known_legacy_difference",
      explicacion:
        "La proyección coincide exactamente con el F29 oficial y el motor antiguo se apartaba de él. Corrección deliberada.",
      blocking: false,
    };
  }
  if (faltaEntrada) {
    return {
      categoria: "missing_input",
      explicacion: "Uno de los motores no dispone del antecedente requerido.",
      blocking: true,
    };
  }
  if (diferenciaCompat == null) {
    return {
      categoria: "unexplained_difference",
      explicacion: "Diferencia no monetaria entre estado, fuente o etiqueta visible.",
      blocking: true,
    };
  }
  return {
    categoria: "unexplained_difference",
    explicacion: `Diferencia monetaria de ${diferenciaCompat} entre el motor antiguo y la proyección.`,
    blocking: true,
  };
}

function filaVisible(
  base: { companyAlias: AliasPiloto; period: string; hash: string; validatedAt: string },
  field: string,
  legacyValue: unknown,
  compatibilityValue: unknown,
): FilaResultadoParidad | null {
  if (legacyValue === undefined && compatibilityValue === undefined) return null;
  const a = texto(legacyValue);
  const b = texto(compatibilityValue);
  if (a === b) return null;
  return {
    companyAlias: base.companyAlias,
    period: base.period,
    field,
    legacyValue: a,
    unifiedRawValue: null,
    compatibilityValue: b,
    officialValue: null,
    legacyVsCompatibilityDifference: null,
    unifiedVsOfficialDifference: null,
    differenceCategory: "unexplained_difference",
    explanation: `El elemento visible «${field}» difiere entre el motor antiguo y la proyección.`,
    blocking: true,
    calculationInputHash: base.hash,
    validatedAt: base.validatedAt,
  };
}

/**
 * Ejecuta la comparación completa de un periodo piloto y devuelve las filas
 * persistibles, la fotografía sanitizada y las causas de bloqueo.
 */
export function validarPeriodoPiloto(
  entrada: EntradaValidacionPiloto,
): ResultadoValidacionPiloto {
  const validatedAt = entrada.validatedAt ?? new Date().toISOString();
  const hash = entrada.resultado.calculationInputHash;
  const base = {
    companyAlias: entrada.companyAlias,
    period: entrada.period,
    hash,
    validatedAt,
  };
  const visible = entrada.visible ?? {};
  const rows: FilaResultadoParidad[] = [];
  const blockingReasons: string[] = [];
  let compatibilityDifferences = 0;
  let officialDifferences = 0;

  const tripleRows = entrada.resultado.tripleComparison?.rows;

  const sinRegistroLegado = new Set(entrada.camposSinRegistroLegado ?? []);

  for (const campo of CAMPOS_PRODUCTIVOS) {
    const legacyValue = entrada.legacy ? entrada.legacy[campo] : null;
    const compatibilityValue = entrada.compatibility[campo];
    const sinRegistro = sinRegistroLegado.has(campo) && legacyValue == null;
    const iguales = !entrada.legacy || sinRegistro ? true : legacyValue === compatibilityValue;
    const difCompat =
      entrada.legacy && !sinRegistro
        ? diferenciaNumerica(legacyValue, compatibilityValue)
        : null;
    const oficial = unifiedYOficial(tripleRows, campo);
    const faltaEntrada =
      !iguales && (legacyValue == null || compatibilityValue == null);
    const clasificacion = sinRegistro
      ? {
          categoria: "missing_input" as CategoriaParidad,
          explicacion:
            "El contrato antiguo nunca registró este componente; no hay diferencia visible.",
          blocking: false,
        }
      : clasificar(difCompat, iguales, oficial.difference, faltaEntrada);

    if (!iguales) {
      compatibilityDifferences += 1;
      blockingReasons.push(`diferencia_compatibilidad:${entrada.period}:${campo}`);
    }
    if (oficial.difference != null && oficial.difference !== 0) officialDifferences += 1;


    rows.push({
      companyAlias: entrada.companyAlias,
      period: entrada.period,
      field: campo,
      legacyValue: entrada.legacy ? texto(legacyValue) : null,
      unifiedRawValue: texto(oficial.unified),
      compatibilityValue: texto(compatibilityValue),
      officialValue: texto(oficial.official),
      legacyVsCompatibilityDifference: difCompat,
      unifiedVsOfficialDifference: oficial.difference,
      differenceCategory: clasificacion.categoria,
      explanation: clasificacion.explicacion,
      blocking: clasificacion.blocking,
      calculationInputHash: hash,
      validatedAt,
    });
  }

  // Elementos visibles fuera del contrato numérico: etiquetas, mensajes y fuentes.
  const visibles: [string, unknown, unknown][] = [
    [
      "mainLabels",
      visible.legacyMainLabels ? visible.legacyMainLabels.join("|") : undefined,
      visible.mainLabels ? visible.mainLabels.join("|") : undefined,
    ],
    ["declarationPresented", visible.legacyDeclarationPresented, visible.declarationPresented],
    ["paymentSituation", visible.legacyPaymentSituation, visible.paymentSituation],
    [
      "incompletenessMessage",
      visible.legacyIncompletenessMessage,
      visible.incompletenessMessage,
    ],
    ["periodSource", visible.legacyPeriodSource, visible.periodSource],
    ["salesCount", visible.legacySalesCount, visible.salesCount],
    ["purchasesCount", visible.legacyPurchasesCount, visible.purchasesCount],
  ];
  for (const [campo, a, b] of visibles) {
    const fila = filaVisible(base, campo, a, b);
    if (!fila) continue;
    rows.push(fila);
    compatibilityDifferences += 1;
    blockingReasons.push(`diferencia_visible:${entrada.period}:${campo}`);
  }

  // Bloqueos estructurales del periodo (sección 9 de la etapa).
  if (entrada.resultado.runStatus === "failed") {
    blockingReasons.push(`run_fallido:${entrada.period}`);
  }
  if (!hash) blockingReasons.push(`hash_faltante:${entrada.period}`);
  if (!entrada.resultado.persistable && entrada.resultado.runStatus !== "reused") {
    blockingReasons.push(`periodo_sin_calculo_completo:${entrada.period}`);
  }
  for (const error of entrada.resultado.errors) {
    blockingReasons.push(`error_sin_clasificar:${entrada.period}:${error}`);
  }
  if (
    entrada.resultado.mode === "compatibility" &&
    entrada.resultado.calculationEngine !== "unified"
  ) {
    blockingReasons.push(`llamada_legada_en_compatibility:${entrada.period}`);
  }

  const snapshot = crearSnapshotParidadProductiva({
    companyAlias: entrada.companyAlias,
    period: entrada.period,
    calculationInputHash: hash,
    productive: entrada.compatibility,
    mainLabels: visible.mainLabels,
    hasOfficialF29: visible.hasOfficialF29,
    officialFolio: visible.officialFolio ?? null,
    declarationPresented: visible.declarationPresented,
    paymentSituation: visible.paymentSituation,
    incompletenessMessage: visible.incompletenessMessage ?? null,
    periodSource: visible.periodSource,
    engineVersion: entrada.resultado.engineVersion,
    projectionVersion: entrada.resultado.compatibilityProjectionVersion,
  });

  const revision = revisarSanitizacionSnapshot(snapshot);
  if (!revision.ok) {
    for (const hallazgo of revision.hallazgos) {
      blockingReasons.push(`snapshot_no_sanitizado:${entrada.period}:${hallazgo}`);
    }
  }

  return {
    companyAlias: entrada.companyAlias,
    period: entrada.period,
    calculationInputHash: hash,
    rows,
    snapshot,
    exact: compatibilityDifferences === 0,
    blockingReasons,
    compatibilityDifferences,
    officialDifferences,
    compatibilityFallbacks: entrada.resultado.legacyFallbackCount,
    runReused: entrada.resultado.runStatus === "reused",
  };
}

export interface InformeValidacionPiloto {
  companyAlias: AliasPiloto;
  periodFrom: string | null;
  periodTo: string | null;
  periodsFound: number;
  periodsValidated: number;
  periodsExact: number;
  compatibilityDifferences: number;
  officialDifferences: number;
  compatibilityFallbacks: number;
  unknownComponents: number;
  unsupportedComponents: number;
  runsReused: number;
  calculationMs: number;
  providerCalls: 0;
  creditsUsed: 0;
  blockingReasons: string[];
  promotionReady: boolean;
  engineVersion: string;
  projectionVersion: string;
  blockedCode: typeof PILOT_PROMOTION_BLOCKED | null;
}

export function construirInformeValidacionPiloto(entrada: {
  companyAlias: AliasPiloto;
  expectedPeriods?: string[];
  resultados: ResultadoValidacionPiloto[];
  unknownComponents?: number;
  unsupportedComponents?: number;
  calculationMs?: number;
}): InformeValidacionPiloto {
  const periodos = entrada.resultados.map((r) => r.period).sort();
  const procesados = new Set(periodos);
  const faltantes = (entrada.expectedPeriods ?? []).filter((p) => !procesados.has(p));

  const blockingReasons = entrada.resultados.flatMap((r) => r.blockingReasons);
  for (const p of faltantes) blockingReasons.push(`periodo_sin_procesar:${p}`);

  const compatibilityDifferences = entrada.resultados.reduce(
    (acc, r) => acc + r.compatibilityDifferences,
    0,
  );
  const officialDifferences = entrada.resultados.reduce(
    (acc, r) => acc + r.officialDifferences,
    0,
  );
  const promotionReady = blockingReasons.length === 0 && periodos.length > 0;

  return {
    companyAlias: entrada.companyAlias,
    periodFrom: periodos[0] ?? null,
    periodTo: periodos[periodos.length - 1] ?? null,
    periodsFound: periodos.length + faltantes.length,
    periodsValidated: periodos.length,
    periodsExact: entrada.resultados.filter((r) => r.exact).length,
    compatibilityDifferences,
    officialDifferences,
    compatibilityFallbacks: entrada.resultados.reduce(
      (acc, r) => acc + r.compatibilityFallbacks,
      0,
    ),
    // TAX_ZERO_JUSTIFIED: conteos de auditoría, no son montos tributarios.
    unknownComponents: entrada.unknownComponents ?? 0,
    unsupportedComponents: entrada.unsupportedComponents ?? 0,
    runsReused: entrada.resultados.filter((r) => r.runReused).length,
    // TAX_ZERO_JUSTIFIED: milisegundos de cálculo, no es un monto tributario.
    calculationMs: entrada.calculationMs ?? 0,

    providerCalls: 0,
    creditsUsed: 0,
    blockingReasons,
    promotionReady,
    engineVersion: UNIFIED_ENGINE_VERSION,
    projectionVersion: COMPATIBILITY_PROJECTION_VERSION,
    blockedCode: promotionReady ? null : PILOT_PROMOTION_BLOCKED,
  };
}
