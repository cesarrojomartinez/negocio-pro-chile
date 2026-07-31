/**
 * Orquestador único de cálculo tributario (Etapa 6.8.1).
 *
 * `calculateTaxPeriod` es el único punto de entrada al cálculo de un periodo.
 * Ningún módulo decide por su cuenta qué motor usar: sincronización, recálculo
 * manual, backfill, confirmación de antecedentes, rectificatorias,
 * reconstrucción histórica, dashboardBuilder y cierre mensual pasan por aquí.
 *
 * Módulo puro salvo por la marca de tiempo, que puede inyectarse.
 */
import { hashOrigen } from "./normalize";
import {
  proyectarCompatibilidad,
  COMPATIBILITY_PROJECTION_VERSION,
  type LegacyCompatibilityProjection,
} from "./legacyProjection";
import {
  construirResumenProductivo,
  type ContextoProductivoNoTributario,
  type ProductiveTaxSummary,
} from "./productiveSummary";
import { compararParidadProductiva, type ReporteParidad } from "./parity";
import { construirComparacionTriple, type ComparacionTriple } from "./tripleComparison";
import { registrarInvocacionLegada } from "./legacyGuard";
import {
  resolverModoUnificadoDetallado,
  type UnifiedEngineMode,
} from "./unifiedEngineMode";
import {
  ejecutarMotorUnificado,
  UNIFIED_ENGINE_VERSION,
  type PeriodCalculationResult,
  type UnifiedTaxEngineInput,
} from "./unifiedTaxEngine";
import type { MirrorConcept } from "./types";

export const COMPATIBILITY_RUN_FAILED = "COMPATIBILITY_RUN_FAILED" as const;

export type CalculationEngine = "legacy" | "unified";
export type RunStatus = "completed" | "failed" | "reused";

export interface RunReutilizable {
  calculationInputHash: string;
  calculationRunId: string;
  productive: ProductiveTaxSummary;
  status: "completed";
}

export interface EntradaCalculoPeriodo {
  companyId?: string | null;
  period: string;
  /** Valor configurado del flag por empresa. */
  configuredMode?: string | null;
  /** Entrada normalizada del núcleo. */
  unifiedInput: UnifiedTaxEngineInput;
  /** Datos comerciales y estados que el núcleo no produce. */
  productiveContext: ContextoProductivoNoTributario;
  /** Resultado del motor antiguo. Obligatorio fuera de `compatibility`. */
  legacyProductive?: ProductiveTaxSummary | null;
  /** Última cifra productiva válida, para no mostrar nada nuevo ante error. */
  previousProductive?: ProductiveTaxSummary | null;
  official?: Partial<Record<MirrorConcept, number | null>>;
  officialTotal?: number | null;
  /** Run previo con el mismo hash, para idempotencia. */
  existingRun?: RunReutilizable | null;
  /** Versiones y configuraciones que participan del hash. */
  configFingerprint?: unknown;
  calculationRunId?: string;
  calculatedAt?: string;
}

export interface ResultadoCalculoPeriodo {
  companyId: string | null;
  period: string;
  requestedMode: string | null;
  mode: UnifiedEngineMode;
  modeError: string | null;
  calculationEngine: CalculationEngine;
  engineVersion: string;
  compatibilityProjectionVersion: string;
  calculationInputHash: string;
  calculationRunId: string | null;
  runStatus: RunStatus;
  /** Contrato entregado a la interfaz y la persistencia antigua. */
  productive: ProductiveTaxSummary;
  /** Cifra que produce el núcleo unificado, exista o no promoción. */
  compatibility: ProductiveTaxSummary | null;

  unified: PeriodCalculationResult | null;
  projection: LegacyCompatibilityProjection | null;
  parity: ReporteParidad | null;
  tripleComparison: ComparacionTriple | null;
  legacyFallbackCount: number;
  errors: string[];
  /** Falso cuando la persistencia productiva debe abortarse. */
  persistable: boolean;
  calculatedAt: string;
}

/** Hash determinístico de todo lo que influye en el resultado. */
export function calcularInputHash(entrada: {
  period: string;
  unifiedInput: UnifiedTaxEngineInput;
  configFingerprint?: unknown;
}): string {
  const { facts, official, previousOfficial, vatAdvanceHistory, commonUseRecoveryRatio, utmAdjustmentFactor } =
    entrada.unifiedInput;
  return hashOrigen({
    period: entrada.period,
    facts,
    official,
    previousOfficial,
    vatAdvanceHistory: vatAdvanceHistory ?? null,
    commonUseRecoveryRatio: commonUseRecoveryRatio ?? null,
    utmAdjustmentFactor: utmAdjustmentFactor ?? null,
    config: entrada.configFingerprint ?? null,
    engineVersion: UNIFIED_ENGINE_VERSION,
    projectionVersion: COMPATIBILITY_PROJECTION_VERSION,
  });
}

export function calculateTaxPeriod(
  entrada: EntradaCalculoPeriodo,
): ResultadoCalculoPeriodo {
  const calculatedAt = entrada.calculatedAt ?? new Date().toISOString();
  const resolucion = resolverModoUnificadoDetallado(entrada.configuredMode);
  const modo = resolucion.modo;
  const errors: string[] = [];
  if (resolucion.error) errors.push(resolucion.error);

  const calculationInputHash = calcularInputHash({
    period: entrada.period,
    unifiedInput: entrada.unifiedInput,
    configFingerprint: entrada.configFingerprint,
  });

  const base = {
    companyId: entrada.companyId ?? null,
    period: entrada.period,
    requestedMode: resolucion.configurado,
    mode: modo,
    modeError: resolucion.error,
    engineVersion: UNIFIED_ENGINE_VERSION,
    compatibilityProjectionVersion: COMPATIBILITY_PROJECTION_VERSION,
    calculationInputHash,
    calculatedAt,
  };

  // Idempotencia: un run completado con el mismo hash se reutiliza tal cual.
  if (
    entrada.existingRun &&
    entrada.existingRun.calculationInputHash === calculationInputHash
  ) {
    return {
      ...base,
      calculationEngine: modo === "compatibility" ? "unified" : "legacy",
      calculationRunId: entrada.existingRun.calculationRunId,
      runStatus: "reused",
      productive: entrada.existingRun.productive,
      compatibility: null,
      unified: null,
      projection: null,
      parity: null,
      tripleComparison: null,
      legacyFallbackCount: 0,
      errors,
      persistable: false,
    };
  }

  // El motor antiguo solo puede calcular fuera de `compatibility`.
  if (entrada.legacyProductive && modo !== "compatibility") {
    registrarInvocacionLegada({
      origin: "calculateTaxPeriod",
      mode: modo,
      period: entrada.period,
      companyId: entrada.companyId ?? null,
    });
  }

  let unified: PeriodCalculationResult | null = null;
  try {
    unified = ejecutarMotorUnificado({ ...entrada.unifiedInput, calculatedAt });
  } catch (error) {
    errors.push(
      `${COMPATIBILITY_RUN_FAILED}: ${error instanceof Error ? error.message : "error"}`,
    );
  }

  if (!unified) {
    // Sin fallback silencioso: se conserva la última cifra válida.
    const conservada = entrada.previousProductive ?? entrada.legacyProductive ?? null;
    if (!conservada) {
      throw new Error(
        `${COMPATIBILITY_RUN_FAILED}: sin cifra productiva previa para ${entrada.period}`,
      );
    }
    return {
      ...base,
      calculationEngine: "legacy",
      calculationRunId: null,
      runStatus: "failed",
      productive: conservada,
      compatibility: null,
      unified: null,
      projection: null,
      parity: null,
      tripleComparison: null,
      legacyFallbackCount: 0,
      errors,
      persistable: false,
    };
  }

  const projection = proyectarCompatibilidad(unified);
  const compatibility = construirResumenProductivo(projection, entrada.productiveContext);

  const parity =
    entrada.legacyProductive && modo !== "compatibility"
      ? compararParidadProductiva({
          companyId: entrada.companyId ?? null,
          period: entrada.period,
          legacy: entrada.legacyProductive,
          compatibility,
          legacyFallbackApplied: projection.legacyFallbackApplied,
        })
      : null;

  const tripleComparison = construirComparacionTriple({
    companyId: entrada.companyId ?? null,
    period: entrada.period,
    legacy: entrada.legacyProductive ?? null,
    unified,
    compatibility,
    official: entrada.official,
    officialTotal: entrada.officialTotal ?? null,
  });

  const productive =
    modo === "compatibility" ? compatibility : (entrada.legacyProductive ?? compatibility);

  return {
    ...base,
    calculationEngine: modo === "compatibility" ? "unified" : "legacy",
    calculationRunId: entrada.calculationRunId ?? null,
    runStatus: "completed",
    productive,
    compatibility,
    unified,
    projection,
    parity,
    tripleComparison,
    legacyFallbackCount: projection.legacyFallbacks.length,
    errors,
    persistable: true,
  };
}
