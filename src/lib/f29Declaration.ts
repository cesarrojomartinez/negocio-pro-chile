/**
 * Selección de la declaración F29 vigente y decodificación del PDF recibido.
 *
 * Módulo PURO: no hace red ni base de datos. Todo lo que decide se puede
 * probar con fixtures sintéticos.
 */

export interface DeclaracionListada {
  folio: string;
  periodo: string | null;
  fecha: string | null;
  estado: string | null;
  esRectificatoria: boolean;
  vigente: boolean | null;
  crudo: Record<string, unknown>;
}

export type EstadoSeleccion = "unica" | "vigente" | "ambiguous";

export interface SeleccionDeclaracion {
  estado: EstadoSeleccion;
  seleccionada: DeclaracionListada | null;
  candidatas: DeclaracionListada[];
  motivo: string;
}

function texto(valor: unknown): string | null {
  if (valor == null) return null;
  const s = String(valor).trim();
  return s === "" ? null : s;
}

function normalizarPeriodo(valor: unknown): string | null {
  const s = texto(valor);
  if (!s) return null;
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{6}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4)}`;
  return s;
}

const ESTADOS_VIGENTES = ["vigente", "aceptad", "presentad", "activa", "activo"];
const ESTADOS_NO_VIGENTES = ["anulad", "rectificad", "reemplazad", "no vigente", "observ"];

function sinTildes(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Convierte una fila cruda del listado en una declaración tipada. */
export function interpretarDeclaracion(fila: Record<string, unknown>): DeclaracionListada | null {
  const folio = texto(fila.folio ?? fila.Folio ?? fila.folioDeclaracion);
  if (!folio) return null;
  const estado = texto(fila.estado ?? fila.Estado ?? fila.situacion);
  const estadoPlano = estado ? sinTildes(estado) : "";
  const tipo = sinTildes(texto(fila.tipo ?? fila.tipoDeclaracion ?? "") ?? "");

  const esRectificatoria =
    /rectific/.test(estadoPlano) ||
    /rectific/.test(tipo) ||
    fila.rectificatoria === true ||
    fila.esRectificatoria === true;

  let vigente: boolean | null = null;
  if (fila.vigente === true || fila.esVigente === true) vigente = true;
  else if (fila.vigente === false || fila.esVigente === false) vigente = false;
  else if (ESTADOS_NO_VIGENTES.some((e) => estadoPlano.includes(e)) && !/rectificatoria vigente/.test(estadoPlano))
    vigente = false;
  else if (ESTADOS_VIGENTES.some((e) => estadoPlano.includes(e))) vigente = true;

  return {
    folio,
    periodo: normalizarPeriodo(fila.periodo ?? fila.Periodo),
    fecha: texto(fila.fecha ?? fila.Fecha ?? fila.fechaPresentacion),
    estado,
    esRectificatoria,
    vigente,
    crudo: fila,
  };
}

/** Extrae la lista de declaraciones desde cualquier envoltura del proveedor. */
export function listarDeclaraciones(payload: unknown): DeclaracionListada[] {
  const lista = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown })?.data)
      ? ((payload as { data: unknown[] }).data)
      : Array.isArray((payload as { resultado?: unknown })?.resultado)
        ? ((payload as { resultado: unknown[] }).resultado)
        : [];
  return lista
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map(interpretarDeclaracion)
    .filter((d): d is DeclaracionListada => d != null);
}

/**
 * Selecciona la declaración a descargar.
 * Nunca elige "el folio mayor": si no hay marca explícita de vigencia con más
 * de una declaración, el resultado es ambiguo y no se gasta una consulta.
 */
export function seleccionarDeclaracionVigente(
  declaraciones: DeclaracionListada[],
  periodo: string,
): SeleccionDeclaracion {
  const delPeriodo = declaraciones.filter((d) => d.periodo == null || d.periodo === periodo);

  if (delPeriodo.length === 0)
    return {
      estado: "ambiguous",
      seleccionada: null,
      candidatas: [],
      motivo: "El listado no trae declaraciones para este periodo.",
    };

  if (delPeriodo.length === 1)
    return {
      estado: "unica",
      seleccionada: delPeriodo[0],
      candidatas: delPeriodo,
      motivo: "Existe una sola declaración para el periodo.",
    };

  const vigentes = delPeriodo.filter((d) => d.vigente === true);
  if (vigentes.length === 1)
    return {
      estado: "vigente",
      seleccionada: vigentes[0],
      candidatas: delPeriodo,
      motivo: "Se seleccionó la declaración marcada explícitamente como vigente.",
    };

  return {
    estado: "ambiguous",
    seleccionada: null,
    candidatas: delPeriodo,
    motivo:
      vigentes.length > 1
        ? "Hay más de una declaración marcada como vigente."
        : "El listado no indica cuál declaración está vigente.",
  };
}

// ------------------------------------------------------------- decodificación

export type ResultadoDecodificacion =
  | { ok: true; bytes: Uint8Array; formato: "binario" | "base64" | "json_envuelto" }
  | { ok: false; error: "F29_INVALID_PDF"; detalle: string };

const FIRMA_PDF = "%PDF-";

function tieneFirmaPdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return String.fromCharCode(...bytes.slice(0, 5)) === FIRMA_PDF;
}

export function base64ABytes(base64: string): Uint8Array | null {
  const limpio = base64.replace(/^data:[^,]*,/, "").replace(/\s/g, "");
  if (!limpio || /[^A-Za-z0-9+/=]/.test(limpio)) return null;
  try {
    const binario = atob(limpio);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function buscarBase64EnObjeto(valor: unknown, profundidad = 0): Uint8Array | null {
  if (profundidad > 6) return null;
  if (typeof valor === "string") {
    const bytes = base64ABytes(valor);
    return bytes && tieneFirmaPdf(bytes) ? bytes : null;
  }
  if (Array.isArray(valor)) {
    for (const v of valor) {
      const r = buscarBase64EnObjeto(v, profundidad + 1);
      if (r) return r;
    }
    return null;
  }
  if (valor && typeof valor === "object") {
    for (const v of Object.values(valor as Record<string, unknown>)) {
      const r = buscarBase64EnObjeto(v, profundidad + 1);
      if (r) return r;
    }
  }
  return null;
}

/**
 * Acepta las tres formas posibles de respuesta del proveedor:
 * PDF binario, texto base64 o JSON con el PDF dentro de una propiedad.
 * Nunca registra ni devuelve el contenido: solo los bytes validados.
 */
export function decodificarRespuestaPdf(entrada: {
  contentType: string | null;
  bytes: Uint8Array;
}): ResultadoDecodificacion {
  if (entrada.bytes.length === 0)
    return { ok: false, error: "F29_INVALID_PDF", detalle: "La respuesta llegó vacía." };

  if (tieneFirmaPdf(entrada.bytes)) return { ok: true, bytes: entrada.bytes, formato: "binario" };

  let texto = "";
  try {
    texto = new TextDecoder().decode(entrada.bytes).trim();
  } catch {
    return { ok: false, error: "F29_INVALID_PDF", detalle: "La respuesta no es un PDF." };
  }

  if (texto.startsWith("{") || texto.startsWith("[")) {
    try {
      const json = JSON.parse(texto) as unknown;
      const bytes = buscarBase64EnObjeto(json);
      if (bytes) return { ok: true, bytes, formato: "json_envuelto" };
    } catch {
      /* se evalúa como base64 plano más abajo */
    }
  }

  const bytes = base64ABytes(texto);
  if (bytes && tieneFirmaPdf(bytes)) return { ok: true, bytes, formato: "base64" };

  return {
    ok: false,
    error: "F29_INVALID_PDF",
    detalle: "El contenido recibido no comienza con la firma %PDF-.",
  };
}

/** Ruta privada del archivo. Nunca es pública ni contiene datos sensibles. */
export function rutaPdf(companyId: string, periodo: string, folio: string): string {
  const [anio, mes] = periodo.split("-");
  return `${companyId}/${anio}/${mes}/${folio}.pdf`;
}
