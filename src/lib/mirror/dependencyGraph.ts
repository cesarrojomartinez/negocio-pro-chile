/**
 * Grafo explícito de dependencias entre conceptos tributarios (Etapa 6.8).
 *
 * El orden de cálculo deja de ser una lista escrita a mano dentro del motor:
 * se deriva del grafo. El grafo además explica por qué un total queda
 * bloqueado, propagando el estado de las entradas faltantes.
 *
 * Módulo puro: sin red, sin reloj, sin base de datos.
 */
import type { ComponentStatus, MirrorConcept } from "./types";

export const DEPENDENCY_GRAPH_VERSION = "dependency-graph-1.0.0";

export interface TaxComponentDependency {
  concept: MirrorConcept;
  /** Sin estos componentes el concepto no puede calcularse. */
  requires: MirrorConcept[];
  /** Mejoran el cálculo, pero su ausencia no lo bloquea. */
  optional: MirrorConcept[];
}

export type TaxComponentDependencyGraph = TaxComponentDependency[];

const nodo = (
  concept: MirrorConcept,
  requires: MirrorConcept[] = [],
  optional: MirrorConcept[] = [],
): TaxComponentDependency => ({ concept, requires, optional });

/**
 * Dependencias declaradas. Los conceptos hoja se alimentan de hechos
 * normalizados o del F29; por eso no declaran requisitos internos.
 */
export const TAX_DEPENDENCY_GRAPH: TaxComponentDependencyGraph = [
  nodo("sales_taxable"),
  nodo("sales_exempt"),
  nodo("sales_non_taxable"),
  nodo("sales_total", [], ["sales_taxable", "sales_exempt", "sales_non_taxable"]),
  nodo("purchases_taxable"),
  nodo("purchases_exempt"),
  nodo("purchases_total", [], ["purchases_taxable", "purchases_exempt"]),
  nodo("vat_debit", [], ["sales_taxable", "sales_exempt"]),
  nodo("vat_total_purchases"),
  nodo("vat_common_use"),
  nodo("vat_non_recoverable"),
  nodo("common_use_recovery_ratio"),
  nodo(
    "recoverable_vat_credit",
    ["vat_total_purchases"],
    ["vat_common_use", "vat_non_recoverable", "common_use_recovery_ratio"],
  ),
  nodo("previous_nominal_carryforward"),
  nodo("adjustment_factor"),
  nodo("adjusted_previous_carryforward", [
    "previous_nominal_carryforward",
    "adjustment_factor",
  ]),
  nodo("other_vat_debits"),
  nodo("other_vat_credits"),
  nodo("vat_advance_change_of_subject"),
  nodo(
    "vat_determined",
    ["vat_debit", "recoverable_vat_credit", "previous_nominal_carryforward"],
    [
      "adjusted_previous_carryforward",
      "other_vat_debits",
      "other_vat_credits",
      "vat_advance_change_of_subject",
    ],
  ),
  nodo(
    "next_carryforward",
    ["vat_debit", "recoverable_vat_credit"],
    ["previous_nominal_carryforward"],
  ),
  nodo("ppm_base", [], ["sales_taxable", "sales_total"]),
  nodo("ppm_rate"),
  nodo("ppm_amount", ["ppm_base", "ppm_rate"]),
  nodo("withholdings"),
  nodo("surcharges"),
  nodo(
    "tax_total_before_surcharges",
    ["vat_determined", "ppm_amount"],
    ["withholdings", "vat_advance_change_of_subject"],
  ),
  nodo(
    "estimated_tax_total_complete",
    ["tax_total_before_surcharges"],
    ["surcharges"],
  ),
  nodo("estimated_tax_total_partial", [], ["vat_determined", "ppm_amount", "withholdings"]),
  nodo("official_declared_total"),
  nodo("confirmed_paid_total", [], ["official_declared_total"]),
];

const POR_CONCEPTO = new Map(TAX_DEPENDENCY_GRAPH.map((n) => [n.concept, n]));

export function dependenciasDe(
  concepto: MirrorConcept,
): TaxComponentDependency | null {
  return POR_CONCEPTO.get(concepto) ?? null;
}

export class DependencyGraphError extends Error {}

/**
 * Orden topológico determinístico. Lanza `DependencyGraphError` cuando hay un
 * ciclo o cuando una dependencia declarada no existe en el grafo.
 */
export function ordenTopologico(
  grafo: TaxComponentDependencyGraph = TAX_DEPENDENCY_GRAPH,
): MirrorConcept[] {
  const indice = new Map(grafo.map((n) => [n.concept, n]));
  const estado = new Map<MirrorConcept, "visitando" | "listo">();
  const salida: MirrorConcept[] = [];

  const visitar = (concepto: MirrorConcept, camino: MirrorConcept[]) => {
    const actual = estado.get(concepto);
    if (actual === "listo") return;
    if (actual === "visitando") {
      throw new DependencyGraphError(
        `Ciclo de dependencias: ${[...camino, concepto].join(" → ")}`,
      );
    }
    const n = indice.get(concepto);
    if (!n) {
      throw new DependencyGraphError(`Dependencia no declarada: ${concepto}`);
    }
    estado.set(concepto, "visitando");
    for (const dep of [...n.requires, ...n.optional]) {
      visitar(dep, [...camino, concepto]);
    }
    estado.set(concepto, "listo");
    salida.push(concepto);
  };

  for (const n of grafo) visitar(n.concept, []);
  return salida;
}

export interface PropagacionEntradas {
  /** Estado del componente ya resuelto; ausente significa "no calculado". */
  resueltos: Map<MirrorConcept, { amount: number | null; status: ComponentStatus }>;
}

export interface PropagacionResultado {
  /** Requisitos sin monto disponible. */
  bloqueadoPor: MirrorConcept[];
  /** Opcionales sin monto: no bloquean, pero degradan la certeza. */
  degradadoPor: MirrorConcept[];
  /** Estado propagado desde los requisitos, si corresponde. */
  estadoPropagado: ComponentStatus | null;
}

const SIN_MONTO: ReadonlySet<ComponentStatus> = new Set<ComponentStatus>([
  "requires_confirmation",
  "unavailable",
  "unsupported",
]);

/** Propaga los estados de las entradas hacia un concepto. */
export function propagarEstado(
  concepto: MirrorConcept,
  entradas: PropagacionEntradas,
  grafo: TaxComponentDependencyGraph = TAX_DEPENDENCY_GRAPH,
): PropagacionResultado {
  const n = grafo.find((x) => x.concept === concepto);
  if (!n) throw new DependencyGraphError(`Dependencia no declarada: ${concepto}`);

  const faltante = (c: MirrorConcept) => {
    const r = entradas.resueltos.get(c);
    if (!r) return true;
    if (r.status === "not_applicable") return false;
    return r.amount == null && SIN_MONTO.has(r.status);
  };

  const bloqueadoPor = n.requires.filter(faltante);
  const degradadoPor = n.optional.filter(faltante);

  let estadoPropagado: ComponentStatus | null = null;
  if (bloqueadoPor.length > 0) {
    const estados = bloqueadoPor.map(
      (c) => entradas.resueltos.get(c)?.status ?? "unavailable",
    );
    estadoPropagado = estados.includes("unsupported")
      ? "unsupported"
      : estados.includes("requires_confirmation")
        ? "requires_confirmation"
        : "unavailable";
  }

  return { bloqueadoPor, degradadoPor, estadoPropagado };
}
