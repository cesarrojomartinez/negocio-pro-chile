/**
 * Mapa de recursos oficiales de API Gateway V2.
 *
 * Cada entrada proviene EXCLUSIVAMENTE del esquema OpenAPI oficial publicado en
 * https://app.apigateway.cl/schema/api/ (openapi 3.0.3, servidor
 * https://app.apigateway.cl). No hay rutas inferidas ni parámetros adivinados:
 * un recurso que no aparece en el esquema queda con `documented: false` y
 * `enabled: false`, y la aplicación lo trata como no disponible.
 *
 * Este archivo es puro y NO contiene secretos: solo rutas y metadatos.
 */
import type { DteFileModule, SiiModule } from "./contracts";

export type ApiGatewayMethod = "GET" | "POST";

export interface ApiGatewayResourceDefinition {
  module: SiiModule;
  method: ApiGatewayMethod;
  /** Ruta relativa a la base, con marcadores `{...}` del esquema oficial. */
  path: string;
  /** Verdadero solo si la ruta aparece tal cual en el esquema oficial. */
  documented: boolean;
  /** Verdadero solo si además se puede ejecutar en esta etapa de prueba. */
  enabled: boolean;
  /**
   * Créditos por consulta. El esquema oficial no publica el costo por recurso,
   * por eso queda indefinido y el consumo real se lee de las cabeceras de
   * respuesta (`x-stats-credits-used`).
   */
  estimatedCredits?: number;
  /** Nota interna para el reporte y el panel de diagnóstico. */
  nota?: string;
}

/** Estados del RCV de compras según el esquema oficial. */
export const ESTADOS_RCV_COMPRAS = {
  rcv_purchases_registered: "REGISTRO",
  rcv_purchases_pending: "PENDIENTE",
  rcv_purchases_claimed: "RECLAMADO",
  rcv_purchases_excluded: "NO_INCLUIR",
} as const satisfies Partial<Record<SiiModule, string>>;

/**
 * Recurso usado solo para validar credenciales del SII antes de consultar.
 * Documentado como "Datos del Contribuyente" en MiSII.
 */
export const RECURSO_VALIDACION = {
  method: "POST" as const,
  path: "sii/misii/contribuyente/datos",
  documented: true,
};

/** Recurso sin credenciales del SII, usado para el diagnóstico de conectividad. */
export const RECURSO_DIAGNOSTICO = {
  method: "GET" as const,
  path: "sii/indicadores/uf/anual/{anio}",
  documented: true,
};

export const RECURSOS_API_GATEWAY: ApiGatewayResourceDefinition[] = [
  {
    module: "rcv_sales_summary",
    method: "POST",
    path: "sii/rcv/ventas/resumen/{emisor}/{periodo}",
    documented: true,
    enabled: true,
    nota: "Resumen de Ventas. Entrega totales por tipo de documento (rsmn*).",
  },
  {
    module: "rcv_sales_documents",
    method: "POST",
    path: "sii/rcv/ventas/detalle/{emisor}/{periodo}/{dte}",
    documented: true,
    enabled: true,
    nota: "Detalle de Ventas. Requiere un tipo de documento por consulta.",
  },
  {
    module: "rcv_purchases_registered",
    method: "POST",
    path: "sii/rcv/compras/detalle/{receptor}/{periodo}/{dte}/{estado}",
    documented: true,
    enabled: true,
    nota: "Detalle de Compras con estado REGISTRO.",
  },
  {
    module: "rcv_purchases_pending",
    method: "POST",
    path: "sii/rcv/compras/detalle/{receptor}/{periodo}/{dte}/{estado}",
    documented: true,
    enabled: true,
    nota: "Detalle de Compras con estado PENDIENTE.",
  },
  {
    module: "rcv_purchases_claimed",
    method: "POST",
    path: "sii/rcv/compras/detalle/{receptor}/{periodo}/{dte}/{estado}",
    documented: true,
    enabled: true,
    nota: "Detalle de Compras con estado RECLAMADO.",
  },
  {
    module: "rcv_purchases_excluded",
    method: "POST",
    path: "sii/rcv/compras/detalle/{receptor}/{periodo}/{dte}/{estado}",
    documented: true,
    enabled: true,
    nota: "Detalle de Compras con estado NO_INCLUIR.",
  },
  {
    module: "f29_periods",
    method: "POST",
    path: "sii/f29/declaraciones/listado/{periodo}",
    documented: true,
    enabled: true,
    nota: "Listado de declaraciones por período (YYYY o YYYY-MM): periodo, folio, fecha y estado.",
  },
  {
    module: "f29_compact_pdf",
    method: "POST",
    path: "sii/f29/formulario_compacto/pdf/{folio}",
    documented: true,
    // Se ejecuta solo desde la descarga controlada del F29, no en la
    // sincronización general: por eso no entra en los módulos habilitados.
    enabled: false,
    estimatedCredits: 0.2,
    nota:
      "PDF compacto del F29. Se descarga una sola vez por folio y su contenido " +
      "se lee en el servidor con un lector determinístico (sin IA ni OCR).",
  },
  {
    module: "f29_detail",
    method: "POST",
    path: "sii/f29/detalles_declaracion/{folio}",
    documented: true,
    enabled: false,
    nota:
      "Documentado, pero la respuesta oficial solo trae folio, periodo, estado e historial. " +
      "No entrega códigos estructurados (remanente, PPM, retenciones), por eso la lectura " +
      "estructurada queda pendiente y el recurso no se activa.",
  },
  {
    module: "withholdings",
    method: "POST",
    path: "",
    documented: false,
    enabled: false,
    nota:
      "No existe un recurso oficial de retenciones en el esquema V2. Se mantiene la " +
      "información previa o configurada y se baja la confiabilidad.",
  },
];

/** Resumen de compras por estado (se usa para saber qué tipos de DTE pedir). */
export const RECURSO_RESUMEN_COMPRAS = {
  method: "POST" as const,
  path: "sii/rcv/compras/resumen/{receptor}/{periodo}/{estado}",
  documented: true,
};

export function recursoDe(modulo: SiiModule): ApiGatewayResourceDefinition {
  const r = RECURSOS_API_GATEWAY.find((x) => x.module === modulo);
  if (!r) throw new Error(`Recurso no definido para el módulo ${modulo}`);
  return r;
}

/** Módulos que esta etapa puede consultar realmente. */
export const MODULOS_REALES_HABILITADOS: SiiModule[] = RECURSOS_API_GATEWAY.filter(
  (r) => r.documented && r.enabled,
).map((r) => r.module);

// ---------------------------------------------------------------------------
// Archivos individuales de documentos tributarios (Portal MIPYME)
// ---------------------------------------------------------------------------

/**
 * Todas estas rutas aparecen literalmente en el esquema oficial, junto con su
 * costo declarado (`x-credits`). No hay rutas inferidas.
 */
export interface DteResourceDefinition {
  module: DteFileModule;
  method: "POST";
  path: string;
  documented: boolean;
  enabled: boolean;
  /** Costo por consulta declarado por el proveedor (`x-credits`). */
  estimatedCredits: number;
  nota: string;
}

export const RECURSOS_DTE: Record<DteFileModule, DteResourceDefinition> = {
  dte_pdf_issued: {
    module: "dte_pdf_issued",
    method: "POST",
    path: "sii/mipyme/emitidos/pdf/{emisor}/{dte}/{folio}",
    documented: true,
    enabled: true,
    estimatedCredits: 0.01,
    nota: "PDF de un documento emitido en el Portal MIPYME.",
  },
  dte_xml_issued: {
    module: "dte_xml_issued",
    method: "POST",
    path: "sii/mipyme/emitidos/xml/{emisor}/{dte}/{folio}",
    documented: true,
    enabled: true,
    estimatedCredits: 0.005,
    nota: "XML de un documento emitido en el Portal MIPYME.",
  },
  dte_pdf_received: {
    module: "dte_pdf_received",
    method: "POST",
    path: "sii/mipyme/recibidos/pdf/{receptor}/{emisor}/{dte}/{folio}",
    documented: true,
    enabled: true,
    estimatedCredits: 0.01,
    nota: "PDF de un documento recibido en el Portal MIPYME.",
  },
  dte_xml_received: {
    module: "dte_xml_received",
    method: "POST",
    path: "sii/mipyme/recibidos/xml/{receptor}/{emisor}/{dte}/{folio}",
    documented: true,
    enabled: true,
    estimatedCredits: 0.005,
    nota: "XML de un documento recibido en el Portal MIPYME.",
  },
};

export function moduloArchivoDte(
  direccion: "sale" | "purchase",
  tipoArchivo: "pdf" | "xml",
): DteFileModule {
  if (direccion === "sale")
    return tipoArchivo === "pdf" ? "dte_pdf_issued" : "dte_xml_issued";
  return tipoArchivo === "pdf" ? "dte_pdf_received" : "dte_xml_received";
}

/**
 * Construye la ruta concreta del archivo. La empresa siempre es el emisor en
 * los documentos de venta y el receptor en los de compra.
 */
export function rutaRecursoDte(entrada: {
  modulo: DteFileModule;
  rutEmpresa: string;
  rutContraparte: string;
  dteCode: number;
  folio: number;
  fechaEmision?: string | null;
}): string {
  const recurso = RECURSOS_DTE[entrada.modulo];
  const esVenta = entrada.modulo.endsWith("_issued");
  let ruta = recurso.path
    .replace("{emisor}", esVenta ? entrada.rutEmpresa : entrada.rutContraparte)
    .replace("{receptor}", entrada.rutEmpresa)
    .replace("{dte}", String(entrada.dteCode))
    .replace("{folio}", String(entrada.folio));

  const consulta = new URLSearchParams();
  // Parámetros de consulta documentados en el esquema oficial.
  if (entrada.modulo === "dte_pdf_issued") consulta.set("folio", String(entrada.folio));
  if (entrada.modulo.startsWith("dte_xml") && entrada.fechaEmision)
    consulta.set("fecha_emision", entrada.fechaEmision);

  const cadena = consulta.toString();
  if (cadena) ruta = `${ruta}?${cadena}`;
  return ruta;
}

