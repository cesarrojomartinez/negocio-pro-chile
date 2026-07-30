import type { DocumentoTributario } from "./tax";

/** Origen del remanente de IVA arrastrado desde el periodo anterior. */
export type CarryforwardSource = "f29" | "previous_period" | "mock" | "unknown";
/** Origen de la tasa de PPM utilizada. */
export type PpmSource = "configured" | "previous_f29" | "mock" | "unknown";
/** Origen de las retenciones estimadas. */
export type WithholdingsSource =
  | "f29_history"
  | "documents"
  | "configured"
  | "mock"
  | "unknown";

export type ConfidenceLevel = "high" | "medium" | "low" | "unknown";

/** Estado del semáforo de reserva. */
export type ReserveStatus = "verde" | "ambar" | "rojo" | "neutral";

/** Estado del periodo respecto de la fecha actual. */
export type PeriodState = "open" | "closed" | "future";

export interface VatDebitResult {
  vatDebit: number;
  /** Verdadero cuando algún documento no traía IVA y hubo que inferirlo desde el neto. */
  inferred: boolean;
  inferredDocuments: number;
  exemptSales: number;
}

export interface VatCreditResult {
  vatCreditUsable: number;
  vatCreditPotential: number;
  usableDocuments: number;
  pendingDocuments: number;
  claimedDocuments: number;
  excludedDocuments: number;
}

export interface VatPositionInput {
  vatDebit: number;
  vatCreditUsable: number;
  previousCarryforward: number;
}

export interface VatPositionResult {
  vatPosition: number;
  estimatedVatPayable: number;
  estimatedNewCarryforward: number;
}

export interface TaxEstimateInput {
  estimatedVatPayable: number;
  estimatedPpm: number;
  estimatedWithholdings: number;
}

export interface PpmInput {
  ppmTaxBase: number;
  ppmRate: number | null;
  ppmSource: PpmSource;
}

export interface PpmResult {
  ppmTaxBase: number;
  ppmRate: number | null;
  ppmSource: PpmSource;
  estimatedPpm: number;
  /** Verdadero cuando no hay tasa confirmada y el PPM queda pendiente. */
  pending: boolean;
}

export interface PreventiveReserveInput {
  estimatedTaxTotal: number;
  preventiveMarginPercent: number;
}

export interface PreventiveReserveResult {
  preventiveMarginPercent: number;
  preventiveMarginAmount: number;
  recommendedReserve: number;
}

export interface ReserveCoverageInput {
  recommendedReserve: number;
  reservedAmount: number;
}

export interface ReserveCoverageResult {
  coveragePercent: number;
  reserveGap: number;
  reserveSurplus: number;
  status: ReserveStatus;
  message: string;
}

export interface SalesGoalInput {
  salesTotal: number;
  monthlySalesGoal: number;
  elapsedDays: number;
  totalDays: number;
  periodState: PeriodState;
}

export interface SalesGoalResult {
  monthlySalesGoal: number;
  salesTotal: number;
  goalProgressPercent: number;
  goalRemaining: number;
  goalExceededAmount: number;
  goalExceeded: boolean;
  averageDailySales: number;
  requiredDailySales: number;
  elapsedDays: number;
  remainingDays: number;
  totalDays: number;
}

export interface ClosingProjectionInput {
  salesTotal: number;
  elapsedDays: number;
  totalDays: number;
  periodState: PeriodState;
}

export interface ClosingProjectionResult {
  available: boolean;
  averageDailySales: number;
  conservativeProjection: number;
  probableProjection: number;
  highProjection: number;
}

export interface TaxProjectionInput {
  vatDebit: number;
  vatCreditUsable: number;
  previousCarryforward: number;
  netSales: number;
  ppmRate: number | null;
  estimatedWithholdings: number;
  preventiveMarginPercent: number;
  projection: ClosingProjectionResult;
  salesTotal: number;
}

export interface TaxProjectionResult {
  available: boolean;
  projectedVatDebit: number;
  projectedNetSales: number;
  projectedPpm: number;
  knownVatCredit: number;
  knownWithholdings: number;
  projectedTaxMin: number;
  projectedTaxMax: number;
}

export interface AdditionalSaleInput {
  grossSaleAmount: number;
  vatRate: number;
  ppmRate: number | null;
  estimatedCostRate?: number | null;
}

export interface AdditionalSaleResult {
  grossSaleAmount: number;
  netAmount: number;
  vatAmount: number;
  additionalPpm: number;
  additionalTaxReserve: number;
  amountBeforeCosts: number;
  estimatedCost: number | null;
  estimatedResultBeforeFixedExpenses: number | null;
}

export interface ComparisonMetric {
  key: string;
  label: string;
  current: number;
  previous: number;
  variationPercent: number | null;
  /** Verdadero cuando no hay base comparable (sin periodo anterior o base cero). */
  noBaseline: boolean;
}

export interface ConfidenceInput {
  hasSales: boolean;
  hasPurchases: boolean;
  syncError: boolean;
  carryforwardSource: CarryforwardSource;
  ppmSource: PpmSource;
  withholdingsSource: WithholdingsSource;
  pendingPurchaseDocuments: number;
  daysSinceLastSync: number | null;
  hasPreviousPeriod: boolean;
  manuallyConfigured: boolean;
}

export interface ConfidenceResult {
  level: ConfidenceLevel;
  reasons: string[];
}

export type EngineDocument = DocumentoTributario;
