/**
 * Proyección de compatibilidad (Etapa 6.8).
 *
 * Traduce el resultado del núcleo unificado al contrato productivo antiguo
 * (`ResumenMensual`, `tax_monthly_summaries`, tarjetas del dashboard) sin
 * cambiar ninguna cifra visible.
 *
 * Único lugar donde un `null` del núcleo puede convertirse en el número que
 * la interfaz antigua exige. Cada conversión queda registrada como
 * `legacyFallbackApplied`; el resultado del núcleo nunca se altera.
 *
 * Módulo puro: sin red, sin reloj, sin base de datos.
 */
import type { PeriodCalculationResult } from "./unifiedTaxEngine";
import { montoUnificado } from "./unifiedTaxEngine";
import type { MirrorConcept } from "./types";

export const COMPATIBILITY_PROJECTION_VERSION = "compat-projection-1.0.0";

export interface LegacyFallback {
  concept: MirrorConcept;
  /** Valor entregado a la interfaz antigua. */
  legacyValue: number;
  /** Conducta histórica aplicada. */
  behavior: "unknown_as_zero" | "floor_at_zero" | "rate_as_null";
  reason: string;
}

export interface LegacyCompatibilityProjection {
  period: string;
  projectionVersion: string;
  engineVersion: string;
  /** Campos monetarios NOT NULL esperados por el contrato antiguo. */
  values: {
    ivaDebito: number;
    ivaCredito: number;
    remanenteAnterior: number;
    ivaEstimado: number;
    nuevoRemanente: number;
    basePpm: number;
    tasaPpm: number | null;
    ppmEstimado: number;
    retencionesEstimadas: number;
    anticipoIvaAplicado: number;
    totalTributarioEstimado: number;
  };
  /** Total oficial del F29 cuando existe; separado de la estimación. */
  officialDeclaredTotal: number | null;
  legacyFallbackApplied: boolean;
  legacyFallbacks: LegacyFallback[];
}

interface Acumulador {
  fallbacks: LegacyFallback[];
}

/** Conducta histórica: un desconocido se mostraba como cero. */
function numeroLegado(
  acc: Acumulador,
  concept: MirrorConcept,
  valor: number | null,
  reason: string,
): number {
  if (valor != null) return valor;
  acc.fallbacks.push({
    concept,
    legacyValue: 0,
    behavior: "unknown_as_zero",
    reason,
  });
  return 0;
}

/** Conducta histórica: los montos tributarios mostrados nunca eran negativos. */
function pisoCeroLegado(
  acc: Acumulador,
  concept: MirrorConcept,
  valor: number | null,
  reason: string,
): number {
  const base = numeroLegado(acc, concept, valor, reason);
  if (base >= 0) return base;
  acc.fallbacks.push({
    concept,
    legacyValue: 0,
    behavior: "floor_at_zero",
    reason: "El contrato antiguo nunca mostró montos tributarios negativos.",
  });
  return 0;
}

export function proyectarCompatibilidad(
  resultado: PeriodCalculationResult,
): LegacyCompatibilityProjection {
  const acc: Acumulador = { fallbacks: [] };
  const m = (c: MirrorConcept) => montoUnificado(resultado, c);

  const ivaDebito = pisoCeroLegado(
    acc,
    "vat_debit",
    m("vat_debit"),
    "Sin ventas informadas el contrato antiguo mostraba cero.",
  );
  const ivaCredito = pisoCeroLegado(
    acc,
    "recoverable_vat_credit",
    m("recoverable_vat_credit"),
    "Sin compras informadas el contrato antiguo mostraba cero.",
  );
  const remanenteAnterior = pisoCeroLegado(
    acc,
    "previous_nominal_carryforward",
    m("previous_nominal_carryforward"),
    "El remanente desconocido se mostraba como cero.",
  );
  const ivaEstimado = pisoCeroLegado(
    acc,
    "vat_determined",
    m("vat_determined"),
    "El IVA determinado sin antecedentes se mostraba como cero.",
  );
  const nuevoRemanente = pisoCeroLegado(
    acc,
    "next_carryforward",
    m("next_carryforward"),
    "El remanente siguiente sin antecedentes se mostraba como cero.",
  );
  const basePpm = pisoCeroLegado(
    acc,
    "ppm_base",
    m("ppm_base"),
    "La base del PPM sin ventas se mostraba como cero.",
  );

  const tasa = m("ppm_rate");
  if (tasa == null) {
    acc.fallbacks.push({
      concept: "ppm_rate",
      legacyValue: 0,
      behavior: "rate_as_null",
      reason: "Sin tasa confirmada el contrato antiguo mostraba la tasa vacía.",
    });
  }

  const ppmEstimado = pisoCeroLegado(
    acc,
    "ppm_amount",
    m("ppm_amount"),
    "Sin tasa confirmada el PPM no se sumaba al total.",
  );
  const retenciones = pisoCeroLegado(
    acc,
    "withholdings",
    m("withholdings"),
    "Sin retenciones confirmadas el contrato antiguo mostraba cero.",
  );
  const anticipoAplicado = pisoCeroLegado(
    acc,
    "vat_advance_change_of_subject",
    m("vat_advance_change_of_subject"),
    "Sin anticipo informado el contrato antiguo mostraba cero.",
  );

  const total = pisoCeroLegado(
    acc,
    "tax_total_before_surcharges",
    m("tax_total_before_surcharges"),
    "El total antiguo era la suma de los componentes disponibles.",
  );

  return {
    period: resultado.period,
    projectionVersion: COMPATIBILITY_PROJECTION_VERSION,
    engineVersion: resultado.engineVersion,
    values: {
      ivaDebito,
      ivaCredito,
      remanenteAnterior,
      ivaEstimado,
      nuevoRemanente,
      basePpm,
      tasaPpm: tasa,
      ppmEstimado,
      retencionesEstimadas: retenciones,
      anticipoIvaAplicado: anticipoAplicado,
      totalTributarioEstimado: total,
    },
    officialDeclaredTotal: m("official_declared_total"),
    legacyFallbackApplied: acc.fallbacks.length > 0,
    legacyFallbacks: acc.fallbacks,
  };
}

/* ─────────────── Clasificación de divergencias entre motores ────────────── */

export type DivergenceKind =
  | "expected_legacy_compatibility"
  | "rounding_difference"
  | "source_difference"
  | "missing_input_handling"
  | "known_legacy_bug"
  | "intentional_rule_improvement"
  | "unsupported_case"
  | "unexplained_difference";

export interface DivergenciaClasificada {
  concept: MirrorConcept;
  legacyValue: number | null;
  unifiedValue: number | null;
  difference: number | null;
  kind: DivergenceKind;
  explanation: string;
}

/** Mejoras deliberadas que no deben reproducirse para "cuadrar". */
const MEJORAS_DELIBERADAS: Partial<Record<MirrorConcept, string>> = {
  recoverable_vat_credit:
    "El núcleo descuenta el IVA no recuperable y el uso común; el motor antiguo no lo hacía.",
  vat_advance_change_of_subject:
    "El anticipo por cambio de sujeto se calcula como componente propio.",
  ppm_rate: "Una tasa incoherente del F29 anterior ya no se arrastra.",
  confirmed_paid_total: "Declarado y pagado dejan de confundirse.",
};

export function clasificarDivergencia(entrada: {
  concept: MirrorConcept;
  legacyValue: number | null;
  unifiedValue: number | null;
  legacyFallbackApplied?: boolean;
  unsupported?: boolean;
}): DivergenciaClasificada {
  const { concept, legacyValue, unifiedValue } = entrada;
  const difference =
    legacyValue == null || unifiedValue == null ? null : legacyValue - unifiedValue;

  let kind: DivergenceKind;
  let explanation: string;

  if (entrada.unsupported) {
    kind = "unsupported_case";
    explanation = "El núcleo declara el caso como no soportado en vez de inventar cifra.";
  } else if (difference === 0) {
    kind = "expected_legacy_compatibility";
    explanation = "Sin diferencia: la proyección conserva la cifra visible.";
  } else if (unifiedValue == null && legacyValue != null) {
    kind = entrada.legacyFallbackApplied ? "missing_input_handling" : "known_legacy_bug";
    explanation =
      "El motor antiguo mostró una cifra donde el núcleo declara antecedente faltante.";
  } else if (difference != null && Math.abs(difference) <= 1) {
    kind = "rounding_difference";
    explanation = "Diferencia de redondeo de hasta un peso.";
  } else if (MEJORAS_DELIBERADAS[concept]) {
    kind = "intentional_rule_improvement";
    explanation = MEJORAS_DELIBERADAS[concept]!;
  } else if (difference == null) {
    kind = "source_difference";
    explanation = "Uno de los motores no dispone del antecedente.";
  } else {
    kind = "unexplained_difference";
    explanation = "Diferencia sin causa declarada: requiere revisión.";
  }

  return { concept, legacyValue, unifiedValue, difference, kind, explanation };
}
