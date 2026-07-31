/**
 * Núcleo único de cálculo tributario (Etapa 6.8).
 *
 * Este es el ÚNICO lugar donde se calculan IVA débito, IVA crédito, posición
 * de IVA, remanentes, PPM, retenciones, anticipos, recargos y total. El orden
 * de ejecución se deriva del grafo de dependencias, no de llamadas manuales
 * dispersas. Ningún otro módulo puede volver a calcular estos conceptos: los
 * bordes de compatibilidad solo proyectan el resultado.
 *
 * Módulo puro salvo por la marca de tiempo, que puede inyectarse.
 */
import {
  evaluarCertezaPeriodo,
  valoresTributarios,
  type PeriodCalculationCertainty,
  type TaxComponentValue,
} from "./certainty";
import {
  DEPENDENCY_GRAPH_VERSION,
  ordenTopologico,
  propagarEstado,
  TAX_DEPENDENCY_GRAPH,
  type TaxComponentDependencyGraph,
} from "./dependencyGraph";
import { esConceptoRegistrado, TAX_CONCEPT_REGISTRY_VERSION } from "./conceptRegistry";
import { aplicarRedondeo, ROUNDING_POLICY_VERSION } from "./rounding";
import { VERSIONED_TAX_RULES, type MirrorEngineInput, type RuleContext } from "./rules";
import { auditarCeros, type AuditoriaCeros } from "./zeroPolicy";
import {
  MIRROR_ENGINE_VERSION,
  MIRROR_NORMALIZATION_VERSION,
  type ComponentCalculation,
  type ComponentStatus,
  type MirrorConcept,
  type MirrorEngineResult,
} from "./types";

export const UNIFIED_ENGINE_VERSION = "unified-engine-1.0.0";

/* ──────────────────────────── Entrada y salida ──────────────────────────── */

export interface UnifiedTaxEngineInput extends MirrorEngineInput {
  /** Grafo alternativo, solo para pruebas. */
  dependencyGraph?: TaxComponentDependencyGraph;
}

export interface CalculationTraceEntry {
  concept: MirrorConcept;
  ruleId: string;
  ruleVersion: string;
  roundingRule: string;
  /** Fuentes sanitizadas: nunca payloads, claves ni encabezados. */
  sources: string[];
  missingInputs: string[];
  blockedBy: MirrorConcept[];
  degradedBy: MirrorConcept[];
  status: ComponentStatus;
}

export interface PeriodCalculationResult {
  companyId: string | null;
  period: string;
  engineVersion: string;
  normalizationVersion: string;
  conceptRegistryVersion: string;
  dependencyGraphVersion: string;
  roundingPolicyVersion: string;
  components: ComponentCalculation[];
  componentValues: TaxComponentValue[];
  dependencyOrder: MirrorConcept[];
  certainty: PeriodCalculationCertainty;
  zeroAudit: AuditoriaCeros;
  warnings: string[];
  unsupportedCases: MirrorConcept[];
  calculationTrace: CalculationTraceEntry[];
  calculatedAt: string;
}

/* ─────────────────────────────── Pipeline ───────────────────────────────── */

const SIN_MONTO: ReadonlySet<ComponentStatus> = new Set<ComponentStatus>([
  "requires_confirmation",
  "unavailable",
  "unsupported",
]);

function limpiarEntradas(
  valores: Record<string, number | string | null | undefined>,
): Record<string, number | string | null> {
  const salida: Record<string, number | string | null> = {};
  for (const [k, v] of Object.entries(valores)) salida[k] = v === undefined ? null : v;
  return salida;
}

/** Fuente sanitizada: se conserva el identificador, nunca el contenido. */
function sanitizarFuente(fuente: string): string {
  return fuente.replace(/\s+/g, " ").slice(0, 64);
}

/**
 * Ejecuta el pipeline único:
 * validar contexto → clasificar hechos → ventas → IVA débito → compras →
 * crédito recuperable → remanente → otros débitos y créditos → anticipo →
 * posición de IVA → remanente siguiente → base y tasa de PPM → PPM →
 * retenciones → recargos → total → total oficial → pago → certeza.
 *
 * El orden concreto proviene del grafo de dependencias.
 */
export function ejecutarMotorUnificado(
  entrada: UnifiedTaxEngineInput,
): PeriodCalculationResult {
  const calculatedAt = entrada.calculatedAt ?? new Date().toISOString();
  const grafo = entrada.dependencyGraph ?? TAX_DEPENDENCY_GRAPH;
  const orden = ordenTopologico(grafo);

  // 1. Validar contexto: los conceptos del grafo deben estar registrados.
  for (const concepto of orden) {
    if (!esConceptoRegistrado(concepto)) {
      throw new Error(`Concepto no registrado en el núcleo único: ${concepto}`);
    }
  }

  const reglasVigentes = VERSIONED_TAX_RULES.filter(
    (r) =>
      entrada.period >= r.validFrom && (!r.validTo || entrada.period <= r.validTo),
  );
  const reglasPorConcepto = new Map<MirrorConcept, typeof reglasVigentes>();
  for (const r of reglasVigentes) {
    const lista = reglasPorConcepto.get(r.concept) ?? [];
    lista.push(r);
    reglasPorConcepto.set(r.concept, lista);
  }
  for (const [concepto, lista] of reglasPorConcepto) {
    if (lista.length > 1) {
      throw new Error(
        `Dos reglas activas para ${concepto} en ${entrada.period}: ${lista
          .map((r) => r.ruleId)
          .join(", ")}`,
      );
    }
  }

  const resolved = new Map<MirrorConcept, ComponentCalculation>();
  const ctx: RuleContext = { ...entrada, resolved };
  const trace: CalculationTraceEntry[] = [];
  const warnings: string[] = [];

  for (const concepto of orden) {
    const regla = reglasPorConcepto.get(concepto)?.[0];
    if (!regla) continue;

    const propagacion = propagarEstado(
      concepto,
      {
        resueltos: new Map(
          [...resolved].map(([k, v]) => [k, { amount: v.amount, status: v.status }]),
        ),
      },
      grafo,
    );

    const salida = regla.calculate(ctx);
    // Redondeo único: la regla declara dónde ocurre; aquí no se repite.
    const redondeado = aplicarRedondeo(salida.amount, regla.roundingRule);

    const componente: ComponentCalculation = {
      concept: regla.concept,
      amount: redondeado.value,
      status: salida.status,
      ruleId: regla.ruleId,
      ruleVersion: regla.ruleVersion,
      sources: salida.sources.map(sanitizarFuente),
      calculationDescription: salida.calculationDescription,
      inputValues: limpiarEntradas(salida.inputValues),
      missingInputs: [
        ...new Set([...(salida.missingInputs ?? []), ...propagacion.bloqueadoPor]),
      ],
      warnings: salida.warnings ?? [],
      confidence: salida.confidence ?? "unknown",
      calculatedAt,
    };
    resolved.set(regla.concept, componente);

    warnings.push(...componente.warnings);
    trace.push({
      concept: regla.concept,
      ruleId: regla.ruleId,
      ruleVersion: regla.ruleVersion,
      roundingRule: regla.roundingRule,
      sources: componente.sources,
      missingInputs: componente.missingInputs,
      blockedBy: propagacion.bloqueadoPor,
      degradedBy: propagacion.degradadoPor,
      status: componente.status,
    });
  }

  const components = [...resolved.values()];
  const resultadoEspejo: MirrorEngineResult = {
    companyId: entrada.companyId ?? null,
    period: entrada.period,
    engineVersion: MIRROR_ENGINE_VERSION,
    normalizationVersion: MIRROR_NORMALIZATION_VERSION,
    components,
    componentCount: components.length,
    missingComponentCount: components.filter(
      (c) => c.amount == null && SIN_MONTO.has(c.status),
    ).length,
    unsupportedComponentCount: components.filter((c) => c.status === "unsupported")
      .length,
  };

  const componentValues = [...valoresTributarios(resultadoEspejo).values()];
  const certainty = evaluarCertezaPeriodo(entrada.period, componentValues);

  return {
    companyId: entrada.companyId ?? null,
    period: entrada.period,
    engineVersion: UNIFIED_ENGINE_VERSION,
    normalizationVersion: MIRROR_NORMALIZATION_VERSION,
    conceptRegistryVersion: TAX_CONCEPT_REGISTRY_VERSION,
    dependencyGraphVersion: DEPENDENCY_GRAPH_VERSION,
    roundingPolicyVersion: ROUNDING_POLICY_VERSION,
    components,
    componentValues,
    dependencyOrder: orden,
    certainty,
    zeroAudit: auditarCeros(componentValues),
    warnings: [...new Set(warnings)],
    unsupportedCases: components
      .filter((c) => c.status === "unsupported")
      .map((c) => c.concept),
    calculationTrace: trace,
    calculatedAt,
  };
}

/** Vista compatible con el contrato del Motor Espejo de la Etapa 6.6. */
export function aResultadoEspejo(
  resultado: PeriodCalculationResult,
): MirrorEngineResult {
  return {
    companyId: resultado.companyId,
    period: resultado.period,
    engineVersion: MIRROR_ENGINE_VERSION,
    normalizationVersion: resultado.normalizationVersion,
    components: resultado.components,
    componentCount: resultado.components.length,
    missingComponentCount: resultado.components.filter(
      (c) => c.amount == null && SIN_MONTO.has(c.status),
    ).length,
    unsupportedComponentCount: resultado.components.filter(
      (c) => c.status === "unsupported",
    ).length,
  };
}

export function componenteUnificado(
  resultado: PeriodCalculationResult,
  concepto: MirrorConcept,
): ComponentCalculation | null {
  return resultado.components.find((c) => c.concept === concepto) ?? null;
}

export function montoUnificado(
  resultado: PeriodCalculationResult,
  concepto: MirrorConcept,
): number | null {
  return componenteUnificado(resultado, concepto)?.amount ?? null;
}
