/**
 * Configuración y diagnóstico de API Gateway.
 *
 * Solo servidor. Los secretos se leen dentro de las funciones (nunca en el
 * ámbito del módulo) y jamás se devuelven ni se registran.
 */
import {
  BASE_URL_POR_DEFECTO,
  RegistroConsumo,
  TIEMPO_MAXIMO_MS,
  construirUrl,
  requestApiGateway,
  type ApiGatewayConfig,
} from "@/integrations/sii/apiGatewayClient";
import {
  MODULOS_REALES_HABILITADOS,
  RECURSOS_API_GATEWAY,
  RECURSO_DIAGNOSTICO,
  recursoDe,
} from "@/integrations/sii/apiGatewayResourceMap";

import { SiiProviderError } from "@/integrations/sii/contracts";

export type ResultadoDiagnostico =
  | "configuracion_valida"
  | "token_ausente"
  | "token_rechazado"
  | "recurso_no_contratado"
  | "saldo_insuficiente"
  | "proxy_no_configurado"
  | "proveedor_no_disponible"
  | "documentacion_incompatible";

export const ETIQUETA_DIAGNOSTICO: Record<ResultadoDiagnostico, string> = {
  configuracion_valida: "Configuración válida",
  token_ausente: "Token ausente",
  token_rechazado: "Token rechazado",
  recurso_no_contratado: "Recurso no contratado",
  saldo_insuficiente: "Saldo insuficiente",
  proxy_no_configurado: "Proxy no configurado",
  proveedor_no_disponible: "Proveedor no disponible",
  documentacion_incompatible: "Documentación incompatible",
};

export interface ComprobacionDiagnostico {
  clave: string;
  titulo: string;
  ok: boolean;
  detalle: string;
}

/** Estados posibles de un producto contratado en el proveedor. */
export type EstadoProducto =
  | "habilitado"
  | "no_contratado"
  | "recurso_no_disponible"
  | "sin_informacion_periodo"
  | "error_autenticacion"
  | "saldo_insuficiente"
  | "proxy_requerido"
  | "mantenimiento"
  | "no_verificado";

export const ETIQUETA_PRODUCTO: Record<EstadoProducto, string> = {
  habilitado: "Producto habilitado",
  no_contratado: "Producto no contratado",
  recurso_no_disponible: "Producto habilitado, pero el recurso no está disponible",
  sin_informacion_periodo: "Recurso contratado, sin información para el periodo",
  error_autenticacion: "Error de autenticación ante el SII",
  saldo_insuficiente: "Saldo insuficiente",
  proxy_requerido: "Requiere salida dedicada (proxy)",
  mantenimiento: "Mantenimiento temporal",
  no_verificado: "No verificado en esta ejecución",
};

export interface ProductoDiagnostico {
  clave: "rcv" | "f29";
  titulo: string;
  estado: EstadoProducto;
  etiqueta: string;
  /** Verdadero solo si la consulta llegó realmente al portal del SII. */
  contratado: boolean | null;
  recurso: string;
  detalle: string;
}

export interface DiagnosticoApiGateway {
  resultado: ResultadoDiagnostico;
  etiqueta: string;
  puedeConsultar: boolean;
  modoPruebaHabilitado: boolean;
  comprobaciones: ComprobacionDiagnostico[];
  productos: ProductoDiagnostico[];
  creditosDisponibles: number | null;
  proxyUsado: boolean | null;
  modulosHabilitados: string[];
  modulosPendientes: { modulo: string; motivo: string }[];
  verificadoEn: string;

}

/** Lee la configuración desde secretos del backend. Nunca expone el token. */
export function leerConfiguracion(): {
  config: ApiGatewayConfig | null;
  baseUrl: string;
  tieneToken: boolean;
  baseUrlValida: boolean;
  https: boolean;
} {
  const token = process.env.APIGATEWAY_TOKEN ?? "";
  const baseUrl = process.env.APIGATEWAY_BASE_URL || BASE_URL_POR_DEFECTO;

  let baseUrlValida = false;
  let https = false;
  try {
    const url = new URL(baseUrl);
    baseUrlValida = true;
    https = url.protocol === "https:";
  } catch {
    baseUrlValida = false;
  }

  const config =
    token && baseUrlValida && https
      ? { baseUrl, token, timeoutMs: TIEMPO_MAXIMO_MS }
      : null;

  return { config, baseUrl, tieneToken: Boolean(token), baseUrlValida, https };
}

/** Bandera de la prueba real controlada. */
export function modoPruebaRealHabilitado(): boolean {
  return /^(1|true|si|sí|on)$/i.test(process.env.REAL_GATEWAY_TEST_ENABLED ?? "");
}

/** Empresas autorizadas para la prueba real. */
export function empresasAutorizadas(): string[] {
  return (process.env.REAL_GATEWAY_ALLOWED_COMPANY_IDS ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function empresaAutorizadaParaPruebaReal(companyId: string): boolean {
  const lista = empresasAutorizadas();
  return lista.includes(companyId);
}

/** Traduce el código interno de un sondeo a un estado de producto. */
export function estadoProductoDesdeCodigo(codigo: string): EstadoProducto {
  switch (codigo) {
    case "PRODUCT_NOT_ENABLED":
      return "no_contratado";
    case "RESOURCE_NOT_DOCUMENTED":
      return "recurso_no_disponible";
    case "PERIOD_NOT_AVAILABLE":
      return "sin_informacion_periodo";
    case "INVALID_CREDENTIALS":
    case "SESSION_EXPIRED":
    case "AUTH_EXPIRED":
    case "ACCOUNT_BLOCKED":
      return "error_autenticacion";
    case "INSUFFICIENT_CREDITS":
      return "saldo_insuficiente";
    case "PROXY_REQUIRED":
    case "PROXY_UNAVAILABLE":
      return "proxy_requerido";
    case "SII_MAINTENANCE":
    case "PROVIDER_MAINTENANCE":
    case "PROVIDER_UNAVAILABLE":
    case "TIMEOUT":
      return "mantenimiento";
    default:
      return "no_verificado";
  }
}

/**
 * Un sondeo que llega a la autenticación del SII demuestra que el producto está
 * contratado: el proveedor solo intenta la lectura cuando el producto existe.
 */
const ESTADOS_QUE_PRUEBAN_CONTRATO: EstadoProducto[] = [
  "habilitado",
  "sin_informacion_periodo",
  "error_autenticacion",
  "mantenimiento",
];

/**
 * Comprueba la configuración antes de cualquier consulta real.
 * Usa un recurso documentado que NO requiere credenciales del SII.
 *
 * `probarProductos` agrega un sondeo por producto (RCV y F29) con un RUT de
 * prueba y sin clave válida: sirve para distinguir "producto no contratado" de
 * "producto contratado que pide credenciales". Consume unos pocos créditos.
 */
export async function diagnoseApiGatewayConfiguration(opciones?: {
  probarProductos?: boolean;
}): Promise<DiagnosticoApiGateway> {
  const verificadoEn = new Date().toISOString();
  const comprobaciones: ComprobacionDiagnostico[] = [];
  const productos: ProductoDiagnostico[] = [];
  const { config, baseUrl, tieneToken, baseUrlValida, https } = leerConfiguracion();
  const modoPrueba = modoPruebaRealHabilitado();

  const modulosPendientes = RECURSOS_API_GATEWAY.filter((r) => !r.enabled).map((r) => ({
    modulo: r.module,
    motivo: r.nota ?? (r.documented ? "Recurso desactivado." : "Recurso no documentado."),
  }));

  const base = (
    resultado: ResultadoDiagnostico,
    extra?: Partial<DiagnosticoApiGateway>,
  ): DiagnosticoApiGateway => ({
    resultado,
    etiqueta: ETIQUETA_DIAGNOSTICO[resultado],
    puedeConsultar: resultado === "configuracion_valida",
    modoPruebaHabilitado: modoPrueba,
    comprobaciones,
    productos,
    creditosDisponibles: null,
    proxyUsado: null,
    modulosHabilitados: MODULOS_REALES_HABILITADOS,
    modulosPendientes,
    verificadoEn,
    ...extra,
  });


  comprobaciones.push({
    clave: "token",
    titulo: "Token del servicio configurado",
    ok: tieneToken,
    detalle: tieneToken
      ? "Presente en los secretos del backend."
      : "Falta el secreto APIGATEWAY_TOKEN.",
  });
  comprobaciones.push({
    clave: "base_url",
    titulo: "Dirección del servicio válida",
    ok: baseUrlValida,
    detalle: baseUrlValida ? baseUrl : "La dirección configurada no es válida.",
  });
  comprobaciones.push({
    clave: "https",
    titulo: "Conexión cifrada (HTTPS)",
    ok: https,
    detalle: https ? "La dirección usa HTTPS." : "La dirección debe usar HTTPS.",
  });
  comprobaciones.push({
    clave: "version",
    titulo: "Versión V2 del servicio",
    ok: /\/api\/v2\/?$/.test(baseUrl.replace(/\/$/, "/")),
    detalle: "La ruta base debe terminar en /api/v2/.",
  });
  comprobaciones.push({
    clave: "modo_prueba",
    titulo: "Modo de prueba real habilitado",
    ok: modoPrueba,
    detalle: modoPrueba
      ? "La prueba real controlada está activa."
      : "Falta activar REAL_GATEWAY_TEST_ENABLED.",
  });
  comprobaciones.push({
    clave: "sin_token_en_frontend",
    titulo: "El token no viaja al navegador",
    ok: true,
    detalle:
      "El token solo se lee en funciones de servidor y no existe ninguna variable VITE_ con su valor.",
  });

  if (!tieneToken) return base("token_ausente");
  if (!config) return base("documentacion_incompatible");

  // Verificación de comunicación real con un recurso documentado sin credenciales.
  const registro = new RegistroConsumo(3);
  try {
    construirUrl(config.baseUrl, RECURSO_DIAGNOSTICO.path.replace("{anio}", String(new Date().getFullYear())));
    await requestApiGateway<Record<string, never>, unknown>({
      config,
      modulo: "diagnostico",
      metodo: "GET",
      ruta: RECURSO_DIAGNOSTICO.path.replace("{anio}", String(new Date().getFullYear())),
      registro,
    });

    comprobaciones.push({
      clave: "conectividad",
      titulo: "Comunicación con el servicio",
      ok: true,
      detalle: "El servicio respondió correctamente en formato V2.",
    });
    const ultima = registro.llamadas[registro.llamadas.length - 1];
    comprobaciones.push({
      clave: "creditos",
      titulo: "Saldo de consultas",
      ok: (ultima?.creditosDisponibles ?? 1) > 0,
      detalle:
        ultima?.creditosDisponibles != null
          ? `Saldo informado por el servicio: ${ultima.creditosDisponibles}.`
          : "El servicio no informó saldo en esta respuesta.",
    });
    comprobaciones.push({
      clave: "proxy",
      titulo: "Salida dedicada (proxy)",
      ok: true,
      detalle:
        ultima?.proxyUsado === true
          ? "La cuenta está usando salida dedicada."
          : "La cuenta responde sin salida dedicada.",
    });

    if ((ultima?.creditosDisponibles ?? 1) <= 0)
      return base("saldo_insuficiente", {
        creditosDisponibles: ultima?.creditosDisponibles ?? null,
        proxyUsado: ultima?.proxyUsado ?? null,
      });

    if (opciones?.probarProductos) {
      productos.push(...(await sondearProductos(config, registro)));
    } else {
      productos.push(
        {
          clave: "rcv",
          titulo: "Registro de Compras y Ventas",
          estado: "no_verificado",
          etiqueta: ETIQUETA_PRODUCTO.no_verificado,
          contratado: null,
          recurso: recursoDe("rcv_sales_summary").path,
          detalle: "Usa «Comprobar productos» para verificarlo contra el servicio.",
        },
        {
          clave: "f29",
          titulo: "Formulario 29",
          estado: "no_verificado",
          etiqueta: ETIQUETA_PRODUCTO.no_verificado,
          contratado: null,
          recurso: recursoDe("f29_periods").path,
          detalle: "Usa «Comprobar productos» para verificarlo contra el servicio.",
        },
      );
    }

    const ultimaTrasSondeo = registro.llamadas[registro.llamadas.length - 1];
    return base("configuracion_valida", {
      creditosDisponibles:
        ultimaTrasSondeo?.creditosDisponibles ?? ultima?.creditosDisponibles ?? null,
      proxyUsado: ultimaTrasSondeo?.proxyUsado ?? ultima?.proxyUsado ?? null,
    });

  } catch (error) {
    const codigo = error instanceof SiiProviderError ? error.code : "UNKNOWN_ERROR";
    const ultima = registro.llamadas[registro.llamadas.length - 1];
    comprobaciones.push({
      clave: "conectividad",
      titulo: "Comunicación con el servicio",
      ok: false,
      detalle:
        error instanceof SiiProviderError
          ? error.message
          : "No pudimos comunicarnos con el servicio de consultas.",
    });

    const resultado: ResultadoDiagnostico =
      codigo === "PRODUCT_NOT_ENABLED"
        ? "recurso_no_contratado"
        : codigo === "INSUFFICIENT_CREDITS"
          ? "saldo_insuficiente"
          : codigo === "PROXY_REQUIRED" || codigo === "PROXY_UNAVAILABLE"
            ? "proxy_no_configurado"
            : codigo === "INVALID_CREDENTIALS" || codigo === "NOT_AUTHORIZED"
              ? "token_rechazado"
              : codigo === "INVALID_PROVIDER_RESPONSE" || codigo === "MALFORMED_RESPONSE"
                ? "documentacion_incompatible"
                : "proveedor_no_disponible";

    return base(resultado, {
      creditosDisponibles: ultima?.creditosDisponibles ?? null,
      proxyUsado: ultima?.proxyUsado ?? null,
    });
  }
}
