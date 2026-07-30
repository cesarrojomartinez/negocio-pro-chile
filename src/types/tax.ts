export type TipoDocumentoVenta = "factura" | "boleta" | "notaCredito";
export type TipoDocumentoCompra = "factura" | "notaCredito";

export type EstadoDocumentoVenta = "emitido" | "anulado";
export type EstadoDocumentoCompra =
  | "registrada"
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
  ivaCredito: number;
  remanenteAnterior: number;
  ivaEstimado: number;
  nuevoRemanente: number;
  ppmEstimado: number;
  retencionesEstimadas: number;
  totalTributarioEstimado: number;
  margenPreventivo: number;
  reservaRecomendada: number;
  dineroReservado: number;
}

export interface MetaComercial {
  metaMensual: number;
  ventasAcumuladas: number;
  porcentajeCumplimiento: number;
  montoFaltante: number;
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
  ventasActuales: number;
  promedioDiario: number;
  conservadora: number;
  probable: number;
  alta: number;
  impuestosMin: number;
  impuestosMax: number;
}

export type NivelConfiabilidad = "alta" | "media" | "baja";

export interface ResumenCompras {
  comprasTotales: number;
  comprasNetas: number;
  ivaCredito: number;
  documentosRegistrados: number;
  documentosPendientes: number;
  documentosReclamados: number;
  documentosNoIncluir: number;
  proveedoresPrincipales: { nombre: string; monto: number; documentos: number }[];
}

export interface ResumenVentas {
  ventasTotales: number;
  ventasFacturas: number;
  ventasBoletas: number;
  ventasExentas: number;
  notasCredito: number;
  cantidadDocumentos: number;
  ticketPromedio: number;
  serieDiaria: { fecha: string; monto: number }[];
}

export interface PeriodoData {
  periodo: string;
  documentosVenta: DocumentoTributario[];
  documentosCompra: DocumentoTributario[];
  remanenteAnterior: number;
  tasaPpm: number;
  retencionesEstimadas: number;
  metaMensual: number;
  dineroReservado: number;
  diasTranscurridos: number;
  diasTotales: number;
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
  documentosVenta: DocumentoTributario[];
  documentosCompra: DocumentoTributario[];
}
