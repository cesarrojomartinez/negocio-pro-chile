import {
  calculateConfidenceLevel,
  construirComparacion,
  construirMeta,
  construirProyeccion,
  construirResumenCompras,
  construirResumenMensual,
  construirResumenVentas,
  estadoDelPeriodo,
  nivelAEspanol,
} from "@/utils/taxCalculations";
import type { Empresa } from "@/types/company";
import type { DashboardData, PeriodoData, ResumenMensual, ResumenVentas } from "@/types/tax";

export interface EntradaDashboard {
  empresa: Empresa;
  periodo: PeriodoData;
  periodoAnterior: PeriodoData | null;
  idPeriodoAnterior: string | null;
  margenPorcentaje: number;
  dineroReservado: number;
  metaMensual: number;
  diasDesdeSincronizacion?: number | null;
  errorSincronizacion?: boolean;
  configuradoManualmente?: boolean;
}

/**
 * Construye el dashboard completo a partir de datos ya cargados.
 * Es la única ruta de armado: la usan el modo demostración, el modo nube y
 * el recálculo del backend, de modo que los tres entregan el mismo resultado.
 */
export function construirDashboard(entrada: EntradaDashboard): DashboardData {
  const { periodo } = entrada;
  const estado = periodo.estadoPeriodo ?? estadoDelPeriodo(periodo.periodo);
  const data: PeriodoData = { ...periodo, estadoPeriodo: estado };

  const resumen = construirResumenMensual(data, {
    margenPorcentaje: entrada.margenPorcentaje,
    dineroReservado: entrada.dineroReservado,
  });
  const ventas = construirResumenVentas(data.documentosVenta);
  const compras = construirResumenCompras(data.documentosCompra);
  const meta = construirMeta(data, resumen.ventasTotales, entrada.metaMensual);

  let anterior: { resumen: ResumenMensual; ventas: ResumenVentas } | null = null;
  if (entrada.periodoAnterior) {
    const prev = entrada.periodoAnterior;
    anterior = {
      resumen: construirResumenMensual(prev, {
        margenPorcentaje: entrada.margenPorcentaje,
        dineroReservado: prev.dineroReservado,
      }),
      ventas: construirResumenVentas(prev.documentosVenta),
    };
  }

  const confianza = calculateConfidenceLevel({
    hasSales: ventas.cantidadDocumentos > 0,
    hasPurchases: data.documentosCompra.length > 0,
    syncError: !!entrada.errorSincronizacion,
    carryforwardSource: resumen.fuenteRemanente,
    ppmSource: resumen.fuentePpm,
    withholdingsSource: resumen.fuenteRetenciones,
    pendingPurchaseDocuments: compras.documentosPendientes,
    daysSinceLastSync: entrada.diasDesdeSincronizacion ?? null,
    hasPreviousPeriod: anterior != null,
    manuallyConfigured: !!entrada.configuradoManualmente,
  });

  return {
    empresa: entrada.empresa,
    resumen,
    meta,
    ventas,
    compras,
    confiabilidad: nivelAEspanol(confianza.level),
    razonesConfiabilidad: confianza.reasons,
    comparacion: construirComparacion(
      data.periodo,
      { resumen, ventas },
      anterior,
      anterior ? entrada.idPeriodoAnterior : null,
    ),
    proyeccion: construirProyeccion(resumen, meta, { estadoPeriodo: estado }),
    documentosVenta: data.documentosVenta,
    documentosCompra: data.documentosCompra,
  };
}
