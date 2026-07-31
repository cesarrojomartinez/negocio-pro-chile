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
import {
  construirContextoTributario,
  fuenteConceptoPpm,
  fuenteConceptoRemanente,
  fuenteConceptoRetenciones,
} from "@/lib/taxContext";
import { conciliarConF29Oficial } from "@/lib/f29Reconciliation";
import { aplicarResumenProductivo } from "@/lib/productiveOverlay";
import type { ProductiveTaxSummary } from "@/lib/mirror/productiveSummary";
import type { ConceptSource } from "@/types/engine";
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
 * todos sus periodos tengan información importada, pero una sincronización
 * real exitosa (o un resumen real guardado) sí basta para considerarlo real
 * aunque el F29 todavía no esté confirmado.
 */
export function determinarFuentePeriodo(entrada: {
  esDemo: boolean;
  hayDocumentos: boolean;
  f29Confirmado: boolean;
  /** Existe sincronización real exitosa, snapshot o resumen real del periodo. */
  sincronizacionReal?: boolean;
}): FuentePeriodo {
  if (entrada.esDemo) return "mock";
  const hayRcvReal = entrada.hayDocumentos || !!entrada.sincronizacionReal;
  if (hayRcvReal && entrada.f29Confirmado) return "rcv_real_plus_accountant";
  if (hayRcvReal) return "rcv_real";
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
  /** Hubo sincronización real exitosa o hay resumen real guardado. */
  sincronizacionReal?: boolean;
  /** Marca de tiempo del cálculo, si el llamador la controla. */
  calculadoEn?: string | null;
  /**
   * Tasa de PPM elegida por la persona (fracción, por ejemplo 0.008 para 0,8%).
   * Reemplaza a la tasa estimada solo para el cálculo mostrado en pantalla.
   */
  tasaPpmPersonalizada?: number | null;
  /**
   * Contrato productivo ya calculado por el orquestador único
   * (`calculateTaxPeriod`) en modo `compatibility`. Cuando viene presente,
   * dashboardBuilder no usa cifras tributarias del motor antiguo.
   */
  resumenProductivo?: ProductiveTaxSummary | null;
}

/**
 * Construye el dashboard completo a partir de datos ya cargados.
 * Es la única ruta de armado: la usan el modo demostración, el modo nube y
 * el recálculo del backend, de modo que los tres entregan el mismo resultado.
 */
export function construirDashboard(entrada: EntradaDashboard): DashboardData {
  const { periodo } = entrada;
  const estado = periodo.estadoPeriodo ?? estadoDelPeriodo(periodo.periodo);
  const tasaManual =
    entrada.tasaPpmPersonalizada != null && entrada.tasaPpmPersonalizada >= 0
      ? entrada.tasaPpmPersonalizada
      : null;
  const data: PeriodoData = {
    ...periodo,
    estadoPeriodo: estado,
    ...(tasaManual != null
      ? { tasaPpm: tasaManual, fuentePpm: "configured" as const }
      : {}),
  };

  const resumenEstimado = construirResumenMensual(data, {
    margenPorcentaje: entrada.margenPorcentaje,
    dineroReservado: entrada.dineroReservado,
  });
  /**
   * Comparación interna con el Formulario 29 oficial: si el periodo ya fue
   * declarado, la pantalla debe mostrar exactamente sus cifras.
   */
  const { resumen: resumenConciliado, conciliacion } = conciliarConF29Oficial(
    resumenEstimado,
    {
      ivaDebito: data.ivaDebitoDeclarado ?? null,
      ivaCredito: data.ivaCreditoDeclarado ?? null,
      remanenteAnterior: null,
      ivaDeterminado: data.ivaDeclarado ?? null,
      nuevoRemanente: data.nuevoRemanenteDeclarado ?? null,
      ppm: data.ppmDeclarado ?? null,
      retenciones: data.retencionesDeclaradas ?? null,
      totalAPagar: data.totalDeclarado ?? null,
    },
    { margenPorcentaje: entrada.margenPorcentaje },
  );
  /**
   * Modo `compatibility`: las cifras tributarias ya vienen calculadas por el
   * núcleo unificado. Aquí solo se copian; no se recalcula nada.
   */
  const resumen = entrada.resumenProductivo
    ? aplicarResumenProductivo(resumenConciliado, entrada.resumenProductivo)
    : resumenConciliado;
  const ventas = construirResumenVentas(data.documentosVenta, data.ventasAgregadasResumen);
  const compras = construirResumenCompras(
    data.documentosCompra,
    data.comprasAgregadasResumen,
  );

  const meta = construirMeta(data, resumen.ventasTotales, entrada.metaMensual);


  let anterior: { resumen: ResumenMensual; ventas: ResumenVentas } | null = null;
  if (entrada.periodoAnterior) {
    const prev = entrada.periodoAnterior;
    anterior = {
      resumen: construirResumenMensual(prev, {
        margenPorcentaje: entrada.margenPorcentaje,
        dineroReservado: prev.dineroReservado,
      }),
      ventas: construirResumenVentas(prev.documentosVenta, prev.ventasAgregadasResumen),
    };
  }

  const confianza = calculateConfidenceLevel({
    hasSales: ventas.cantidadDocumentos > 0,
    hasPurchases: data.documentosCompra.length > 0 || compras.comprasTotales !== 0,

    syncError: !!entrada.errorSincronizacion,
    carryforwardSource: resumen.fuenteRemanente,
    ppmSource: resumen.fuentePpm,
    withholdingsSource: resumen.fuenteRetenciones,
    pendingPurchaseDocuments: compras.documentosPendientes,
    daysSinceLastSync: entrada.diasDesdeSincronizacion ?? null,
    hasPreviousPeriod: anterior != null,
    manuallyConfigured: !!entrada.configuradoManualmente,
  });

  const fuentePeriodo = determinarFuentePeriodo({
    esDemo: !!entrada.esDemo,
    hayDocumentos:
      data.documentosVenta.length > 0 || data.documentosCompra.length > 0,
    f29Confirmado: !!entrada.f29Confirmado,
    sincronizacionReal: !!entrada.sincronizacionReal,
  });

  const fuenteDocumentos: ConceptSource = entrada.esDemo
    ? "mock"
    : data.documentosVenta.length > 0 || data.documentosCompra.length > 0
      ? "rcv"
      : "unknown";

  const contexto = construirContextoTributario({
    periodo: data.periodo,
    vatDebit: resumen.ivaDebito,
    vatDebitSource: fuenteDocumentos,
    currentPeriodVatCredit: resumen.ivaCredito,
    vatCreditSource: entrada.esDemo
      ? "mock"
      : data.documentosCompra.length > 0
        ? "rcv"
        : "unknown",
    previousVatCarryforward:
      data.remanenteConocido === false ? null : resumen.remanenteAnterior,
    carryforwardSource: entrada.esDemo
      ? "mock"
      : fuenteConceptoRemanente(resumen.fuenteRemanente),
    otherVatDebits: data.otrosDebitosIva ?? 0,
    otherVatCredits: data.otrosCreditosIva ?? 0,
    specialDebits: data.debitosEspeciales ?? 0,
    specialCredits: data.creditosEspeciales ?? 0,
    vatAdvanceAvailable: data.anticipoIvaDisponible ?? 0,
    vatAdvanceSource: entrada.esDemo ? "mock" : "accountant_confirmed",

    ppmTaxBase: resumen.basePpm,
    ppmBaseSource:
      data.basePpmConfirmada != null && data.basePpmConfirmada > 0
        ? "accountant_confirmed"
        : entrada.esDemo
          ? "mock"
          : "calculated",
    ppmRate: resumen.tasaPpm,
    ppmRateSource: fuenteConceptoPpm(resumen.fuentePpm),
    withholdings:
      resumen.fuenteRetenciones === "unknown" ? null : resumen.retencionesEstimadas,
    withholdingsSource: fuenteConceptoRetenciones(resumen.fuenteRetenciones),
    salesSource: fuenteDocumentos,
    hasSales: data.documentosVenta.length > 0,
    hasPurchases: data.documentosCompra.length > 0,
    declaredVat: data.ivaDeclarado ?? null,
    declaredPpm: data.ppmDeclarado ?? null,
    declaredWithholdings: data.retencionesDeclaradas ?? null,
    declaredTaxTotal: data.totalDeclarado ?? null,
    f29Confirmado: !!entrada.f29Confirmado,
    periodoCerrado: estado === "closed",
    calculatedAt: entrada.calculadoEn ?? null,
  });

  return {
    fuentePeriodo,
    contexto,
    empresa: entrada.empresa,
    resumen,
    resumenPreF29: resumenEstimado,
    conciliacionF29: conciliacion,
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
