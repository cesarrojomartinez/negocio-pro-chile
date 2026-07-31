/**
 * Motor Espejo SII — modelo de datos.
 *
 * Módulo puro: solo tipos y constantes. El Motor Espejo funciona en modo
 * sombra: normaliza, calcula, compara y registra. Nunca alimenta el
 * dashboard ni sobrescribe `tax_monthly_summaries`.
 *
 * Regla central del modelo: un monto desconocido es `null`. El cero solo
 * existe cuando la fuente entrega expresamente cero o el resultado
 * matemático es realmente cero.
 */

/** Versión del normalizador. Cambiar cuando cambie la forma de los hechos. */
export const MIRROR_NORMALIZATION_VERSION = "mirror-norm-1.0.0";
/** Versión del motor espejo. Cambiar cuando cambie el resultado del cálculo. */
export const MIRROR_ENGINE_VERSION = "mirror-engine-1.0.0";

/* ─────────────────────────── Hechos normalizados ─────────────────────────── */

export type MirrorLedger =
  | "sales"
  | "purchases_registry"
  | "purchases_pending"
  | "purchases_claimed"
  | "purchases_excluded"
  | "f29"
  | "historical_context";

export type MirrorGranularity =
  | "monthly_summary"
  | "document_type_summary"
  | "document_detail"
  | "official_form"
  | "manually_confirmed";

export type MirrorSourceStatus =
  | "official"
  | "confirmed"
  | "estimated"
  | "inferred"
  | "partial"
  | "unknown"
  | "unsupported";

/**
 * Hecho tributario normalizado. Cada monto acepta `null`: ausente no es cero.
 */
export interface NormalizedTaxFact {
  companyId: string | null;
  accountId: string | null;
  period: string;
  ledger: MirrorLedger;
  /** Código del DTE cuando aplica (33, 39, 46, 61…). `null` en agregados. */
  documentType: number | null;
  documentNature: DteNature | null;
  documentCount: number | null;
  /** +1 suma al ledger, −1 lo rebaja (notas de crédito). */
  taxEffect: 1 | -1 | null;
  taxableNet: number | null;
  exemptAmount: number | null;
  nonTaxableAmount: number | null;
  vatAmount: number | null;
  vatCommonUse: number | null;
  vatNonRecoverable: number | null;
  otherTaxes: number | null;
  totalAmount: number | null;
  unclassifiedAmount: number | null;
  granularity: MirrorGranularity;
  source: string;
  sourceStatus: MirrorSourceStatus;
  snapshotId: string | null;
  adapterVersion: string | null;
  normalizationVersion: string;
  rawHash: string;
}

/* ──────────────────────── Cálculos por componente ───────────────────────── */

export type ComponentStatus =
  | "official"
  | "confirmed"
  | "estimated"
  | "requires_confirmation"
  | "unsupported"
  | "unavailable"
  | "not_applicable";

export type MirrorConcept =
  | "sales_taxable"
  | "sales_exempt"
  | "sales_non_taxable"
  | "sales_total"
  | "purchases_taxable"
  | "purchases_exempt"
  | "purchases_total"
  | "vat_debit"
  | "vat_total_purchases"
  | "vat_common_use"
  | "vat_non_recoverable"
  | "recoverable_vat_credit"
  | "previous_nominal_carryforward"
  | "adjustment_factor"
  | "adjusted_previous_carryforward"
  | "next_carryforward"
  | "vat_determined"
  | "ppm_base"
  | "ppm_rate"
  | "ppm_amount"
  | "withholdings"
  | "vat_advance_change_of_subject"
  | "surcharges"
  | "tax_total_before_surcharges"
  | "official_declared_total"
  | "confirmed_paid_total";

export type MirrorConfidence = "high" | "medium" | "low" | "unknown";

export interface ComponentCalculation {
  concept: MirrorConcept;
  /** `null` cuando falta información. Nunca se rellena con cero. */
  amount: number | null;
  status: ComponentStatus;
  ruleId: string;
  ruleVersion: string;
  /** Origen de cada dato usado, por ejemplo `f29:538` o `rcv:sales_summary`. */
  sources: string[];
  calculationDescription: string;
  inputValues: Record<string, number | string | null>;
  missingInputs: string[];
  warnings: string[];
  confidence: MirrorConfidence;
  calculatedAt: string;
}

export interface MirrorEngineResult {
  companyId: string | null;
  period: string;
  engineVersion: string;
  normalizationVersion: string;
  components: ComponentCalculation[];
  componentCount: number;
  missingComponentCount: number;
  unsupportedComponentCount: number;
}

/* ───────────────────────── Clasificación de DTE ─────────────────────────── */

export type DteNature =
  | "taxable_invoice"
  | "exempt_invoice"
  | "purchase_invoice_withheld"
  | "receipt"
  | "exempt_receipt"
  | "electronic_payment_voucher"
  | "credit_note"
  | "debit_note"
  | "dispatch_guide"
  | "export"
  | "settlement"
  | "unknown";

/* ─────────────────────────── Contexto oficial ───────────────────────────── */

export type DeclarationStatus = "filed" | "pending" | "rectified" | "unknown";
export type PaymentStatus = "paid" | "unknown";
export type ExtractionStatus = "valid" | "partial" | "needs_review" | "unknown";

/**
 * Contexto oficial de un periodo. Cada campo distingue explícitamente entre
 * "el código no venía" (`null`) y "el código venía en cero" (`0`).
 */
export interface HistoricalOfficialContext {
  period: string;
  folio: string | null;
  codes: Record<string, number>;
  declarationStatus: DeclarationStatus;
  extractionStatus: ExtractionStatus;
  confidence: MirrorConfidence;
  filedAt: string | null;
  /** Nunca se infiere desde el código 91. */
  paymentStatus: PaymentStatus;
  source: string;
}

/* ──────────────────────────── Casos dorados ─────────────────────────────── */

export interface GoldenExpectedComponents {
  salesTaxable?: number | null;
  salesExempt?: number | null;
  salesNonTaxable?: number | null;
  salesTotal?: number | null;
  purchasesTaxable?: number | null;
  purchasesExempt?: number | null;
  purchasesTotal?: number | null;
  vatDebit?: number | null;
  vatCredit?: number | null;
  vatCommonUse?: number | null;
  vatNonRecoverable?: number | null;
  recoverableVatCredit?: number | null;
  previousCarryforward?: number | null;
  nextCarryforward?: number | null;
  vatDetermined?: number | null;
  ppmBase?: number | null;
  ppmRate?: number | null;
  ppm?: number | null;
  withholdings?: number | null;
  vatAdvance?: number | null;
  surcharges?: number | null;
  officialSubtotal?: number | null;
  officialTotalDetermined?: number | null;
  code91?: number | null;
  declarationStatus?: DeclarationStatus;
  paymentStatus?: PaymentStatus;
}

export interface GoldenTaxCase {
  caseId: string;
  /** Alias anónimo. Nunca un identificador productivo. */
  companyAlias: string;
  period: string;
  rawSnapshotReference: string | null;
  rcvSummaryReference: string | null;
  f29ExtractionReference: string | null;
  f29Folio: string | null;
  extractionStatus: ExtractionStatus;
  /** Códigos del F29 tal como fueron extraídos. Ausente ≠ cero. */
  codes: Record<string, number>;
  declarationStatus: DeclarationStatus;
  source: string;
  expectedComponents: GoldenExpectedComponents;
  toleranceByComponent: Partial<Record<keyof GoldenExpectedComponents, number>>;
  notes: string;
}
