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
  | "withholdings";

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
  withholdings: "Retenciones",
};

/** Códigos de error normalizados del proveedor. */
export type SiiErrorCode =
  | "PROVIDER_NOT_CONFIGURED"
  | "CONNECTION_REQUIRED"
  | "INVALID_CREDENTIALS"
  | "AUTH_EXPIRED"
  | "NOT_AUTHORIZED"
  | "COMPANY_NOT_FOUND"
  | "PERIOD_NOT_AVAILABLE"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "TIMEOUT"
  | "MALFORMED_RESPONSE"
  | "PARTIAL_DATA"
  | "UNKNOWN_ERROR";

/** Mensajes en español, sin jerga técnica, para mostrar al microempresario. */
export const MENSAJE_ERROR_SII: Record<SiiErrorCode, string> = {
  PROVIDER_NOT_CONFIGURED:
    "La conexión real con el SII todavía no está habilitada. Por ahora solo funciona la conexión demostrativa.",
  CONNECTION_REQUIRED:
    "Primero necesitas activar la conexión demostrativa de esta empresa.",
  INVALID_CREDENTIALS:
    "No pudimos validar la autorización demostrativa de esta empresa.",
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
  UNKNOWN_ERROR: "No pudimos completar la consulta demostrativa. Intenta nuevamente.",
};

/** Errores que tiene sentido reintentar automáticamente. */
export const ERRORES_REINTENTABLES: SiiErrorCode[] = [
  "PROVIDER_UNAVAILABLE",
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
}

export interface ProviderPurchasesResult {
  period: string;
  dataThroughDate: string;
  /** Documentos separados por estado del RCV, tal como los expone el SII. */
  byStatus: Record<
    "registered" | "pending" | "claimed" | "excluded",
    ProviderDocument[]
  >;
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
