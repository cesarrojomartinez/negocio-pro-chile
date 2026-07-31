import type {
  CarryforwardSource,
  ComparisonMetric,
  PeriodState,
  PpmSource,
  WithholdingsSource,
} from "./engine";

export type TipoDocumentoVenta = "factura" | "boleta" | "notaCredito" | "notaDebito";
export type TipoDocumentoCompra = "factura" | "notaCredito";

export type EstadoDocumentoVenta = "emitido" | "anulado";
export type EstadoDocumentoCompra =
  | "registrada"
  | "aceptada"
  | "pendiente"
  | "reclamada"
  | "noIncluir";

export interface DocumentoTributario {
  id: string;
  fecha: string;
  tipoDocumento: TipoDocumentoVenta | TipoDocumentoCompra;
  folio: number;
  contraparte: string;
  rutContraparte: string;
  neto: number;
  iva: number;
  exento: number;
  total: number;
  estado: EstadoDocumentoVenta | EstadoDocumentoCompra;
  periodo: string;
}

export interface ResumenMensual {
  periodo: string;
  ventasTotales: number;
  ventasFacturas: number;
  ventasBoletas: number;
  ventasExentas: number;
  notasCreditoVentas: number;
  comprasTotales: number;
  comprasNetas: number;
  comprasExentas: number;
  ivaDebito: number;
  /** Verdadero cuando algún documento no traía IVA y hubo que inferirlo. */
  ivaDebitoInferido: boolean;
  ivaCredito: number;
  /** IVA de compras pendientes que podría incorporarse más adelante. */
  ivaCreditoPotencial: number;
  remanenteAnterior: number;
  fuenteRemanente: CarryforwardSource;
  ivaEstimado: number;
  nuevoRemanente: number;
  /** IVA de facturas de compra (DTE 46) excluido del débito fiscal. */
  ivaRetenidoPorComprador?: number;
  /** Anticipo de IVA disponible, imputado y remanente para el mes siguiente. */
  anticipoIvaDisponible?: number;
  anticipoIvaAplicado?: number;
  anticipoIvaRemanente?: number;

  /** IVA estimado si las compras pendientes llegaran a incorporarse. */
  ivaEstimadoConPendientes: number;
  ppmEstimado: number;
  basePpm: number;
  tasaPpm: number | null;
  fuentePpm: PpmSource;
  ppmPendiente: boolean;
  retencionesEstimadas: number;
  fuenteRetenciones: WithholdingsSource;
  totalTributarioEstimado: number;
  margenPorcentaje: number;
  margenPreventivo: number;
  reservaRecomendada: number;
  dineroReservado: number;
}

export interface MetaComercial {
  metaMensual: number;
  ventasAcumuladas: number;
  porcentajeCumplimiento: number;
  montoFaltante: number;
  montoExcedido: number;
  metaSuperada: boolean;
  diasRestantes: number;
  diasTranscurridos: number;
  diasTotales: number;
  promedioDiarioNecesario: number;
  promedioDiarioActual: number;
  proyeccionCierre: number;
}

export interface ComparacionMensual {
  periodoActual: string;
  periodoAnterior: string | null;
  metricas: ComparisonMetric[];
  ventasActuales: number;
  ventasAnteriores: number;
  variacionVentas: number | null;
  comprasActuales: number;
  comprasAnteriores: number;
  variacionCompras: number | null;
  ivaActual: number;
  ivaAnterior: number;
  variacionIva: number | null;
  ticketPromedio: number;
  ticketPromedioAnterior: number;
  cantidadFacturas: number;
  cantidadBoletas: number;
  mejorDia: { fecha: string; monto: number } | null;
  mejorSemana: { etiqueta: string; monto: number } | null;
}

export interface Proyeccion {
  disponible: boolean;
  estadoPeriodo: PeriodState;
  ventasActuales: number;
  promedioDiario: number;
  conservadora: number;
  probable: number;
  alta: number;
  ivaDebitoProyectado: number;
  ventasNetasProyectadas: number;
  ppmProyectado: number;
  impuestosMin: number;
  impuestosMax: number;
}

export type NivelConfiabilidad = "alta" | "media" | "baja" | "desconocida";

export interface ResumenCompras {
  comprasTotales: number;
  comprasNetas: number;
  ivaCredito: number;
  ivaCreditoPotencial: number;
  documentosRegistrados: number;
  documentosPendientes: number;
  documentosReclamados: number;
  documentosNoIncluir: number;
  proveedoresPrincipales: { nombre: string; monto: number; documentos: number }[];
}

export interface ResumenVentas {
  ventasTotales: number;
  /** Neto de ventas con el efecto tributario aplicado (notas de crédito restan). */
  ventasNetas: number;
  ventasFacturas: number;
  ventasBoletas: number;
  ventasExentas: number;
  notasCredito: number;
  /** Documentos que suman ventas (facturas y boletas). */
  cantidadDocumentos: number;
  cantidadNotasCredito: number;
  /** Total de documentos informados en el periodo, incluidas las notas de crédito. */
  cantidadDocumentosInformados: number;
  cantidadFacturas: number;
  cantidadBoletas: number;
  ticketPromedio: number;
  serieDiaria: { fecha: string; monto: number }[];
}


/**
 * Totales de un grupo de documentos informado solo como agregado del resumen
 * oficial del RCV. Los montos van en valor absoluto: el signo lo aporta la
 * categoría (una nota de crédito siempre resta).
 */
export interface AgregadoDteResumen {
  cantidad: number;
  neto: number;
  iva: number;
  exento: number;
  total: number;
}

/**
 * Totales que el SII entrega SOLO como agregado mensual (boletas electrónicas,
 * boletas exentas y comprobantes de pago electrónico). Son cifras oficiales del
 * resumen del RCV: se suman a las ventas del periodo sin inventar documentos.
 *
 * Cuando el periodo no tiene detalle documento por documento, se agregan
 * además las facturas y notas de crédito del mismo resumen oficial.
 */
export interface VentasAgregadasResumen {
  cantidadDocumentos: number;
  neto: number;
  iva: number;
  exento: number;
  total: number;
  facturas?: AgregadoDteResumen;
  notasCredito?: AgregadoDteResumen;
}

/** Compras informadas solo por el resumen oficial, sin detalle individual. */
export interface ComprasAgregadasResumen {
  facturas: AgregadoDteResumen;
  notasCredito: AgregadoDteResumen;
}

export interface PeriodoData {
  periodo: string;
  documentosVenta: DocumentoTributario[];
  documentosCompra: DocumentoTributario[];
  /** Ventas informadas solo como total del mes en el resumen oficial. */
  ventasAgregadasResumen?: VentasAgregadasResumen | null;
  /** Compras informadas solo por el resumen oficial (sin detalle). */
  comprasAgregadasResumen?: ComprasAgregadasResumen | null;

  remanenteAnterior: number;
  fuenteRemanente?: CarryforwardSource;
  /**
   * Falso cuando el remanente anterior no está confirmado. Se calcula con
   * cero, pero el periodo queda marcado como incompleto.
   */
  remanenteConocido?: boolean;
  tasaPpm: number | null;
  fuentePpm?: PpmSource;
  /** Base del PPM confirmada en el F29; reemplaza a la base calculada. */
  basePpmConfirmada?: number | null;
  retencionesEstimadas: number;
  fuenteRetenciones?: WithholdingsSource;
  /** Ajustes de IVA distintos del RCV (créditos y débitos especiales). */
  otrosDebitosIva?: number;
  otrosCreditosIva?: number;
  debitosEspeciales?: number;
  creditosEspeciales?: number;
  /**
   * IVA de ventas cuyo IVA retiene el comprador (factura de compra, DTE 46).
   * Se descuenta del débito fiscal: el vendedor no lo entera.
   */
  ivaRetenidoPorComprador?: number;
  /** Anticipo de IVA por cambio de sujeto disponible para imputar. */
  anticipoIvaDisponible?: number;

  /** Cifras declaradas en el F29 del periodo, cuando existen. */
  ivaDeclarado?: number | null;
  ppmDeclarado?: number | null;
  retencionesDeclaradas?: number | null;
  totalDeclarado?: number | null;
  /** Débito, crédito y remanente siguiente declarados en el F29 oficial. */
  ivaDebitoDeclarado?: number | null;
  ivaCreditoDeclarado?: number | null;
  nuevoRemanenteDeclarado?: number | null;

  metaMensual: number;
  dineroReservado: number;
  diasTranscurridos: number;
  diasTotales: number;
  estadoPeriodo?: PeriodState;
  confiabilidad: NivelConfiabilidad;
}

/**
 * Origen real de la información del periodo seleccionado.
 * No es equivalente al estado de conexión de la empresa.
 */
export type FuentePeriodo =
  /** Datos demostrativos (modo demostración o empresa marcada como demo). */
  | "mock"
  /** Documentos reales importados del Registro de Compras y Ventas. */
  | "rcv_real"
  /** Solo antecedentes del F29 confirmados por el contador. */
  | "accountant_confirmed"
  /** Documentos reales del RCV más antecedentes confirmados del F29. */
  | "rcv_real_plus_accountant"
  /** El periodo aún no fue sincronizado ni tiene antecedentes. */
  | "not_synchronized";

export interface DashboardData {
  /** Origen de la información del periodo mostrado. */
  fuentePeriodo: FuentePeriodo;
  /** Contexto tributario con la procedencia de cada componente. */
  contexto: import("@/lib/taxContext").ContextoTributario;
  empresa: import("./company").Empresa;
  resumen: ResumenMensual;
  /**
   * Resumen tal como lo calculó el motor con el RCV, antes de aplicar las
   * cifras del F29 oficial. Permite medir la precisión de la estimación.
   */
  resumenPreF29: ResumenMensual;
  /** Comparación interna entre la estimación y el F29 oficial del periodo. */
  conciliacionF29: import("@/lib/f29Reconciliation").ConciliacionF29;

  meta: MetaComercial;
  comparacion: ComparacionMensual;
  proyeccion: Proyeccion;
  ventas: ResumenVentas;
  compras: ResumenCompras;
  confiabilidad: NivelConfiabilidad;
  razonesConfiabilidad: string[];
  documentosVenta: DocumentoTributario[];
  documentosCompra: DocumentoTributario[];
}
