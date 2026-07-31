/**
 * Etapa 6.7 — Modelo de certeza tributaria del Motor Espejo.
 *
 * Este módulo elimina toda confusión entre cero real, dato ausente, valor
 * desconocido, valor no aplicable, valor no soportado, estimación, cifra
 * confirmada y cifra oficial.
 *
 * Regla dura: un monto solo existe cuando una fuente lo entrega o cuando una
 * regla completa lo calcula. Un cero solo es cero cuando alguien lo declaró
 * expresamente o cuando la aritmética completa dio cero.
 *
 * Módulo puro: sin red, sin reloj, sin base de datos. No altera el motor
 * productivo ni las cifras visibles.
 */
import type {
  ComponentCalculation,
  ComponentStatus,
  MirrorConcept,
  MirrorConfidence,
  MirrorEngineResult,
} from "./types";

/* ─────────────────────────── Contrato del valor ─────────────────────────── */

/** Estado del valor. Extiende el estado del motor con casos de conflicto. */
export type TaxValueStatus = ComponentStatus | "conflicting" | "invalid";

/** De dónde viene realmente el dato. Nunca se mezcla oficial con estimado. */
export type TaxSourceStatus =
  | "official_form"
  | "official_rcv"
  | "inherited_official"
  | "confirmed_by_person"
  | "configured"
  | "deterministic_calculation"
  | "statistical_estimate"
  | "missing"
  | "unsupported";

/** Grado de completitud del componente. */
export type TaxCompleteness =
  | "complete"
  | "complete_with_estimates"
  | "incomplete"
  | "blocked"
  | "not_applicable";

/** Clasificación de la ausencia. Nunca se resume todo como "sin datos". */
export type TaxAbsenceReason =
  | "MISSING_INPUT"
  | "UNSUPPORTED_INPUT"
  | "NOT_APPLICABLE"
  | "INVALID_INPUT"
  | "CONFLICTING_INPUT";

/** Origen del cero cuando el monto es cero. */
export type TaxZeroKind = "explicit_source_zero" | "calculated_zero" | null;

export interface TaxComponentValue {
  concept: MirrorConcept;
  /** `null` significa desconocido. Jamás se sustituye por cero. */
  amount: number | null;
  status: TaxValueStatus;
  sourceStatus: TaxSourceStatus;
  completeness: TaxCompleteness;
  /** Verdadero solo cuando el cero está respaldado. */
  explicitlyReportedZero: boolean;
  zeroKind: TaxZeroKind;
  absenceReason: TaxAbsenceReason | null;
  absenceDetail: string | null;
  isEstimate: boolean;
  requiresConfirmation: boolean;
  /** La interfaz solo puede mostrar un monto cuando esto es verdadero. */
  canBeShownAsAmount: boolean;
  missingInputs: string[];
  warnings: string[];
  sources: string[];
  confidence: MirrorConfidence;
  ruleId: string;
  ruleVersion: string;
  description: string;
}

/* ────────────────────── Clasificación de la ausencia ────────────────────── */

export interface EntradaClasificacionAusencia {
  amount: number | null;
  status: ComponentStatus | TaxValueStatus;
  missingInputs?: string[];
  warnings?: string[];
  sources?: string[];
}

export interface ClasificacionAusencia {
  absenceReason: TaxAbsenceReason | null;
  absenceDetail: string | null;
}

const DETALLE: Record<TaxAbsenceReason, string> = {
  MISSING_INPUT: "Falta un antecedente para calcular este componente.",
  UNSUPPORTED_INPUT: "El motor todavía no soporta el cálculo de este componente.",
  NOT_APPLICABLE: "El componente no aplica a este periodo.",
  INVALID_INPUT: "El antecedente disponible no es válido para el cálculo.",
  CONFLICTING_INPUT: "Hay antecedentes que se contradicen entre sí.",
};

/** Palabras clave que delatan un antecedente contradictorio. */
const AVISOS_CONFLICTO = ["incoherente", "conflicto", "contradice", "discrepancia"];
/** Palabras clave que delatan un antecedente inválido. */
const AVISOS_INVALIDOS = ["invalido", "inválido", "no_valido", "extraccion_invalida"];

function contiene(avisos: string[], claves: string[]): boolean {
  return avisos.some((a) => claves.some((c) => a.toLowerCase().includes(c)));
}

/**
 * Clasifica por qué un componente no tiene monto. Un componente con monto
 * puede igualmente venir marcado como conflictivo por sus avisos.
 */
export function clasificarAusenciaTributaria(
  entrada: EntradaClasificacionAusencia,
): ClasificacionAusencia {
  const avisos = entrada.warnings ?? [];
  const faltantes = entrada.missingInputs ?? [];

  if (contiene(avisos, AVISOS_CONFLICTO)) {
    return {
      absenceReason: "CONFLICTING_INPUT",
      absenceDetail: DETALLE.CONFLICTING_INPUT,
    };
  }
  if (contiene(avisos, AVISOS_INVALIDOS)) {
    return { absenceReason: "INVALID_INPUT", absenceDetail: DETALLE.INVALID_INPUT };
  }
  if (entrada.status === "not_applicable") {
    return { absenceReason: "NOT_APPLICABLE", absenceDetail: DETALLE.NOT_APPLICABLE };
  }
  if (entrada.status === "unsupported") {
    return { absenceReason: "UNSUPPORTED_INPUT", absenceDetail: DETALLE.UNSUPPORTED_INPUT };
  }
  if (entrada.amount == null) {
    const detalle =
      faltantes.length > 0
        ? `Faltan antecedentes: ${faltantes.join(", ")}.`
        : DETALLE.MISSING_INPUT;
    return { absenceReason: "MISSING_INPUT", absenceDetail: detalle };
  }
  return { absenceReason: null, absenceDetail: null };
}

/* ─────────────────────── Procedencia real del dato ──────────────────────── */

export function resolverProcedencia(
  componente: Pick<ComponentCalculation, "amount" | "status" | "sources" | "warnings">,
): TaxSourceStatus {
  const fuentes = componente.sources ?? [];
  const tiene = (p: string) => fuentes.some((f) => f.startsWith(p));

  if (componente.status === "unsupported") return "unsupported";
  if (componente.amount == null && fuentes.length === 0) return "missing";

  if (tiene("f29:")) return "official_form";
  if (tiene("previous_f29:")) return "inherited_official";
  if (tiene("f29_history")) return "statistical_estimate";
  if (tiene("payment_evidence")) return "confirmed_by_person";
  if (tiene("rcv:")) {
    return componente.status === "estimated" ? "deterministic_calculation" : "official_rcv";
  }
  if (tiene("utm")) return "configured";
  if (tiene("mirror:")) return "deterministic_calculation";
  if (componente.status === "confirmed") return "confirmed_by_person";
  return componente.amount == null ? "missing" : "deterministic_calculation";
}

/* ─────────────────────────── Cero explícito ─────────────────────────────── */

export interface EvaluacionCero {
  explicitlyReportedZero: boolean;
  zeroKind: TaxZeroKind;
}

/**
 * Un cero solo es explícito cuando la fuente lo declaró o cuando la regla
 * calculó cero con todos sus antecedentes presentes.
 */
export function evaluarCero(
  componente: Pick<ComponentCalculation, "amount" | "status" | "missingInputs">,
  procedencia: TaxSourceStatus,
): EvaluacionCero {
  if (componente.amount !== 0) return { explicitlyReportedZero: false, zeroKind: null };
  if ((componente.missingInputs ?? []).length > 0) {
    return { explicitlyReportedZero: false, zeroKind: null };
  }
  if (
    procedencia === "official_form" ||
    procedencia === "official_rcv" ||
    procedencia === "inherited_official" ||
    procedencia === "confirmed_by_person"
  ) {
    return { explicitlyReportedZero: true, zeroKind: "explicit_source_zero" };
  }
  if (procedencia === "deterministic_calculation" || procedencia === "configured") {
    return { explicitlyReportedZero: true, zeroKind: "calculated_zero" };
  }
  return { explicitlyReportedZero: false, zeroKind: null };
}

/* ───────────────────────────── Completitud ──────────────────────────────── */

export function resolverCompletitud(
  status: TaxValueStatus,
  amount: number | null,
  missingInputs: string[],
): TaxCompleteness {
  if (status === "not_applicable") return "not_applicable";
  if (status === "unsupported") return "blocked";
  if (amount == null) return missingInputs.length > 0 ? "blocked" : "incomplete";
  if (status === "official" || status === "confirmed") return "complete";
  if (status === "requires_confirmation" || status === "conflicting" || status === "invalid") {
    return "incomplete";
  }
  return "complete_with_estimates";
}

/* ───────────────────── Componente → valor con certeza ───────────────────── */

export function aValorTributario(componente: ComponentCalculation): TaxComponentValue {
  const warnings = componente.warnings ?? [];
  const missingInputs = componente.missingInputs ?? [];
  const clasificacion = clasificarAusenciaTributaria({
    amount: componente.amount,
    status: componente.status,
    missingInputs,
    warnings,
    sources: componente.sources,
  });
  const procedencia = resolverProcedencia(componente);
  const cero = evaluarCero(componente, procedencia);

  const status: TaxValueStatus =
    clasificacion.absenceReason === "CONFLICTING_INPUT"
      ? "conflicting"
      : clasificacion.absenceReason === "INVALID_INPUT"
        ? "invalid"
        : componente.status;

  const completeness = resolverCompletitud(status, componente.amount, missingInputs);

  return {
    concept: componente.concept,
    amount: componente.amount,
    status,
    sourceStatus: procedencia,
    completeness,
    explicitlyReportedZero: cero.explicitlyReportedZero,
    zeroKind: cero.zeroKind,
    absenceReason: clasificacion.absenceReason,
    absenceDetail: clasificacion.absenceDetail,
    isEstimate:
      procedencia === "statistical_estimate" ||
      componente.status === "estimated" ||
      completeness === "complete_with_estimates",
    requiresConfirmation:
      status === "requires_confirmation" || status === "conflicting" || status === "invalid",
    canBeShownAsAmount: componente.amount != null,
    missingInputs,
    warnings,
    sources: componente.sources ?? [],
    confidence: componente.confidence,
    ruleId: componente.ruleId,
    ruleVersion: componente.ruleVersion,
    description: componente.calculationDescription,
  };
}

export function valoresTributarios(
  resultado: MirrorEngineResult,
): Map<MirrorConcept, TaxComponentValue> {
  const mapa = new Map<MirrorConcept, TaxComponentValue>();
  for (const c of resultado.components) mapa.set(c.concept, aValorTributario(c));
  return mapa;
}

/* ─────────────────── Certeza del periodo completo ───────────────────────── */

/** Conceptos sin los cuales un total tributario no puede presentarse. */
export const CONCEPTOS_CRITICOS: MirrorConcept[] = [
  "vat_debit",
  "recoverable_vat_credit",
  "previous_nominal_carryforward",
  "vat_determined",
  "ppm_amount",
  "withholdings",
];

export interface PeriodCalculationCertainty {
  period: string;
  completeness: TaxCompleteness;
  confidence: MirrorConfidence;
  /** Conceptos críticos sin monto. */
  blockingConcepts: MirrorConcept[];
  estimatedConcepts: MirrorConcept[];
  conflictingConcepts: MirrorConcept[];
  notApplicableConcepts: MirrorConcept[];
  unsupportedConcepts: MirrorConcept[];
  missingInputs: string[];
  /** Falso cuando el total no puede presentarse como cifra. */
  canPresentTotal: boolean;
  reason: string;
}

export function evaluarCertezaPeriodo(
  period: string,
  valores: Map<MirrorConcept, TaxComponentValue> | TaxComponentValue[],
  conceptosCriticos: MirrorConcept[] = CONCEPTOS_CRITICOS,
): PeriodCalculationCertainty {
  const lista = Array.isArray(valores) ? valores : [...valores.values()];
  const porConcepto = new Map(lista.map((v) => [v.concept, v]));

  const blockingConcepts = conceptosCriticos.filter((c) => {
    const v = porConcepto.get(c);
    return !v || (v.amount == null && v.status !== "not_applicable");
  });
  const estimatedConcepts = lista.filter((v) => v.isEstimate).map((v) => v.concept);
  const conflictingConcepts = lista
    .filter((v) => v.status === "conflicting" || v.status === "invalid")
    .map((v) => v.concept);
  const notApplicableConcepts = lista
    .filter((v) => v.status === "not_applicable")
    .map((v) => v.concept);
  const unsupportedConcepts = lista
    .filter((v) => v.status === "unsupported")
    .map((v) => v.concept);
  const missingInputs = [...new Set(lista.flatMap((v) => v.missingInputs))].sort();

  const total = porConcepto.get("tax_total_before_surcharges");
  const canPresentTotal = blockingConcepts.length === 0 && total?.amount != null;

  const completeness: TaxCompleteness = !canPresentTotal
    ? blockingConcepts.length > 0
      ? "blocked"
      : "incomplete"
    : conflictingConcepts.length > 0
      ? "incomplete"
      : estimatedConcepts.length > 0
        ? "complete_with_estimates"
        : "complete";

  const confidence: MirrorConfidence =
    completeness === "complete"
      ? "high"
      : completeness === "complete_with_estimates"
        ? conflictingConcepts.length > 0
          ? "low"
          : "medium"
        : completeness === "incomplete"
          ? "low"
          : "unknown";

  const reason = !canPresentTotal
    ? blockingConcepts.length > 0
      ? `Faltan componentes esenciales: ${blockingConcepts.join(", ")}.`
      : "El total del periodo todavía no puede calcularse."
    : conflictingConcepts.length > 0
      ? `Hay antecedentes contradictorios en: ${conflictingConcepts.join(", ")}.`
      : estimatedConcepts.length > 0
        ? "El total incluye componentes estimados."
        : "Todos los componentes provienen de antecedentes confirmados.";

  return {
    period,
    completeness,
    confidence,
    blockingConcepts,
    estimatedConcepts,
    conflictingConcepts,
    notApplicableConcepts,
    unsupportedConcepts,
    missingInputs,
    canPresentTotal,
    reason,
  };
}
