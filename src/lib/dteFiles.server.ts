/**
 * Centro documental: archivos individuales (PDF y XML) de cada documento
 * tributario del Registro de Compras y Ventas.
 *
 * Todo ocurre en el servidor. La Clave Tributaria vive solo en memoria durante
 * la operación y nunca se guarda. Las descargas son bajo demanda: un documento
 * ya archivado no se vuelve a pedir al proveedor.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { RegistroConsumo } from "@/integrations/sii/apiGatewayClient";
import { requestApiGatewayBinary } from "@/integrations/sii/apiGatewayBinary";
import {
  moduloArchivoDte,
  RECURSOS_DTE,
  rutaRecursoDte,
} from "@/integrations/sii/apiGatewayResourceMap";
import { construirCuerpoAuth } from "@/integrations/sii/apiGatewaySiiProviderAdapter";
import { SiiProviderError } from "@/integrations/sii/contracts";
import { decodificarRespuestaPdf } from "@/lib/f29Declaration";
import {
  codigoDteDeDocumento,
  compararConRegistro,
  decodificarRespuestaXml,
  estimarCreditos,
  MAX_DOCUMENTOS_POR_LOTE,
  leerXmlDte,
  rutaArchivoDte,
  type CamposXmlDte,
  type TipoArchivoDte,
  type ValidacionArchivo,
} from "@/lib/dteXmlParser";

export {
  codigoDteDeDocumento,
  estimarCreditos,
  MAX_DOCUMENTOS_POR_LOTE,
  type TipoArchivoDte,
} from "@/lib/dteXmlParser";
import {
  empresaAutorizadaParaPruebaReal,
  leerConfiguracion,
  modoPruebaRealHabilitado,
} from "@/lib/apiGateway.server";
import { ErrorNegocio, exigirRol, registrarActividad } from "@/lib/companies.server";
import { esRutValido, normalizarRut } from "@/lib/rut";

export const BUCKET_DTE = "tax-dte-files";

export interface ArchivoDteResumen {
  id: string;
  tipoArchivo: TipoArchivoDte;
  estado: string;
  sha256: string | null;
  bytes: number | null;
  descargadoEn: string;
  creditos: number;
  campos: CamposXmlDte | null;
  validaciones: ValidacionArchivo[];
  advertencias: string[];
}

export interface DocumentoCentro {
  id: string;
  periodo: string;
  direccion: "sale" | "purchase";
  tipo: string;
  dteCode: number;
  folio: number;
  fecha: string;
  contraparte: string;
  contraparteRut: string | null;
  neto: number;
  iva: number;
  exento: number;
  total: number;
  estadoRcv: string;
  /** `true` cuando el documento proviene del proveedor simulado. */
  simulado: boolean;
  archivos: ArchivoDteResumen[];
}

export interface ListadoDocumentos {
  documentos: DocumentoCentro[];
  totales: { emitidos: number; recibidos: number; conArchivo: number };
  /** Verdadero si alguno de los documentos del periodo es simulado. */
  hayDatosSimulados: boolean;
  /** El proveedor real está habilitado para esta empresa. */
  descargaDisponible: boolean;
}

export interface ResultadoDescargaArchivo {
  documentoId: string;
  tipoArchivo: TipoArchivoDte;
  archivo: ArchivoDteResumen | null;
  desdeArchivoGuardado: boolean;
  creditosConsumidos: number;
  creditosDisponibles: number | null;
  recurso: string;
  mensaje: string;
  error: string | null;
}

export interface ResultadoLote {
  resultados: ResultadoDescargaArchivo[];
  creditosConsumidos: number;
  creditosDisponibles: number | null;
  detenidoPor: string | null;
}

// ------------------------------------------------------------------ auxiliares

async function huellaSha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function aResumen(fila: Record<string, unknown>): ArchivoDteResumen {
  const campos = (fila.xml_fields ?? {}) as Record<string, unknown>;
  return {
    id: String(fila.id),
    tipoArchivo: String(fila.file_kind) as TipoArchivoDte,
    estado: String(fila.status ?? "stored"),
    sha256: (fila.sha256 as string) ?? null,
    bytes: (fila.byte_size as number) ?? null,
    descargadoEn: String(fila.downloaded_at ?? ""),
    creditos: Number(fila.credits_used ?? 0),
    campos: Object.keys(campos).length ? (campos as unknown as CamposXmlDte) : null,
    validaciones: (fila.validation ?? []) as ValidacionArchivo[],
    advertencias: (fila.warnings ?? []) as string[],
  };
}

function esSimulado(source: string): boolean {
  return source === "mock" || source === "mock_gateway";
}

// -------------------------------------------------------------------- lecturas

export async function listarDocumentosPeriodo(
  userId: string,
  entrada: { companyId: string; periodo: string },
): Promise<ListadoDocumentos> {
  await exigirRol(userId, entrada.companyId, [
    "owner",
    "business_user",
    "accountant",
    "viewer",
  ]);

  const { data: periodoFila } = await supabaseAdmin
    .from("tax_periods")
    .select("id")
    .eq("company_id", entrada.companyId)
    .eq("period", entrada.periodo)
    .maybeSingle();

  if (!periodoFila)
    return {
      documentos: [],
      totales: { emitidos: 0, recibidos: 0, conArchivo: 0 },
      hayDatosSimulados: false,
      descargaDisponible: false,
    };

  const [{ data: documentos }, { data: archivos }] = await Promise.all([
    supabaseAdmin
      .from("tax_documents")
      .select("*")
      .eq("company_id", entrada.companyId)
      .eq("tax_period_id", periodoFila.id)
      .order("document_date", { ascending: false })
      .order("folio", { ascending: false }),
    supabaseAdmin
      .from("tax_document_files")
      .select("*")
      .eq("company_id", entrada.companyId)
      .eq("period", entrada.periodo),
  ]);

  const porDocumento = new Map<string, ArchivoDteResumen[]>();
  for (const archivo of archivos ?? []) {
    const clave = String((archivo as Record<string, unknown>).tax_document_id ?? "");
    if (!clave) continue;
    const lista = porDocumento.get(clave) ?? [];
    lista.push(aResumen(archivo as Record<string, unknown>));
    porDocumento.set(clave, lista);
  }

  const filas = (documentos ?? []) as unknown as Record<string, unknown>[];
  const lista: DocumentoCentro[] = filas.map((d) => ({
    id: String(d.id),
    periodo: entrada.periodo,
    direccion: d.document_direction as "sale" | "purchase",
    tipo: String(d.document_type),
    dteCode: codigoDteDeDocumento({
      external_id: (d.external_id as string) ?? null,
      document_type: String(d.document_type),
    }),
    folio: Number(d.folio),
    fecha: String(d.document_date),
    contraparte: String(d.counterparty_name ?? "Sin identificar"),
    contraparteRut: (d.counterparty_rut as string) ?? null,
    neto: Number(d.net_amount ?? 0),
    iva: Number(d.vat_amount ?? 0),
    exento: Number(d.exempt_amount ?? 0),
    total: Number(d.total_amount ?? 0),
    estadoRcv: String(d.rcv_status ?? "unknown"),
    simulado: esSimulado(String(d.source ?? "")),
    archivos: porDocumento.get(String(d.id)) ?? [],
  }));

  return {
    documentos: lista,
    totales: {
      emitidos: lista.filter((d) => d.direccion === "sale").length,
      recibidos: lista.filter((d) => d.direccion === "purchase").length,
      conArchivo: lista.filter((d) => d.archivos.length > 0).length,
    },
    hayDatosSimulados: lista.some((d) => d.simulado),
    descargaDisponible:
      modoPruebaRealHabilitado() && empresaAutorizadaParaPruebaReal(entrada.companyId),
  };
}

/** Enlace temporal y privado al archivo guardado. Solo dueño y contador. */
export async function urlFirmadaArchivoDte(
  userId: string,
  entrada: { companyId: string; archivoId: string },
): Promise<string> {
  await exigirRol(userId, entrada.companyId, ["owner", "accountant"]);
  const { data } = await supabaseAdmin
    .from("tax_document_files")
    .select("storage_path")
    .eq("company_id", entrada.companyId)
    .eq("id", entrada.archivoId)
    .maybeSingle();
  const ruta = (data as { storage_path?: string | null } | null)?.storage_path;
  if (!ruta) throw new ErrorNegocio("Este documento todavía no tiene archivo guardado.");

  const firmada = await supabaseAdmin.storage.from(BUCKET_DTE).createSignedUrl(ruta, 300);
  if (firmada.error || !firmada.data?.signedUrl)
    throw new ErrorNegocio("No pudimos generar el enlace temporal del documento.");
  return firmada.data.signedUrl;
}

// -------------------------------------------------------------------- descarga

interface ContextoDescarga {
  companyId: string;
  rutEmpresa: string;
  periodo: string;
  cuerpo: object;
  registro: RegistroConsumo;
  userId: string;
}

async function descargarUno(
  contexto: ContextoDescarga,
  documento: Record<string, unknown>,
  tipoArchivo: TipoArchivoDte,
): Promise<ResultadoDescargaArchivo> {
  const documentoId = String(documento.id);
  const direccion = documento.document_direction as "sale" | "purchase";
  const dteCode = codigoDteDeDocumento({
    external_id: (documento.external_id as string) ?? null,
    document_type: String(documento.document_type),
  });
  const folio = Number(documento.folio);
  const rutContraparte = normalizarRut(String(documento.counterparty_rut ?? ""));
  const modulo = moduloArchivoDte(direccion, tipoArchivo);
  const recurso = rutaRecursoDte({
    modulo,
    rutEmpresa: contexto.rutEmpresa,
    rutContraparte,
    dteCode,
    folio,
    fechaEmision: String(documento.document_date ?? "") || null,
  });

  const base: Omit<ResultadoDescargaArchivo, "archivo" | "mensaje" | "error"> = {
    documentoId,
    tipoArchivo,
    desdeArchivoGuardado: false,
    creditosConsumidos: 0,
    creditosDisponibles: contexto.registro.creditosDisponibles,
    recurso: RECURSOS_DTE[modulo].path,
  };

  if (esSimulado(String(documento.source ?? "")))
    return {
      ...base,
      archivo: null,
      mensaje:
        "Este documento es demostrativo: no existe un archivo oficial que descargar.",
      error: "DOCUMENTO_SIMULADO",
    };

  // Idempotencia: si ya está archivado, no se vuelve a consultar al proveedor.
  const { data: existente } = await supabaseAdmin
    .from("tax_document_files")
    .select("*")
    .eq("company_id", contexto.companyId)
    .eq("direction", direccion)
    .eq("dte_code", dteCode)
    .eq("folio", folio)
    .eq("counterparty_rut", rutContraparte)
    .eq("file_kind", tipoArchivo)
    .maybeSingle();

  if (existente && String((existente as Record<string, unknown>).status) === "stored")
    return {
      ...base,
      archivo: aResumen(existente as Record<string, unknown>),
      desdeArchivoGuardado: true,
      mensaje: "Ya teníamos este archivo guardado: no se consultó al SII.",
      error: null,
    };

  const { config } = leerConfiguracion();
  if (!config) throw new ErrorNegocio("La conexión con el proveedor no está configurada.");

  const antes = contexto.registro.creditosUsados;
  const respuesta = await requestApiGatewayBinary({
    config,
    modulo,
    ruta: recurso,
    body: contexto.cuerpo,
    registro: contexto.registro,
  });
  const creditos = Number((contexto.registro.creditosUsados - antes).toFixed(4));

  let bytes: Uint8Array;
  let campos: CamposXmlDte | null = null;
  let validaciones: ValidacionArchivo[] = [];
  const advertencias: string[] = [];

  if (tipoArchivo === "pdf") {
    const decodificado = decodificarRespuestaPdf({
      contentType: respuesta.contentType,
      bytes: respuesta.bytes,
    });
    if (!decodificado.ok) {
      await registrarFallo(contexto, documento, tipoArchivo, dteCode, folio, rutContraparte, recurso, creditos);
      return {
        ...base,
        creditosConsumidos: creditos,
        creditosDisponibles: contexto.registro.creditosDisponibles,
        archivo: null,
        mensaje: "El archivo recibido no es un documento válido y no se guardó.",
        error: "ARCHIVO_INVALIDO",
      };
    }
    bytes = decodificado.bytes;
  } else {
    const decodificado = decodificarRespuestaXml({
      contentType: respuesta.contentType,
      bytes: respuesta.bytes,
    });
    if (!decodificado.ok) {
      await registrarFallo(contexto, documento, tipoArchivo, dteCode, folio, rutContraparte, recurso, creditos);
      return {
        ...base,
        creditosConsumidos: creditos,
        creditosDisponibles: contexto.registro.creditosDisponibles,
        archivo: null,
        mensaje: "El archivo recibido no es un documento válido y no se guardó.",
        error: "ARCHIVO_INVALIDO",
      };
    }
    bytes = decodificado.bytes;
    campos = leerXmlDte(decodificado.texto);
    validaciones = compararConRegistro(campos, {
      tipoDte: dteCode,
      folio,
      fecha: String(documento.document_date ?? ""),
      neto: Number(documento.net_amount ?? 0),
      iva: Number(documento.vat_amount ?? 0),
      exento: Number(documento.exempt_amount ?? 0),
      total: Number(documento.total_amount ?? 0),
    });
    if (validaciones.some((v) => v.estado !== "ok"))
      advertencias.push(
        "Hay diferencias entre el archivo del SII y el registro guardado. No modificamos ningún monto.",
      );
  }

  const sha256 = await huellaSha256(bytes);
  const ruta = rutaArchivoDte({
    companyId: contexto.companyId,
    periodo: contexto.periodo,
    direccion,
    dteCode,
    folio,
    tipoArchivo,
  });

  const subida = await supabaseAdmin.storage
    .from(BUCKET_DTE)
    .upload(ruta, bytes as unknown as ArrayBuffer, {
      contentType: tipoArchivo === "pdf" ? "application/pdf" : "application/xml",
      upsert: true,
    });
  if (subida.error) advertencias.push("El archivo no pudo guardarse en tu carpeta privada.");

  const fila = {
    company_id: contexto.companyId,
    tax_document_id: documentoId,
    period: contexto.periodo,
    direction: direccion,
    dte_code: dteCode,
    folio,
    counterparty_rut: rutContraparte,
    file_kind: tipoArchivo,
    storage_path: subida.error ? null : ruta,
    sha256,
    byte_size: bytes.byteLength,
    content_type: respuesta.contentType,
    source_endpoint: RECURSOS_DTE[modulo].path,
    credits_used: creditos,
    status: subida.error ? "failed" : "stored",
    error_code: subida.error ? "STORAGE_FAILED" : null,
    xml_fields: (campos ?? {}) as never,
    validation: validaciones as never,
    warnings: advertencias as never,
    requested_by: contexto.userId,
    downloaded_at: new Date().toISOString(),
  };

  const { data: guardada } = await supabaseAdmin
    .from("tax_document_files")
    .upsert(fila as never, {
      onConflict: "company_id,direction,dte_code,folio,counterparty_rut,file_kind",
    })
    .select("*")
    .maybeSingle();

  await registrarActividad(
    contexto.companyId,
    contexto.userId,
    "dte_file_downloaded",
    "tax_document_files",
    { periodo: contexto.periodo, tipoArchivo, folio, dteCode, creditos },
  );

  return {
    ...base,
    creditosConsumidos: creditos,
    creditosDisponibles: contexto.registro.creditosDisponibles,
    archivo: guardada ? aResumen(guardada as Record<string, unknown>) : null,
    mensaje: subida.error
      ? "Leímos el documento, pero el archivo no pudo guardarse."
      : "Documento descargado y archivado correctamente.",
    error: null,
  };
}

async function registrarFallo(
  contexto: ContextoDescarga,
  documento: Record<string, unknown>,
  tipoArchivo: TipoArchivoDte,
  dteCode: number,
  folio: number,
  rutContraparte: string,
  recurso: string,
  creditos: number,
) {
  await supabaseAdmin.from("tax_document_files").upsert(
    {
      company_id: contexto.companyId,
      tax_document_id: String(documento.id),
      period: contexto.periodo,
      direction: documento.document_direction as "sale" | "purchase",
      dte_code: dteCode,
      folio,
      counterparty_rut: rutContraparte,
      file_kind: tipoArchivo,
      source_endpoint: recurso.split("?")[0],
      credits_used: creditos,
      status: "failed",
      error_code: "ARCHIVO_INVALIDO",
      requested_by: contexto.userId,
    } as never,
    { onConflict: "company_id,direction,dte_code,folio,counterparty_rut,file_kind" },
  );
}

async function prepararContexto(
  userId: string,
  entrada: {
    companyId: string;
    periodo: string;
    rutUsuario: string;
    claveTributaria: string;
    consentimiento: boolean;
  },
  limite: number,
): Promise<ContextoDescarga> {
  await exigirRol(userId, entrada.companyId, ["owner", "accountant"]);
  if (!modoPruebaRealHabilitado())
    throw new ErrorNegocio("La consulta real con el proveedor no está habilitada.");
  if (!empresaAutorizadaParaPruebaReal(entrada.companyId))
    throw new ErrorNegocio("Esta empresa no está autorizada para consultas reales.");
  if (!entrada.consentimiento)
    throw new ErrorNegocio("Necesitamos tu autorización expresa para continuar.");

  const rutUsuario = normalizarRut(entrada.rutUsuario ?? "");
  if (!esRutValido(rutUsuario))
    throw new ErrorNegocio("El RUT del usuario autorizado no es válido.");
  if (!entrada.claveTributaria || entrada.claveTributaria.length < 4)
    throw new ErrorNegocio("La clave indicada no es válida.");

  const { data: empresa } = await supabaseAdmin
    .from("tax_companies")
    .select("rut")
    .eq("id", entrada.companyId)
    .maybeSingle();
  if (!empresa?.rut) throw new ErrorNegocio("No encontramos el RUT de esta empresa.");

  return {
    companyId: entrada.companyId,
    rutEmpresa: normalizarRut(String(empresa.rut)),
    periodo: entrada.periodo,
    cuerpo: construirCuerpoAuth(rutUsuario, entrada.claveTributaria),
    registro: new RegistroConsumo(limite),
    userId,
  };
}

async function leerDocumentos(companyId: string, ids: string[]) {
  const { data } = await supabaseAdmin
    .from("tax_documents")
    .select("*")
    .eq("company_id", companyId)
    .in("id", ids);
  return ((data ?? []) as unknown as Record<string, unknown>[]);
}

/** Descarga bajo demanda de un solo archivo. */
export async function descargarArchivoDte(
  userId: string,
  entrada: {
    companyId: string;
    periodo: string;
    documentoId: string;
    tipoArchivo: TipoArchivoDte;
    rutUsuario: string;
    claveTributaria: string;
    consentimiento: boolean;
  },
): Promise<ResultadoDescargaArchivo> {
  let contexto: ContextoDescarga | null = await prepararContexto(userId, entrada, 2);
  try {
    const [documento] = await leerDocumentos(entrada.companyId, [entrada.documentoId]);
    if (!documento) throw new ErrorNegocio("No encontramos este documento.");
    return await descargarUno(contexto, documento, entrada.tipoArchivo);
  } catch (error) {
    if (error instanceof SiiProviderError) throw new ErrorNegocio(error.message);
    throw error;
  } finally {
    // La clave nunca sobrevive a la operación.
    contexto = null;
  }
}

/**
 * Archivado por lote. Se detiene ante cualquier problema de sesión, saldo o
 * límite del proveedor para no seguir gastando consultas.
 */
export async function descargarLoteArchivosDte(
  userId: string,
  entrada: {
    companyId: string;
    periodo: string;
    documentoIds: string[];
    tipoArchivo: TipoArchivoDte;
    rutUsuario: string;
    claveTributaria: string;
    consentimiento: boolean;
  },
): Promise<ResultadoLote> {
  const ids = Array.from(new Set(entrada.documentoIds)).slice(0, MAX_DOCUMENTOS_POR_LOTE);
  if (ids.length === 0) throw new ErrorNegocio("Selecciona al menos un documento.");

  let contexto: ContextoDescarga | null = await prepararContexto(
    userId,
    entrada,
    ids.length + 2,
  );
  const resultados: ResultadoDescargaArchivo[] = [];
  let detenidoPor: string | null = null;

  try {
    const documentos = await leerDocumentos(entrada.companyId, ids);
    const porId = new Map(documentos.map((d) => [String(d.id), d]));

    for (const id of ids) {
      const documento = porId.get(id);
      if (!documento) continue;
      try {
        resultados.push(await descargarUno(contexto, documento, entrada.tipoArchivo));
      } catch (error) {
        if (error instanceof SiiProviderError) {
          detenidoPor = error.message;
          break;
        }
        throw error;
      }
    }

    return {
      resultados,
      creditosConsumidos: Number(contexto.registro.creditosUsados.toFixed(4)),
      creditosDisponibles: contexto.registro.creditosDisponibles,
      detenidoPor,
    };
  } finally {
    contexto = null;
  }
}
