/**
 * Descarga binaria desde API Gateway (PDF del Formulario 29).
 *
 * Se ejecuta solo en el servidor. El token y la Clave Tributaria nunca se
 * registran, y el contenido del archivo jamás se escribe en logs ni snapshots:
 * de la respuesta solo se conservan metadatos técnicos.
 */
import {
  mapearError,
  type ApiGatewayCallLog,
  type ApiGatewayConfig,
} from "./apiGatewayClient";
import { SiiProviderError, type SiiModule } from "./contracts";

export interface RespuestaBinaria {
  bytes: Uint8Array;
  contentType: string | null;
  log: ApiGatewayCallLog;
}

/** Una sola solicitud, sin reintentos automáticos: cada intento cuesta créditos. */
export async function requestApiGatewayBinary<TRequest extends object>(entrada: {
  config: ApiGatewayConfig;
  modulo: SiiModule;
  ruta: string;
  body: TRequest;
  registro?: { agregar: (log: ApiGatewayCallLog) => void; exigirPresupuesto: (m: SiiModule | null) => void };
  sinCacheAuth?: boolean;
}): Promise<RespuestaBinaria> {
  entrada.registro?.exigirPresupuesto(entrada.modulo);

  const base = entrada.config.baseUrl.endsWith("/")
    ? entrada.config.baseUrl
    : `${entrada.config.baseUrl}/`;
  const url = new URL(entrada.ruta.replace(/^\//, ""), base);
  if (url.protocol !== "https:") throw new SiiProviderError("PROVIDER_NOT_CONFIGURED", null);
  if (entrada.sinCacheAuth) url.searchParams.set("auth_cache", "0");

  const inicio = Date.now();
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), entrada.config.timeoutMs);

  let log: ApiGatewayCallLog = {
    modulo: entrada.modulo,
    metodo: "POST",
    recurso: entrada.ruta,
    estadoHttp: null,
    contentType: null,
    duracionMs: 0,
    creditosUsados: null,
    creditosDisponibles: null,
    proxyUsado: null,
    limiteRestante: null,
    codigoError: null,
    referenciaTecnica: null,
    problemaSesion: null,
    sinCacheAuth: entrada.sinCacheAuth === true,
  };

  try {
    const respuesta = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Token ${entrada.config.token}`,
        Accept: "application/pdf, application/json;q=0.9, */*;q=0.8",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entrada.body),
      signal: controlador.signal,
    });

    const numero = (nombre: string) => {
      const v = respuesta.headers.get(nombre);
      const n = v == null || v === "" ? NaN : Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const proxy = respuesta.headers.get("x-source-proxy");
    const contentType = respuesta.headers.get("content-type")?.split(";")[0] ?? null;
    const problemaSesion =
      respuesta.headers.get("x-stats-navegadorsessionproblem") === "1" ||
      respuesta.headers.get("x-auth-session-problem") === "1";

    log = {
      ...log,
      estadoHttp: respuesta.status,
      contentType,
      duracionMs: Date.now() - inicio,
      creditosUsados: numero("x-stats-credits-used"),
      creditosDisponibles: numero("x-stats-credits-remaining"),
      proxyUsado: proxy == null ? null : proxy !== "0",
      limiteRestante: numero("x-ratelimit-remaining"),
      problemaSesion,
    };

    const buffer = new Uint8Array(await respuesta.arrayBuffer());

    if (!respuesta.ok) {
      // Solo se lee el texto para clasificar el error; nunca se guarda.
      let detalle = "";
      try {
        const texto = new TextDecoder().decode(buffer).slice(0, 2000);
        const json = JSON.parse(texto) as { detail?: unknown; message?: unknown };
        detalle = String(json.detail ?? json.message ?? "");
      } catch {
        detalle = "";
      }
      const codigo = mapearError(respuesta.status, detalle, detalle !== "", problemaSesion);
      log = {
        ...log,
        codigoError: codigo,
        referenciaTecnica: `${entrada.modulo}:${respuesta.status}:${contentType ?? "sin-tipo"}:${codigo}`,
      };
      entrada.registro?.agregar(log);
      throw new SiiProviderError(codigo, entrada.modulo);
    }

    entrada.registro?.agregar(log);
    return { bytes: buffer, contentType, log };
  } catch (error) {
    if (error instanceof SiiProviderError) throw error;
    const esTimeout =
      error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
    const codigo = esTimeout ? "TIMEOUT" : "PROVIDER_UNAVAILABLE";
    log = { ...log, duracionMs: Date.now() - inicio, codigoError: codigo, referenciaTecnica: `${entrada.modulo}:red:${codigo}` };
    entrada.registro?.agregar(log);
    throw new SiiProviderError(codigo, entrada.modulo);
  } finally {
    clearTimeout(temporizador);
  }
}
