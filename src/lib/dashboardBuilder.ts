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
import type {
  DashboardData,
  FuentePeriodo,
  PeriodoData,
  ResumenMensual,
  ResumenVentas,
} from "@/types/tax";

/**
 * Determina el origen real del periodo. Una empresa conectada no implica que
 * todos sus periodos tengan información importada.
 */
export function determinarFuentePeriodo(entrada: {
  esDemo: boolean;
  hayDocumentos: boolean;
  f29Confirmado: boolean;
}): FuentePeriodo {
  if (entrada.esDemo) return "mock";
  if (entrada.hayDocumentos && entrada.f29Confirmado) return "rcv_real_plus_accountant";
  if (entrada.hayDocumentos) return "rcv_real";
  if (entrada.f29Confirmado) return "accountant_confirmed";
  return "not_synchronized";
}

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
  /** Empresa o modo demostrativo: sus cifras son ficticias. */
  esDemo?: boolean;
  /** El periodo tiene un F29 confirmado por el contador. */
  f29Confirmado?: boolean;
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
    fuentePeriodo: determinarFuentePeriodo({
      esDemo: !!entrada.esDemo,
      hayDocumentos:
        data.documentosVenta.length > 0 || data.documentosCompra.length > 0,
      f29Confirmado: !!entrada.f29Confirmado,
    }),
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
