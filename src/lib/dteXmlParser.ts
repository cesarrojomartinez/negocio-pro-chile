/**
 * Lectura determinística del XML de un Documento Tributario Electrónico.
 *
 * Módulo puro: sin red, sin reloj, sin base de datos, sin IA y sin OCR.
 * Solo lee las etiquetas oficiales del encabezado del DTE y compara las cifras
 * con lo que ya está registrado. Nunca corrige un dato por su cuenta.
 */


/** Tope de documentos por descarga masiva. Protege el saldo de consultas. */
export const MAX_DOCUMENTOS_POR_LOTE = 20;

export type TipoArchivoDte = "pdf" | "xml";

/** Costo declarado por el proveedor para cada tipo de archivo. */
export const CREDITOS_ARCHIVO: Record<TipoArchivoDte, number> = { pdf: 0.01, xml: 0.005 };

/** Códigos de DTE cuando el registro no informa el código numérico. */
const CODIGO_POR_TIPO: Record<string, number> = {
  factura: 33,
  boleta: 39,
  notaCredito: 61,
  notaDebito: 56,
};

/** Costo estimado de una descarga, sin consultar al proveedor. */
export function estimarCreditos(cantidad: number, tipoArchivo: TipoArchivoDte): number {
  return Number((Math.max(0, cantidad) * CREDITOS_ARCHIVO[tipoArchivo]).toFixed(4));
}

/** El código de DTE viaja dentro del identificador externo del proveedor. */
export function codigoDteDeDocumento(fila: {
  external_id: string | null;
  document_type: string;
}): number {
  const partes = (fila.external_id ?? "").split(":");
  if (partes.length >= 3) {
    const n = Number(partes[2]);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return CODIGO_POR_TIPO[fila.document_type] ?? 33;
}

export interface CamposXmlDte {
  tipoDte: number | null;
  folio: number | null;
  fechaEmision: string | null;
  rutEmisor: string | null;
  razonSocialEmisor: string | null;
  rutReceptor: string | null;
  razonSocialReceptor: string | null;
  montoNeto: number | null;
  montoExento: number | null;
  iva: number | null;
  montoTotal: number | null;
  /** El documento trae la firma electrónica del SII. */
  tieneTimbre: boolean;
}

export interface ValidacionArchivo {
  id: string;
  titulo: string;
  detalle: string;
  estado: "ok" | "warning" | "error";
}

export type ResultadoDecodificacion =
  | { ok: true; texto: string; bytes: Uint8Array; formato: "texto" | "base64" | "json_envuelto" }
  | { ok: false; detalle: string };

function bytesDesdeBase64(texto: string): Uint8Array | null {
  const limpio = texto.replace(/\s+/g, "");
  if (limpio.length < 16 || !/^[A-Za-z0-9+/=]+$/.test(limpio)) return null;
  try {
    const binario = atob(limpio);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function pareceXml(texto: string): boolean {
  const inicio = texto.trimStart().slice(0, 400);
  return inicio.startsWith("<?xml") || /<(DTE|EnvioDTE|SetDTE|Documento)\b/i.test(inicio);
}

function buscarTextoEnObjeto(valor: unknown, profundidad = 0): string | null {
  if (profundidad > 6) return null;
  if (typeof valor === "string") {
    if (pareceXml(valor)) return valor;
    const bytes = bytesDesdeBase64(valor);
    if (bytes) {
      const texto = new TextDecoder().decode(bytes);
      if (pareceXml(texto)) return texto;
    }
    return null;
  }
  if (Array.isArray(valor)) {
    for (const item of valor) {
      const encontrado = buscarTextoEnObjeto(item, profundidad + 1);
      if (encontrado) return encontrado;
    }
    return null;
  }
  if (valor && typeof valor === "object") {
    for (const item of Object.values(valor as Record<string, unknown>)) {
      const encontrado = buscarTextoEnObjeto(item, profundidad + 1);
      if (encontrado) return encontrado;
    }
  }
  return null;
}

/**
 * Acepta las tres formas en que el proveedor puede entregar el XML: texto
 * plano, base64 o un JSON que lo envuelve.
 */
export function decodificarRespuestaXml(entrada: {
  contentType: string | null;
  bytes: Uint8Array;
}): ResultadoDecodificacion {
  if (entrada.bytes.length === 0)
    return { ok: false, detalle: "La respuesta llegó vacía." };

  let texto = "";
  try {
    texto = new TextDecoder().decode(entrada.bytes).trim();
  } catch {
    return { ok: false, detalle: "El contenido recibido no se pudo leer como texto." };
  }

  if (pareceXml(texto))
    return { ok: true, texto, bytes: entrada.bytes, formato: "texto" };

  if (texto.startsWith("{") || texto.startsWith("[")) {
    try {
      const json = JSON.parse(texto) as unknown;
      const encontrado = buscarTextoEnObjeto(json);
      if (encontrado)
        return {
          ok: true,
          texto: encontrado,
          bytes: new TextEncoder().encode(encontrado),
          formato: "json_envuelto",
        };
    } catch {
      /* se evalúa como base64 plano más abajo */
    }
  }

  const bytes = bytesDesdeBase64(texto);
  if (bytes) {
    const decodificado = new TextDecoder().decode(bytes);
    if (pareceXml(decodificado))
      return { ok: true, texto: decodificado, bytes, formato: "base64" };
  }

  return { ok: false, detalle: "El contenido recibido no corresponde a un XML de documento." };
}

function etiqueta(xml: string, nombre: string): string | null {
  const regex = new RegExp(`<${nombre}\\b[^>]*>([\\s\\S]*?)</${nombre}>`, "i");
  const encontrado = regex.exec(xml);
  if (!encontrado) return null;
  const valor = encontrado[1].trim();
  return valor === "" ? null : valor;
}

function numero(xml: string, nombre: string): number | null {
  const valor = etiqueta(xml, nombre);
  if (valor == null) return null;
  const limpio = valor.replace(/\./g, "").replace(",", ".");
  const n = Number(limpio);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function entero(xml: string, nombre: string): number | null {
  const n = numero(xml, nombre);
  return n == null ? null : Math.round(n);
}

function normalizarRutXml(valor: string | null): string | null {
  if (!valor) return null;
  const limpio = valor.replace(/[.\s]/g, "").toUpperCase();
  return /^\d{7,8}-[\dK]$/.test(limpio) ? limpio : limpio || null;
}

/** Lee el encabezado del DTE. Cualquier campo ausente queda en `null`. */
export function leerXmlDte(xml: string): CamposXmlDte {
  const emisor = etiqueta(xml, "Emisor") ?? "";
  const receptor = etiqueta(xml, "Receptor") ?? "";
  const idDoc = etiqueta(xml, "IdDoc") ?? xml;
  const totales = etiqueta(xml, "Totales") ?? xml;

  return {
    tipoDte: entero(idDoc, "TipoDTE"),
    folio: entero(idDoc, "Folio"),
    fechaEmision: etiqueta(idDoc, "FchEmis"),
    rutEmisor: normalizarRutXml(etiqueta(emisor, "RUTEmisor")),
    razonSocialEmisor: etiqueta(emisor, "RznSoc") ?? etiqueta(emisor, "RznSocEmisor"),
    rutReceptor: normalizarRutXml(etiqueta(receptor, "RUTRecep")),
    razonSocialReceptor: etiqueta(receptor, "RznSocRecep"),
    montoNeto: numero(totales, "MntNeto"),
    montoExento: numero(totales, "MntExe"),
    iva: numero(totales, "IVA"),
    montoTotal: numero(totales, "MntTotal"),
    tieneTimbre: /<TED\b/i.test(xml) || /<Signature\b/i.test(xml),
  };
}

export interface RegistroComparable {
  tipoDte: number | null;
  folio: number;
  fecha: string;
  neto: number;
  iva: number;
  exento: number;
  total: number;
}

/**
 * Compara el XML con lo registrado en el Registro de Compras y Ventas.
 * Solo informa: jamás modifica los montos ya guardados.
 */
export function compararConRegistro(
  campos: CamposXmlDte,
  registro: RegistroComparable,
): ValidacionArchivo[] {
  const validaciones: ValidacionArchivo[] = [];
  const compara = (
    id: string,
    titulo: string,
    leido: number | null,
    guardado: number,
  ) => {
    if (leido == null) {
      validaciones.push({
        id,
        titulo,
        detalle: "El documento no informa este monto.",
        estado: "warning",
      });
      return;
    }
    const diferencia = Math.abs(leido - Math.abs(guardado));
    validaciones.push(
      diferencia <= 1
        ? { id, titulo, detalle: "Coincide con el registro del SII.", estado: "ok" }
        : {
            id,
            titulo,
            detalle: `El documento informa ${leido} y el registro tiene ${Math.abs(guardado)}. Revísalo con tu contador.`,
            estado: "warning",
          },
    );
  };

  if (campos.folio != null)
    validaciones.push(
      campos.folio === registro.folio
        ? { id: "folio", titulo: "Folio", detalle: "Coincide con el registro.", estado: "ok" }
        : {
            id: "folio",
            titulo: "Folio",
            detalle: "El folio del documento no coincide con el registro.",
            estado: "error",
          },
    );

  if (campos.tipoDte != null && registro.tipoDte != null)
    validaciones.push(
      campos.tipoDte === registro.tipoDte
        ? { id: "tipo", titulo: "Tipo de documento", detalle: "Coincide con el registro.", estado: "ok" }
        : {
            id: "tipo",
            titulo: "Tipo de documento",
            detalle: "El tipo del documento no coincide con el registro.",
            estado: "error",
          },
    );

  if (campos.fechaEmision)
    validaciones.push(
      campos.fechaEmision === registro.fecha
        ? { id: "fecha", titulo: "Fecha de emisión", detalle: "Coincide con el registro.", estado: "ok" }
        : {
            id: "fecha",
            titulo: "Fecha de emisión",
            detalle: `El documento indica ${campos.fechaEmision} y el registro ${registro.fecha}.`,
            estado: "warning",
          },
    );

  compara("neto", "Monto neto", campos.montoNeto, registro.neto);
  compara("iva", "IVA", campos.iva, registro.iva);
  compara("exento", "Monto exento", campos.montoExento, registro.exento);
  compara("total", "Monto total", campos.montoTotal, registro.total);

  if (!campos.tieneTimbre)
    validaciones.push({
      id: "timbre",
      titulo: "Timbre electrónico",
      detalle: "El archivo no incluye el timbre electrónico del SII.",
      estado: "warning",
    });

  return validaciones;
}

/** Ruta privada del archivo dentro del almacenamiento de la empresa. */
export function rutaArchivoDte(entrada: {
  companyId: string;
  periodo: string;
  direccion: "sale" | "purchase";
  dteCode: number;
  folio: number;
  tipoArchivo: "pdf" | "xml";
}): string {
  const [anio, mes] = entrada.periodo.split("-");
  const carpeta = entrada.direccion === "sale" ? "emitidos" : "recibidos";
  return `${entrada.companyId}/${anio}/${mes}/${carpeta}/${entrada.dteCode}-${entrada.folio}.${entrada.tipoArchivo}`;
}
