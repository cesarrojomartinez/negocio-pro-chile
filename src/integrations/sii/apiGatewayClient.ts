/**
 * Cliente HTTP de API Gateway V2.
 *
 * Se ejecuta únicamente en el servidor. El token vive en el secreto
 * `APIGATEWAY_TOKEN` y jamás sale de aquí: no se registra, no se devuelve y no
 * se guarda. Los cuerpos de autenticación (RUT + Clave Tributaria) tampoco se
 * registran nunca.
 *
 * Comportamiento observado en producción (30-07-2026) con un token válido sin
 * productos contratados:
 *   HTTP 403 {"status":"403","code":"error","detail":"La conexión no tiene productos asociados."}
 *   cabeceras: x-stats-credits-used, x-stats-credits-remaining, x-source-proxy,
 *              x-ratelimit-limit, x-ratelimit-remaining
 */
import {
  ERRORES_REINTENTABLES,
  SiiProviderError,
  type SiiErrorCode,
  type SiiModule,
} from "./contracts";
import { sanitizarProfundo } from "./sanitize";

export const BASE_URL_POR_DEFECTO = "https://app.apigateway.cl/api/v2/";
export const TIEMPO_MAXIMO_MS = 45_000;
export const MAX_REAL_PROVIDER_REQUESTS_PER_SYNC = 24;
/** Prueba controlada: como máximo un reintento automático. */
const MAX_REINTENTOS = 1;


export interface ApiGatewayConfig {
  baseUrl: string;
  token: string;
  timeoutMs: number;
}

export interface ApiGatewayCallLog {
  modulo: SiiModule | "diagnostico" | "autenticacion";
  metodo: string;
  recurso: string;
  estadoHttp: number | null;
  /** Tipo de contenido devuelto, sin parámetros. Nunca sensible. */
  contentType: string | null;
  duracionMs: number;
  creditosUsados: number | null;
  creditosDisponibles: number | null;
  proxyUsado: boolean | null;
  limiteRestante: number | null;
  codigoError: SiiErrorCode | null;
  referenciaTecnica: string | null;
}


/** Acumulador de consumo de una sincronización. Nunca contiene credenciales. */
export class RegistroConsumo {
  readonly llamadas: ApiGatewayCallLog[] = [];
  readonly limite: number;

  constructor(limite: number = MAX_REAL_PROVIDER_REQUESTS_PER_SYNC) {
    this.limite = limite;
  }

  get consultas(): number {
    return this.llamadas.length;
  }

  get creditosUsados(): number {
    return this.llamadas.reduce((s, l) => s + (l.creditosUsados ?? 0), 0);
  }

  get creditosDisponibles(): number | null {
    for (let i = this.llamadas.length - 1; i >= 0; i -= 1) {
      const v = this.llamadas[i].creditosDisponibles;
      if (v != null) return v;
    }
    return null;
  }

  get proxyUsado(): boolean | null {
    return this.llamadas.some((l) => l.proxyUsado) ? true : this.llamadas.length ? false : null;
  }

  agregar(log: ApiGatewayCallLog) {
    this.llamadas.push(log);
  }

  /** Corta la operación antes de seguir consumiendo créditos. */
  exigirPresupuesto(modulo: SiiModule | null) {
    if (this.consultas >= this.limite)
      throw new SiiProviderError("REQUEST_BUDGET_REACHED", modulo);
  }
}

function numeroCabecera(headers: Headers, nombre: string): number | null {
  const v = headers.get(nombre);
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Traduce una respuesta real de API Gateway a un código interno.
 *
 * Regla clave: un HTTP 400 NO es automáticamente `MALFORMED_RESPONSE`. Se
 * clasifica según el contenido sanitizado de la respuesta; solo un cuerpo que
 * no es JSON (HTML del portal, por ejemplo) se considera realmente inesperado.
 */
export function mapearError(
  estado: number,
  detalle: string,
  esJson: boolean,
): SiiErrorCode {
  const texto = detalle.toLowerCase();

  if (!esJson && estado >= 200 && estado < 300) return "INVALID_PROVIDER_RESPONSE";
  // Una respuesta no JSON con 404 es la página web del proveedor: la ruta
  // solicitada no existe en la versión V2 del servicio.
  if (!esJson && estado === 404) return "RESOURCE_NOT_DOCUMENTED";
  // Contenido realmente inesperado (HTML u otro formato) en un error.
  if (!esJson) return "MALFORMED_RESPONSE";

  if (texto.includes("productos asociados") || texto.includes("no tiene producto"))
    return "PRODUCT_NOT_ENABLED";
  if (texto.includes("crédito") || texto.includes("credito") || texto.includes("saldo"))
    return "INSUFFICIENT_CREDITS";
  if (texto.includes("proxy") && texto.includes("no disponible")) return "PROXY_UNAVAILABLE";
  if (texto.includes("proxy")) return "PROXY_REQUIRED";
  if (texto.includes("bloquead")) return "ACCOUNT_BLOCKED";
  // El usuario autenticado no puede representar a la empresa consultada.
  if (
    texto.includes("no tiene acceso") ||
    texto.includes("sin acceso a la empresa") ||
    texto.includes("no está autorizado a representar") ||
    texto.includes("no esta autorizado a representar") ||
    texto.includes("no representa")
  )
    return "COMPANY_ACCESS_DENIED";
  // Periodo contratado pero sin información publicada por el SII.
  if (
    texto.includes("sin movimiento") ||
    texto.includes("sin informacion") ||
    texto.includes("sin información") ||
    texto.includes("no hay datos") ||
    texto.includes("no existen documentos") ||
    texto.includes("no registra información") ||
    texto.includes("no registra informacion")
  )
    return "PERIOD_NOT_AVAILABLE";
  // El proveedor no logró completar la lectura en el portal del SII.
  if (
    texto.includes("no se pudo cargar la página") ||
    texto.includes("no se pudo cargar la pagina") ||
    texto.includes("wait_for_selector") ||
    texto.includes("timeout")
  )
    return "TIMEOUT";
  // El SII devolvió un código de error oficial durante la autenticación.
  if (/c[óo]digo de error #\d+/.test(texto) || /error #\d+/.test(texto))
    return "INVALID_CREDENTIALS";

  if (
    texto.includes("clave") ||
    texto.includes("contraseña") ||
    texto.includes("credenciales") ||
    texto.includes("rut o clave") ||
    texto.includes("autenticacion") ||
    texto.includes("autenticación")
  )
    return "INVALID_CREDENTIALS";
  if (texto.includes("mantencion") || texto.includes("mantención") || texto.includes("mantenimiento"))
    return texto.includes("sii") ? "SII_MAINTENANCE" : "PROVIDER_MAINTENANCE";
  if (texto.includes("sesion") || texto.includes("sesión")) return "SESSION_EXPIRED";
  // Validación de esquema del proveedor: falta o sobra un campo del cuerpo.
  if (
    texto.includes("campo") ||
    texto.includes("field") ||
    texto.includes("requerid") ||
    texto.includes("required") ||
    texto.includes("inválid") ||
    texto.includes("invalid") ||
    texto.includes("formato")
  )
    return "INVALID_REQUEST";

  switch (estado) {
    case 400:
      // JSON de error válido del proveedor sin pista de credenciales:
      // el cuerpo o un campo requerido es inválido.
      return "INVALID_REQUEST";
    case 401:
      return "INVALID_CREDENTIALS";
    case 402:
      return "INSUFFICIENT_CREDITS";
    case 403:
      return "NOT_AUTHORIZED";
    case 404:
      return "PERIOD_NOT_AVAILABLE";
    case 408:
      return "TIMEOUT";
    case 429:
      return "RATE_LIMITED";
    case 502:
    case 503:
    case 504:
      return "PROVIDER_UNAVAILABLE";
    default:
      return estado >= 500 ? "PROVIDER_UNAVAILABLE" : "UNKNOWN_ERROR";
  }
}

/**
 * Únicos casos que se reintentan: problemas transitorios. Todo lo demás
 * (400, credenciales, request inválido, acceso denegado, producto no
 * habilitado) se devuelve de inmediato para no gastar créditos.
 */
export function esReintentable(codigo: SiiErrorCode, estado: number | null): boolean {
  if (estado === 400) return false;
  return ERRORES_REINTENTABLES.includes(codigo);
}

/** Espera indicada por el proveedor en `Retry-After`, acotada a 10 segundos. */
function esperaRetryAfter(headers: Headers): number | null {
  const v = headers.get("retry-after");
  if (!v) return null;
  const segundos = Number(v);
  if (!Number.isFinite(segundos)) return null;
  return Math.min(Math.max(segundos, 0), 10) * 1000;
}


export interface ApiGatewayRequestInput<TRequest extends object> {
  config: ApiGatewayConfig;
  modulo: SiiModule | "diagnostico" | "autenticacion";
  metodo: "GET" | "POST";
  /** Ruta ya resuelta, relativa a la base. Nunca debe contener credenciales. */
  ruta: string;
  query?: Record<string, string>;
  body?: TRequest;
  registro?: RegistroConsumo;
  /** Auditorías controladas: una sola solicitud, sin reintentos automáticos. */
  sinReintentos?: boolean;
}


export interface ApiGatewayRespuesta<TResponse> {
  datos: TResponse;
  log: ApiGatewayCallLog;
}

export function construirUrl(
  baseUrl: string,
  ruta: string,
  query?: Record<string, string>,
): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(ruta.replace(/^\//, ""), base);
  if (url.protocol !== "https:")
    throw new SiiProviderError("PROVIDER_NOT_CONFIGURED", null);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

/**
 * Llamada genérica y tipada. Aplica timeout, reintentos acotados, lectura de
 * consumo y normalización de errores.
 */
export async function requestApiGateway<TRequest extends object, TResponse>(
  input: ApiGatewayRequestInput<TRequest>,
): Promise<ApiGatewayRespuesta<TResponse>> {
  const moduloError = typeof input.modulo === "string" && input.modulo.startsWith("rcv")
    ? (input.modulo as SiiModule)
    : null;

  input.registro?.exigirPresupuesto(moduloError);

  const url = construirUrl(input.config.baseUrl, input.ruta, input.query);
  const maxIntentos = input.sinReintentos ? 0 : MAX_REINTENTOS;
  let ultimoError: SiiProviderError | null = null;

  for (let intento = 0; intento <= maxIntentos; intento += 1) {
    const inicio = Date.now();
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), input.config.timeoutMs);

    let estadoHttp: number | null = null;
    let log: ApiGatewayCallLog = {
      modulo: input.modulo,
      metodo: input.metodo,
      recurso: input.ruta,
      estadoHttp: null,
      contentType: null,
      duracionMs: 0,
      creditosUsados: null,
      creditosDisponibles: null,
      proxyUsado: null,
      limiteRestante: null,
      codigoError: null,
      referenciaTecnica: null,
    };


    try {
      const respuesta = await fetch(url, {
        method: input.metodo,
        headers: {
          // El token nunca se registra ni se devuelve.
          Authorization: `Token ${input.config.token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: input.body ? JSON.stringify(input.body) : undefined,
        signal: controlador.signal,
      });
      estadoHttp = respuesta.status;

      const proxy = respuesta.headers.get("x-source-proxy");
      log = {
        ...log,
        estadoHttp,
        contentType: respuesta.headers.get("content-type")?.split(";")[0] ?? null,

        duracionMs: Date.now() - inicio,
        creditosUsados: numeroCabecera(respuesta.headers, "x-stats-credits-used"),
        creditosDisponibles: numeroCabecera(
          respuesta.headers,
          "x-stats-credits-remaining",
        ),
        proxyUsado: proxy == null ? null : proxy !== "0",
        limiteRestante: numeroCabecera(respuesta.headers, "x-ratelimit-remaining"),
      };

      const texto = await respuesta.text();
      let cuerpo: unknown = null;
      let esJson = true;
      try {
        cuerpo = texto ? JSON.parse(texto) : null;
      } catch {
        esJson = false;
      }

      if (!respuesta.ok || !esJson) {
        const detalle =
          esJson && cuerpo && typeof cuerpo === "object"
            ? String(
                (cuerpo as { detail?: unknown; message?: unknown }).detail ??
                  (cuerpo as { message?: unknown }).message ??
                  "",
              )
            : "";
        const codigo = mapearError(respuesta.status, detalle, esJson);
        log = {
          ...log,
          codigoError: codigo,
          // Referencia técnica no sensible: módulo, estado HTTP, tipo de
          // contenido y código normalizado. Nunca incluye el cuerpo enviado.
          referenciaTecnica: `${input.modulo}:${respuesta.status}:${
            respuesta.headers.get("content-type")?.split(";")[0] ?? "sin-tipo"
          }:${codigo}`,
        };
        input.registro?.agregar(log);
        const error = new SiiProviderError(codigo, moduloError);
        if (!esReintentable(codigo, respuesta.status) || intento === maxIntentos)
          throw error;
        ultimoError = error;
        await new Promise((r) =>
          setTimeout(r, esperaRetryAfter(respuesta.headers) ?? 800 * (intento + 1)),
        );
        continue;

      }

      input.registro?.agregar(log);
      return { datos: cuerpo as TResponse, log };
    } catch (error) {
      if (error instanceof SiiProviderError) throw error;
      const esTimeout =
        error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
      const codigo: SiiErrorCode = esTimeout ? "TIMEOUT" : "PROVIDER_UNAVAILABLE";
      log = {
        ...log,
        estadoHttp,
        duracionMs: Date.now() - inicio,
        codigoError: codigo,
        referenciaTecnica: `${input.modulo}:red:${codigo}`,
      };
      input.registro?.agregar(log);
      const normalizado = new SiiProviderError(codigo, moduloError);
      if (intento === maxIntentos) throw normalizado;
      ultimoError = normalizado;
      await new Promise((r) => setTimeout(r, 800 * (intento + 1)));
    } finally {
      clearTimeout(temporizador);
    }
  }

  throw ultimoError ?? new SiiProviderError("UNKNOWN_ERROR", moduloError);
}

/** Respaldo seguro: cuerpo de respuesta sin credenciales ni cabeceras. */
export function respaldoSeguro(payload: unknown): unknown {
  return sanitizarProfundo(payload);
}
