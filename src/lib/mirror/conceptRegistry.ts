/**
 * Registro único y cerrado de conceptos tributarios (Etapa 6.8).
 *
 * Un concepto se nombra igual en todos los módulos del núcleo. Cuando el
 * mundo antiguo usa otro nombre, se resuelve aquí mediante alias; nunca
 * duplicando el concepto.
 *
 * Módulo puro: sin red, sin reloj, sin base de datos.
 */
import type { MirrorConcept } from "./types";

export const TAX_CONCEPT_REGISTRY_VERSION = "concept-registry-1.0.0";

export type ConceptKind = "amount" | "rate" | "factor";

export interface TaxConceptDefinition {
  concept: MirrorConcept;
  label: string;
  kind: ConceptKind;
  /** Nombres antiguos usados por el motor legado o por la base de datos. */
  legacyAliases: string[];
}

function def(
  concept: MirrorConcept,
  label: string,
  kind: ConceptKind,
  legacyAliases: string[] = [],
): TaxConceptDefinition {
  return { concept, label, kind, legacyAliases };
}

/** Lista cerrada. Agregar un concepto exige declararlo aquí primero. */
export const TAX_CONCEPT_REGISTRY: TaxConceptDefinition[] = [
  def("sales_taxable", "Ventas afectas", "amount", ["ventasNetas"]),
  def("sales_exempt", "Ventas exentas", "amount", ["ventasExentas"]),
  def("sales_non_taxable", "Ventas no afectas", "amount", []),
  def("sales_total", "Ventas totales", "amount", ["ventasTotales"]),
  def("purchases_taxable", "Compras afectas", "amount", ["comprasNetas"]),
  def("purchases_exempt", "Compras exentas", "amount", ["comprasExentas"]),
  def("purchases_total", "Compras totales", "amount", ["comprasTotales"]),
  def("vat_debit", "IVA débito", "amount", ["ivaDebito", "vat_debit"]),
  def("vat_total_purchases", "IVA total de compras", "amount", []),
  def("vat_common_use", "IVA de uso común", "amount", []),
  def("vat_non_recoverable", "IVA no recuperable", "amount", []),
  def("common_use_recovery_ratio", "Proporción de uso común", "rate", []),
  def("recoverable_vat_credit", "IVA crédito recuperable", "amount", [
    "ivaCredito",
    "current_period_vat_credit",
  ]),
  def("previous_nominal_carryforward", "Remanente anterior nominal", "amount", [
    "remanenteAnterior",
    "previous_vat_carryforward",
  ]),
  def("adjustment_factor", "Factor de reajuste", "factor", []),
  def("adjusted_previous_carryforward", "Remanente anterior reajustado", "amount", []),
  def("other_vat_debits", "Otros débitos de IVA", "amount", ["otrosDebitosIva"]),
  def("other_vat_credits", "Otros créditos de IVA", "amount", ["otrosCreditosIva"]),
  def("vat_advance_change_of_subject", "Anticipo de IVA por cambio de sujeto", "amount", [
    "anticipoIvaDisponible",
  ]),
  def("vat_determined", "IVA determinado", "amount", [
    "ivaEstimado",
    "estimated_vat_payable",
  ]),
  def("next_carryforward", "Remanente siguiente", "amount", [
    "nuevoRemanente",
    "estimated_new_carryforward",
  ]),
  def("ppm_base", "Base del PPM", "amount", ["basePpm", "ppm_tax_base"]),
  def("ppm_rate", "Tasa del PPM", "rate", ["tasaPpm", "ppm_rate"]),
  def("ppm_amount", "PPM", "amount", ["ppmEstimado", "estimated_ppm"]),
  def("withholdings", "Retenciones", "amount", [
    "retencionesEstimadas",
    "withholdings",
  ]),
  def("surcharges", "Recargos", "amount", []),
  def("tax_total_before_surcharges", "Total tributario antes de recargos", "amount", []),
  def("estimated_tax_total_complete", "Total tributario estimado (completo)", "amount", [
    "totalTributario",
    "estimated_tax_total",
  ]),
  def("estimated_tax_total_partial", "Total tributario estimado (parcial)", "amount", []),
  def("official_declared_total", "Total declarado en el F29", "amount", [
    "totalDeclarado",
    "declared_tax_total",
  ]),
  def("confirmed_paid_total", "Total efectivamente pagado", "amount", []),
];

const POR_CONCEPTO = new Map(TAX_CONCEPT_REGISTRY.map((c) => [c.concept, c]));
const POR_ALIAS = new Map<string, MirrorConcept>();
for (const c of TAX_CONCEPT_REGISTRY) {
  for (const alias of c.legacyAliases) POR_ALIAS.set(alias, c.concept);
}

export function definicionConcepto(
  concepto: MirrorConcept,
): TaxConceptDefinition | null {
  return POR_CONCEPTO.get(concepto) ?? null;
}

/** Traduce un nombre antiguo al concepto único. `null` si no está declarado. */
export function conceptoDesdeAlias(alias: string): MirrorConcept | null {
  return POR_ALIAS.get(alias) ?? null;
}

export function esConceptoRegistrado(valor: string): valor is MirrorConcept {
  return POR_CONCEPTO.has(valor as MirrorConcept);
}
