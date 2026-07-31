/**
 * Superposición del contrato productivo sobre el resumen antiguo
 * (Etapa 6.8.1).
 *
 * Cuando la empresa está en modo `compatibility`, las cifras tributarias
 * provienen del núcleo unificado a través de `LegacyCompatibilityProjection`.
 * Este módulo solo copia esos valores en la forma que la interfaz espera: no
 * calcula, no redondea y no reinterpreta ningún concepto.
 */
import type { ProductiveTaxSummary } from "@/lib/mirror/productiveSummary";
import type { ResumenMensual } from "@/types/tax";

export function aplicarResumenProductivo(
  resumen: ResumenMensual,
  productivo: ProductiveTaxSummary,
): ResumenMensual {
  return {
    ...resumen,
    ivaDebito: productivo.vatDebit,
    ivaCredito: productivo.vatCredit,
    remanenteAnterior: productivo.previousVatCarryforward,
    ivaEstimado: productivo.estimatedVatPayable,
    nuevoRemanente: productivo.estimatedNewCarryforward,
    basePpm: productivo.ppmTaxBase,
    tasaPpm: productivo.ppmRate,
    ppmEstimado: productivo.estimatedPpm,
    retencionesEstimadas: productivo.estimatedWithholdings,
    anticipoIvaAplicado: productivo.vatAdvanceApplied,
    totalTributarioEstimado: productivo.estimatedTaxTotal,
    margenPreventivo: productivo.preventiveMarginAmount,
    reservaRecomendada: productivo.recommendedReserve,
    dineroReservado: productivo.reservedAmount,
  };
}
