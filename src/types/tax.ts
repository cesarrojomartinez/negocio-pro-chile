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


export interface PeriodoData {
  periodo: string;
  documentosVenta: DocumentoTributario[];
  documentosCompra: DocumentoTributario[];
  remanenteAnterior: number;
  fuenteRemanente?: CarryforwardSource;
  tasaPpm: number | null;
  fuentePpm?: PpmSource;
  retencionesEstimadas: number;
  fuenteRetenciones?: WithholdingsSource;
  metaMensual: number;
  dineroReservado: number;
  diasTranscurridos: number;
  diasTotales: number;
  estadoPeriodo?: PeriodState;
  confiabilidad: NivelConfiabilidad;
}

export interface DashboardData {
  empresa: import("./company").Empresa;
  resumen: ResumenMensual;
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
