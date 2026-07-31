/**
 * Motor Espejo SII — ejecución en modo sombra.
 *
 * Aplica las reglas versionadas en orden y devuelve un cálculo por
 * componente. No escribe cifras productivas, no alimenta el dashboard y no
 * toca `tax_monthly_summaries`.
 *
 * Módulo puro salvo por la marca de tiempo, que puede inyectarse.
 */
import {
  VERSIONED_TAX_RULES,
  type MirrorEngineInput,
  type RuleContext,
} from "./rules";
import {
  MIRROR_ENGINE_VERSION,
  MIRROR_NORMALIZATION_VERSION,
  type ComponentCalculation,
  type MirrorConcept,
  type MirrorEngineResult,
} from "./types";

function limpiarEntradas(
  valores: Record<string, number | string | null | undefined>,
): Record<string, number | string | null> {
  const salida: Record<string, number | string | null> = {};
  for (const [k, v] of Object.entries(valores)) salida[k] = v === undefined ? null : v;
  return salida;
}

/** Estados que significan "no hay monto disponible". */
const SIN_MONTO = new Set(["requires_confirmation", "unavailable", "unsupported"]);

export function ejecutarMotorEspejo(entrada: MirrorEngineInput): MirrorEngineResult {
  const calculatedAt = entrada.calculatedAt ?? new Date().toISOString();
  const resolved = new Map<MirrorConcept, ComponentCalculation>();
  const ctx: RuleContext = { ...entrada, resolved };

  for (const regla of VERSIONED_TAX_RULES) {
    if (entrada.period < regla.validFrom) continue;
    if (regla.validTo && entrada.period > regla.validTo) continue;
    const salida = regla.calculate(ctx);
    const componente: ComponentCalculation = {
      concept: regla.concept,
      amount: salida.amount,
      status: salida.status,
      ruleId: regla.ruleId,
      ruleVersion: regla.ruleVersion,
      sources: salida.sources,
      calculationDescription: salida.calculationDescription,
      inputValues: limpiarEntradas(salida.inputValues),
      missingInputs: salida.missingInputs ?? [],
      warnings: salida.warnings ?? [],
      confidence: salida.confidence ?? "unknown",
      calculatedAt,
    };
    resolved.set(regla.concept, componente);
  }

  const components = [...resolved.values()];
  return {
    companyId: entrada.companyId ?? null,
    period: entrada.period,
    engineVersion: MIRROR_ENGINE_VERSION,
    normalizationVersion: MIRROR_NORMALIZATION_VERSION,
    components,
    componentCount: components.length,
    missingComponentCount: components.filter(
      (c) => c.amount == null && SIN_MONTO.has(c.status),
    ).length,
    unsupportedComponentCount: components.filter((c) => c.status === "unsupported").length,
  };
}

export function componente(
  resultado: MirrorEngineResult,
  concepto: MirrorConcept,
): ComponentCalculation | null {
  return resultado.components.find((c) => c.concept === concepto) ?? null;
}

export function montoDe(
  resultado: MirrorEngineResult,
  concepto: MirrorConcept,
): number | null {
  return componente(resultado, concepto)?.amount ?? null;
}
