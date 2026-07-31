/**
 * Contrato productivo intermedio (Etapa 6.8.1).
 *
 * `ProductiveTaxSummary` es lo único que la capa de presentación y la
 * persistencia antigua reciben. Puede provenir de dos orígenes:
 *
 *  - del motor legado (modos `shadow` y `dual_validation`);
 *  - de `LegacyCompatibilityProjection` (modo `compatibility`).
 *
 * Este módulo NO calcula impuestos: mapea. La única aritmética presente es la
 * reserva preventiva, que es una decisión comercial del producto y no una
 * regla tributaria.
 *
 * Módulo puro: sin red, sin reloj, sin base de datos.
 */
import type { LegacyCompatibilityProjection } from "./legacyProjection";

export const PRODUCTIVE_SUMMARY_VERSION = "productive-summary-1.0.0";

export interface ProductiveTaxSummary {
  period: string;
  /* Comerciales (no tributarios). */
  salesTotal: number;
  exemptSales: number;
  purchasesTotal: number;
  /* Tributarios. */
  vatDebit: number;
  vatCredit: number;
  previousVatCarryforward: number;
  estimatedVatPayable: number;
  estimatedNewCarryforward: number;
  ppmTaxBase: number;
  ppmRate: number | null;
  estimatedPpm: number;
  estimatedWithholdings: number;
  vatAdvanceApplied: number;
  estimatedTaxTotal: number;
  /* Reserva preventiva. */
  preventiveMarginPercent: number;
  preventiveMarginAmount: number;
  recommendedReserve: number;
  reservedAmount: number;
  /* Oficial. */
  declaredTaxTotal: number | null;
  /* Fuentes y estados heredados, sin reinterpretación. */
  carryforwardSource: string;
  ppmSource: string;
  withholdingsSource: string;
  periodState: string;
}

/** Datos comerciales y de estado que el núcleo tributario no produce. */
export interface ContextoProductivoNoTributario {
  salesTotal: number;
  exemptSales: number;
  purchasesTotal: number;
  preventiveMarginPercent: number;
  reservedAmount: number;
  carryforwardSource: string;
  ppmSource: string;
  withholdingsSource: string;
  periodState: string;
}

const MARGEN_MIN = 0;
const MARGEN_MAX = 50;

function normalizarMargen(percent: number): number {
  if (!Number.isFinite(percent)) return MARGEN_MIN;
  return Math.min(MARGEN_MAX, Math.max(MARGEN_MIN, percent));
}

/** Reserva preventiva: política comercial del producto, no regla del SII. */
export function reservaPreventiva(
  totalTributario: number,
  margenPorcentaje: number,
): { percent: number; margin: number; reserve: number } {
  const percent = normalizarMargen(margenPorcentaje);
  const total = Math.max(0, Math.round(totalTributario));
  const margin = Math.round(total * (percent / 100));
  return { percent, margin, reserve: total + margin };
}

/**
 * Construye el contrato productivo a partir de la proyección de
 * compatibilidad. Ninguna cifra tributaria se recalcula aquí.
 */
export function construirResumenProductivo(
  proyeccion: LegacyCompatibilityProjection,
  contexto: ContextoProductivoNoTributario,
): ProductiveTaxSummary {
  const v = proyeccion.values;
  const reserva = reservaPreventiva(
    v.totalTributarioEstimado,
    contexto.preventiveMarginPercent,
  );
  return {
    period: proyeccion.period,
    salesTotal: contexto.salesTotal,
    exemptSales: contexto.exemptSales,
    purchasesTotal: contexto.purchasesTotal,
    vatDebit: v.ivaDebito,
    vatCredit: v.ivaCredito,
    previousVatCarryforward: v.remanenteAnterior,
    estimatedVatPayable: v.ivaEstimado,
    estimatedNewCarryforward: v.nuevoRemanente,
    ppmTaxBase: v.basePpm,
    ppmRate: v.tasaPpm,
    estimatedPpm: v.ppmEstimado,
    estimatedWithholdings: v.retencionesEstimadas,
    vatAdvanceApplied: v.anticipoIvaAplicado,
    estimatedTaxTotal: v.totalTributarioEstimado,
    preventiveMarginPercent: reserva.percent,
    preventiveMarginAmount: reserva.margin,
    recommendedReserve: reserva.reserve,
    reservedAmount: Math.max(0, Math.round(contexto.reservedAmount)),
    declaredTaxTotal: proyeccion.officialDeclaredTotal,
    carryforwardSource: contexto.carryforwardSource,
    ppmSource: contexto.ppmSource,
    withholdingsSource: contexto.withholdingsSource,
    periodState: contexto.periodState,
  };
}

/** Forma legada mínima requerida para comparar sin importar `@/types/tax`. */
export interface ResumenLegadoComparable {
  periodo: string;
  ventasTotales: number;
  ventasExentas: number;
  comprasTotales: number;
  ivaDebito: number;
  ivaCredito: number;
  remanenteAnterior: number;
  ivaEstimado: number;
  nuevoRemanente: number;
  basePpm: number;
  tasaPpm: number | null;
  ppmEstimado: number;
  retencionesEstimadas: number;
  anticipoIvaAplicado?: number;
  totalTributarioEstimado: number;
  margenPorcentaje: number;
  margenPreventivo: number;
  reservaRecomendada: number;
  dineroReservado: number;
  fuenteRemanente: string;
  fuentePpm: string;
  fuenteRetenciones: string;
}

/** Traduce el resultado del motor legado al mismo contrato, sin recalcular. */
export function resumenLegadoAProductivo(
  resumen: ResumenLegadoComparable,
  extras: { declaredTaxTotal: number | null; periodState: string },
): ProductiveTaxSummary {
  return {
    period: resumen.periodo,
    salesTotal: resumen.ventasTotales,
    exemptSales: resumen.ventasExentas,
    purchasesTotal: resumen.comprasTotales,
    vatDebit: resumen.ivaDebito,
    vatCredit: resumen.ivaCredito,
    previousVatCarryforward: resumen.remanenteAnterior,
    estimatedVatPayable: resumen.ivaEstimado,
    estimatedNewCarryforward: resumen.nuevoRemanente,
    ppmTaxBase: resumen.basePpm,
    ppmRate: resumen.tasaPpm,
    estimatedPpm: resumen.ppmEstimado,
    estimatedWithholdings: resumen.retencionesEstimadas,
    vatAdvanceApplied: resumen.anticipoIvaAplicado ?? 0,
    estimatedTaxTotal: resumen.totalTributarioEstimado,
    preventiveMarginPercent: resumen.margenPorcentaje,
    preventiveMarginAmount: resumen.margenPreventivo,
    recommendedReserve: resumen.reservaRecomendada,
    reservedAmount: resumen.dineroReservado,
    declaredTaxTotal: extras.declaredTaxTotal,
    carryforwardSource: resumen.fuenteRemanente,
    ppmSource: resumen.fuentePpm,
    withholdingsSource: resumen.fuenteRetenciones,
    periodState: extras.periodState,
  };
}
