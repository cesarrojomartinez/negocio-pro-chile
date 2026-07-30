/**
 * Contratos del proveedor SII.
 *
 * Este módulo es puro: solo tipos, códigos de error y mensajes.
 * No contiene lógica de red ni acceso a la base de datos, de modo que el
 * adaptador simulado y el futuro adaptador de API Gateway compartan la
 * misma interfaz sin cambiar el resto de la aplicación.
 */

export type SiiProviderId = "mock" | "api_gateway";

/** Método de autenticación declarado. En esta etapa siempre es demostrativo. */
export type SiiAuthMethod = "demo" | "tax_key" | "certificate";

/** Módulos que puede entregar el proveedor. Coinciden con el enum de la base. */
export type SiiModule =
  | "rcv_sales_summary"
  | "rcv_sales_documents"
  | "rcv_purchases_registered"
  | "rcv_purchases_pending"
  | "rcv_purchases_claimed"
  | "rcv_purchases_excluded"
  | "f29_periods"
  | "f29_detail"
  | "f29_compact_pdf"
  | "withholdings";

/**
 * Archivos individuales de documentos tributarios (Portal MIPYME).
 * No son módulos de sincronización: se descargan uno por uno, bajo demanda.
 */
export type DteFileModule =
  | "dte_pdf_issued"
  | "dte_xml_issued"
  | "dte_pdf_received"
  | "dte_xml_received";

export const ETIQUETA_MODULO_DTE: Record<DteFileModule, string> = {
  dte_pdf_issued: "PDF de documento emitido",
  dte_xml_issued: "XML de documento emitido",
  dte_pdf_received: "PDF de documento recibido",
  dte_xml_received: "XML de documento recibido",
};

/** Cualquier recurso consultable del proveedor. */
export type ModuloConsulta = SiiModule | DteFileModule;

export function esModuloSii(modulo: ModuloConsulta): modulo is SiiModule {
  return !modulo.startsWith("dte_");
}

export const MODULOS_SINCRONIZACION: SiiModule[] = [
  "rcv_sales_documents",
  "rcv_purchases_registered",
  "rcv_purchases_pending",
  "rcv_purchases_claimed",
  "rcv_purchases_excluded",
  "f29_periods",
  "withholdings",
];

export const ETIQUETA_MODULO: Record<SiiModule, string> = {
  rcv_sales_summary: "Resumen de ventas",
  rcv_sales_documents: "Documentos de venta",
  rcv_purchases_registered: "Compras registradas",
  rcv_purchases_pending: "Compras pendientes",
  rcv_purchases_claimed: "Compras reclamadas",
  rcv_purchases_excluded: "Compras no incluidas",
  f29_periods: "Historial de F29",
  f29_detail: "Detalle de F29",
  f29_compact_pdf: "Formulario 29 compacto (PDF)",
  withholdings: "Retenciones",
};

/** Códigos de error normalizados del proveedor. */
export type SiiErrorCode =
  | "PROVIDER_NOT_CONFIGURED"
  | "CONNECTION_REQUIRED"
  | "INVALID_CREDENTIALS"
  | "INVALID_REQUEST"
  | "COMPANY_ACCESS_DENIED"
  | "ACCOUNT_BLOCKED"
  | "AUTH_EXPIRED"
  | "SESSION_EXPIRED"
  | "SESSION_INVALID"
  | "NOT_AUTHORIZED"
  | "COMPANY_NOT_FOUND"
  | "PERIOD_NOT_AVAILABLE"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_MAINTENANCE"
  | "SII_MAINTENANCE"
  | "TIMEOUT"
  | "MALFORMED_RESPONSE"
  | "INVALID_PROVIDER_RESPONSE"
  | "PARTIAL_DATA"
  | "INSUFFICIENT_CREDITS"
  | "PRODUCT_NOT_ENABLED"
  | "RESOURCE_NOT_DOCUMENTED"
  | "PROXY_REQUIRED"
  | "PROXY_UNAVAILABLE"
  | "REQUEST_BUDGET_REACHED"
  | "UNKNOWN_ERROR";



/** Mensajes en español, sin jerga técnica, para mostrar al microempresario. */
export const MENSAJE_ERROR_SII: Record<SiiErrorCode, string> = {
  PROVIDER_NOT_CONFIGURED:
    "La conexión real con el SII todavía no está habilitada. Por ahora solo funciona la conexión demostrativa.",
  CONNECTION_REQUIRED:
    "Primero necesitas activar la conexión demostrativa de esta empresa.",
  INVALID_CREDENTIALS: "El SII rechazó las credenciales ingresadas.",
  INVALID_REQUEST:
    "La solicitud enviada al proveedor no tenía el formato esperado.",
  COMPANY_ACCESS_DENIED:
    "Las credenciales son válidas, pero no tienen autorización para consultar esta empresa.",

  AUTH_EXPIRED:
    "La autorización demostrativa venció. Vuelve a activar la conexión.",
  NOT_AUTHORIZED: "Esta empresa no está autorizada para consultar esta información.",
  COMPANY_NOT_FOUND: "No encontramos esta empresa en el proveedor demostrativo.",
  PERIOD_NOT_AVAILABLE: "Todavía no hay información disponible para este periodo.",
  RATE_LIMITED: "Hiciste muchas consultas seguidas. Espera unos minutos y vuelve a intentar.",
  PROVIDER_UNAVAILABLE:
    "El servicio demostrativo no respondió. Puedes intentar nuevamente en unos minutos.",
  TIMEOUT: "La consulta demostrativa tardó demasiado. Intenta nuevamente.",
  MALFORMED_RESPONSE:
    "Recibimos información incompleta del proveedor demostrativo y no la usamos.",
  PARTIAL_DATA:
    "Trajimos solo una parte de la información. Los cálculos quedan como estimación parcial.",
  ACCOUNT_BLOCKED:
    "El SII bloqueó el acceso de esta clave. Ingresa al portal del SII para desbloquearla y vuelve a intentar.",
  SESSION_EXPIRED:
    "La sesión del SII utilizada por el proveedor venció. Debes ejecutar nuevamente la consulta para crear una sesión nueva.",
  SESSION_INVALID:
    "La sesión del SII utilizada por el proveedor venció. Debes ejecutar nuevamente la consulta para crear una sesión nueva.",
  PROVIDER_MAINTENANCE:
    "El servicio intermediario está en mantención. Intenta nuevamente más tarde.",
  SII_MAINTENANCE:
    "El sitio del SII está en mantención. Intenta nuevamente más tarde.",
  INVALID_PROVIDER_RESPONSE:
    "Recibimos una respuesta que no pudimos interpretar y no la usamos.",
  INSUFFICIENT_CREDITS:
    "No hay saldo suficiente en el servicio de consultas. Recarga y vuelve a intentar.",
  PRODUCT_NOT_ENABLED:
    "El servicio de consultas no tiene contratado este recurso todavía.",
  RESOURCE_NOT_DOCUMENTED:
    "Este dato no está disponible por ahora en el servicio de consultas.",
  PROXY_REQUIRED:
    "El servicio de consultas exige una salida a internet dedicada que aún no está configurada.",
  PROXY_UNAVAILABLE:
    "La salida a internet dedicada del servicio de consultas no está disponible.",
  REQUEST_BUDGET_REACHED:
    "Alcanzamos el máximo de consultas permitidas en una actualización. Guardamos lo que alcanzamos a traer.",
  UNKNOWN_ERROR: "No pudimos completar la consulta demostrativa. Intenta nuevamente.",
};

/** Errores que tiene sentido reintentar automáticamente. */
export const ERRORES_REINTENTABLES: SiiErrorCode[] = [
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_MAINTENANCE",
  "SII_MAINTENANCE",
  "TIMEOUT",
  "RATE_LIMITED",
];


export class SiiProviderError extends Error {
  readonly code: SiiErrorCode;
  readonly modulo: SiiModule | null;
  readonly reintentable: boolean;

  constructor(code: SiiErrorCode, modulo: SiiModule | null = null) {
    super(MENSAJE_ERROR_SII[code]);
    this.name = "SiiProviderError";
    this.code = code;
    this.modulo = modulo;
    this.reintentable = ERRORES_REINTENTABLES.includes(code);
  }
}

/** Etiqueta obligatoria en toda pantalla que muestre datos del proveedor. */
export const AVISO_DATOS_SIMULADOS =
  "Datos simulados para pruebas. No corresponden a información obtenida del SII.";

// ---------------------------------------------------------------------------
// Formas de datos que entrega el proveedor (aún sin normalizar)
// ---------------------------------------------------------------------------

export type ProviderDocumentType = "factura" | "boleta" | "notaCredito" | "notaDebito";
export type ProviderRcvStatus =
  | "registered"
  | "accepted"
  | "pending"
  | "claimed"
  | "excluded";

export interface ProviderDocument {
  /** Identificador estable del proveedor. Base de la deduplicación. */
  externalId: string;
  documentType: ProviderDocumentType;
  folio: number;
  issueDate: string;
  counterpartyName: string;
  counterpartyRut: string;
  /** Puede venir nulo: el motor infiere el neto desde el total. */
  netAmount: number | null;
  vatAmount: number | null;
  exemptAmount: number | null;
  totalAmount: number;
  rcvStatus: ProviderRcvStatus;
  /**
   * Efecto tributario del documento: 1 suma, -1 resta (notas de crédito).
   * Los montos llegan siempre positivos desde el SII.
   */
  taxEffect?: 1 | -1;
}

/** Una línea del resumen del RCV, por tipo de documento. */
export interface ProviderRcvSummaryLine {
  documentTypeCode: number;
  documentTypeLabel: string | null;
  documentCount: number;
  netAmount: number;
  vatAmount: number;
  exemptAmount: number;
  vatCommonUse: number;
  vatNonRecoverable: number;
  /** Total informado por el SII. Se conserva exactamente como llega. */
  totalAmount: number;
  taxEffect: 1 | -1;
}

/** Totales del resumen del RCV, ya con el signo tributario aplicado. */
export interface ProviderRcvSummary {
  lines: ProviderRcvSummaryLine[];
  documentCount: number;
  netAmount: number;
  vatAmount: number;
  exemptAmount: number;
  totalAmount: number;
  /** Diferencia de conciliación. Nunca invalida el registro. */
  unclassifiedAmount: number;
}

/**
 * Traza no sensible de la respuesta de un recurso: sirve para diagnosticar sin
 * volver a consultar. Nunca contiene montos de contrapartes, RUT ni folios.
 */
export interface ProviderModuleDiagnostics {
  modulo: SiiModule;
  recurso: string;
  estadoHttp: number | null;
  contentType: string | null;
  forma: string;
  clavesSuperiores: string[];
  largoArreglo: number;
  propiedadesPrimerElemento: string[];
  /** Filas que el parser no pudo interpretar. */
  filasNoInterpretadas: number;
}

export interface ProviderSalesResult {
  period: string;
  dataThroughDate: string;
  documents: ProviderDocument[];
  summary: {
    documentCount: number;
    totalAmount: number;
    exemptAmount: number;
  };
  /** Totales oficiales del resumen del RCV, independientes del detalle. */
  rcvSummary?: ProviderRcvSummary;
  diagnostics?: ProviderModuleDiagnostics[];
}

export interface ProviderPurchasesResult {
  period: string;
  dataThroughDate: string;
  /** Documentos separados por estado del RCV, tal como los expone el SII. */
  byStatus: Record<
    "registered" | "pending" | "claimed" | "excluded",
    ProviderDocument[]
  >;
  /** Resumen oficial por estado del RCV. */
  rcvSummaryByStatus?: Record<
    "registered" | "pending" | "claimed" | "excluded",
    ProviderRcvSummary
  >;
  diagnostics?: ProviderModuleDiagnostics[];
}


export type ProviderF29Status = "filed" | "pending" | "not_available";

export interface ProviderF29Entry {
  period: string;
  status: ProviderF29Status;
  declaredVat: number | null;
  declaredPpm: number | null;
  declaredWithholdings: number | null;
  declaredTotal: number | null;
  vatCarryforward: number | null;
  filedAt: string | null;
}

export interface ProviderWithholdingsResult {
  period: string;
  totalAmount: number;
  detail: { concept: string; amount: number }[];
}

export interface ProviderConnection {
  providerConnectionRef: string;
  authorizedRut: string;
  authMethod: SiiAuthMethod;
  connectedAt: string;
  sessionExpiresAt: string;
}

export interface ProviderQuery {
  rut: string;
  period: string;
  providerConnectionRef: string;
  /**
   * Número de consultas exitosas previas de este periodo. El RCV cambia entre
   * consultas: sirve para que el proveedor refleje ese avance sin alterar los
   * identificadores de los documentos ya conocidos.
   */
  revision?: number;
}


/**
 * Interfaz única del proveedor. Hoy la implementa `mockSiiProviderAdapter`;
 * mañana la implementará el adaptador de API Gateway sin tocar la app.
 */
export interface SiiProviderAdapter {
  readonly id: SiiProviderId;
  readonly esSimulado: boolean;
  connectCompany(input: {
    rut: string;
    authMethod: SiiAuthMethod;
  }): Promise<ProviderConnection>;
  authenticateCompany(input: {
    rut: string;
    providerConnectionRef: string;
  }): Promise<{ sessionExpiresAt: string }>;
  disconnectCompany(input: { providerConnectionRef: string }): Promise<void>;
  fetchSalesRcv(query: ProviderQuery): Promise<ProviderSalesResult>;
  fetchPurchasesRcv(query: ProviderQuery): Promise<ProviderPurchasesResult>;
  fetchF29History(query: ProviderQuery & { months: number }): Promise<ProviderF29Entry[]>;
  fetchWithholdings(query: ProviderQuery): Promise<ProviderWithholdingsResult>;
}
