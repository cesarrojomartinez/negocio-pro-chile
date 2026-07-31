/**
 * Descarga y extracción del Formulario 29 compacto.
 *
 * Todo ocurre en el servidor: descarga del PDF, validación de la firma,
 * huella SHA-256, lectura determinística del texto con posiciones, mapeo de
 * códigos, validaciones contables y persistencia.
 *
 * No usa IA. No usa OCR. No pide archivos al usuario.
 * La Clave Tributaria vive solo en memoria y se limpia siempre en `finally`.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  RegistroConsumo,
  requestApiGateway,
  type ApiGatewayCallLog,
} from "@/integrations/sii/apiGatewayClient";
import { requestApiGatewayBinary } from "@/integrations/sii/apiGatewayBinary";
import { recursoDe } from "@/integrations/sii/apiGatewayResourceMap";
import { construirCuerpoAuth } from "@/integrations/sii/apiGatewaySiiProviderAdapter";
import { SiiProviderError } from "@/integrations/sii/contracts";
import { sanitizarProfundo } from "@/integrations/sii/sanitize";
import { esRutValido, normalizarRut } from "@/lib/rut";
import {
  empresaAutorizadaParaPruebaReal,
  leerConfiguracion,
  modoPruebaRealHabilitado,
} from "@/lib/apiGateway.server";
import { ErrorNegocio, exigirRol, registrarActividad } from "@/lib/companies.server";
import { F29_PARSER_VERSION } from "@/lib/f29Codes";
import {
  construirCamposNormalizados,
  detectarFolio,
  detectarPeriodo,
  detectarRut,
  evaluarExtraccion,
  extraerCodigos,
  validarF29,
  type ItemTextoPdf,
  type MapaCodigos,
  type CamposNormalizadosF29,
  type ValidacionF29,
} from "@/lib/f29PdfParser";
import {
  decodificarRespuestaPdf,
  listarDeclaraciones,
  rutaPdf,
  seleccionarDeclaracionVigente,
  type DeclaracionListada,
} from "@/lib/f29Declaration";
import { recalculateTaxPeriod } from "@/lib/taxRecalc.server";
import { ORIGEN_F29_PDF } from "@/lib/f29Antecedent";

export const BUCKET_F29 = "tax-f29-pdfs";

/** Errores propios de esta etapa. Nunca contienen contenido tributario. */
export type CodigoErrorF29 =
  | "F29_NOT_DECLARED"
  | "F29_FOLIO_NOT_FOUND"
  | "F29_MULTIPLE_DECLARATIONS"
  | "F29_PDF_DOWNLOAD_FAILED"
  | "F29_INVALID_PDF"
  | "F29_RUT_MISMATCH"
  | "F29_PERIOD_MISMATCH"
  | "F29_TEXT_EXTRACTION_FAILED"
  | "F29_PARTIAL_EXTRACTION"
  | "F29_VALIDATION_FAILED"
  | "F29_STORAGE_FAILED";

export const MENSAJE_ERROR_F29: Record<CodigoErrorF29, string> = {
  F29_NOT_DECLARED: "Este periodo todavía no tiene un Formulario 29 declarado en el SII.",
  F29_FOLIO_NOT_FOUND: "El listado del SII no entregó el folio de la declaración.",
  F29_MULTIPLE_DECLARATIONS:
    "Hay más de una declaración para el periodo y el listado no indica cuál está vigente. Confirma cuál usar antes de descargar.",
  F29_PDF_DOWNLOAD_FAILED: "No pudimos descargar el formulario oficial desde el SII.",
  F29_INVALID_PDF: "El archivo recibido no es un formulario válido y no se guardó.",
  F29_RUT_MISMATCH: "El formulario descargado corresponde a otro contribuyente.",
  F29_PERIOD_MISMATCH: "El formulario descargado corresponde a otro periodo.",
  F29_TEXT_EXTRACTION_FAILED: "No pudimos leer el contenido del formulario.",
  F29_PARTIAL_EXTRACTION: "El formulario se leyó de forma parcial.",
  F29_VALIDATION_FAILED: "Las cifras leídas no cuadran entre sí y quedan en revisión.",
  F29_STORAGE_FAILED: "Los valores se guardaron, pero el archivo no pudo almacenarse.",
};

export class ErrorF29 extends Error {
  readonly codigo: CodigoErrorF29;
  constructor(codigo: CodigoErrorF29) {
    super(MENSAJE_ERROR_F29[codigo]);
    this.name = "ErrorF29";
    this.codigo = codigo;
  }
}

export interface LlamadaProveedor {
  endpoint: string;
  providerRequestId: string | null;
  actualCredits: number | null;
  creditsBalance: number | null;
  cacheHit: boolean;
  preventedProviderCall: boolean;
  reasonForProviderCall: string;
}

export interface ExtraccionF29 {
  id: string | null;
  periodo: string;
  folio: string | null;
  fechaDeclaracion: string | null;
  estadoDeclaracion: string | null;
  esRectificatoria: boolean;
  reemplazaFolio: string | null;
  paginas: number | null;
  sha256: string | null;
  archivoGuardado: boolean;
  parserVersion: string;
  estadoExtraccion: string;
  nivelConfianza: string;
  codigos: MapaCodigos;
  campos: CamposNormalizadosF29;
  validaciones: ValidacionF29[];
  advertencias: string[];
  fuente: string;
}

export interface ResultadoExtraccionF29 {
  extraccion: ExtraccionF29 | null;
  declaraciones: { folio: string; fecha: string | null; estado: string | null; esRectificatoria: boolean; vigente: boolean | null }[];
  seleccion: "unica" | "vigente" | "ambiguous" | "confirmada" | "cache";
  motivoSeleccion: string;
  llamadas: LlamadaProveedor[];
  creditosConsumidos: number;
  creditosDisponibles: number | null;
  errorCodigo: CodigoErrorF29 | null;
  mensaje: string;
  recalculado: boolean;
}

export interface EntradaExtraccionF29 {
  companyId: string;
  periodo: string;
  rutUsuario: string;
  claveTributaria: string;
  consentimiento: boolean;
  /** Confirmación explícita cuando el listado no permite decidir. */
  folioConfirmado?: string | null;
}

// ------------------------------------------------------------------ auxiliares

async function huellaSha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function desdeLlamada(
  log: ApiGatewayCallLog | null,
  endpoint: string,
  razon: string,
): LlamadaProveedor {
  return {
    endpoint,
    providerRequestId: log?.referenciaTecnica ?? null,
    actualCredits: log?.creditosUsados ?? null,
    creditsBalance: log?.creditosDisponibles ?? null,
    cacheHit: false,
    preventedProviderCall: false,
    reasonForProviderCall: razon,
  };
}

/** Extrae texto y posiciones con un lector determinístico compatible con el runtime. */
export async function leerPdf(bytes: Uint8Array): Promise<{
  items: ItemTextoPdf[];
  texto: string;
  paginas: number;
}> {
  const { extractTextItems, extractText, getDocumentProxy } = await import("unpdf");
  const documento = await getDocumentProxy(bytes);
  const conPosicion = await extractTextItems(documento);
  const items: ItemTextoPdf[] = conPosicion.items.flatMap((pagina, indice) =>
    pagina.map((i) => ({
      texto: i.str,
      pagina: indice + 1,
      x: i.x,
      y: i.y,
      ancho: i.width,
      alto: i.height,
    })),
  );
  const plano = await extractText(documento, { mergePages: true });
  return { items, texto: plano.text, paginas: conPosicion.totalPages };
}

/** Listado del día ya guardado: evita repetir la consulta y gastar créditos. */
async function listadoEnCache(companyId: string, periodo: string): Promise<unknown | null> {
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);
  const { data } = await supabaseAdmin
    .from("tax_provider_snapshots")
    .select("payload, received_at")
    .eq("company_id", companyId)
    .eq("module", "f29_periods")
    .eq("provider_reference", `f29_pdf:listado:${periodo}`)
    .gte("received_at", desde.toISOString())
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const payload = data.payload as { contenido?: unknown } | null;
  return payload?.contenido ?? null;
}

async function guardarSnapshot(entrada: {
  companyId: string;
  periodId: string | null;
  modulo: "f29_periods" | "f29_compact_pdf";
  referencia: string;
  payload: unknown;
}) {
  const ahora = new Date().toISOString();
  await supabaseAdmin.from("tax_provider_snapshots").insert({
    company_id: entrada.companyId,
    tax_period_id: entrada.periodId,
    provider: "api_gateway",
    module: entrada.modulo,
    payload: sanitizarProfundo({ contenido: entrada.payload }) as never,
    provider_reference: entrada.referencia,
    received_at: ahora,
    normalized_at: ahora,
  });
}

function aExtraccion(fila: Record<string, unknown>): ExtraccionF29 {
  return {
    id: (fila.id as string) ?? null,
    periodo: String(fila.period ?? ""),
    folio: (fila.folio as string) ?? null,
    fechaDeclaracion: (fila.declaration_date as string) ?? null,
    estadoDeclaracion: (fila.declaration_status as string) ?? null,
    esRectificatoria: Boolean(fila.is_rectification),
    reemplazaFolio: (fila.supersedes_folio as string) ?? null,
    paginas: (fila.pdf_page_count as number) ?? null,
    sha256: (fila.pdf_sha256 as string) ?? null,
    archivoGuardado: Boolean(fila.pdf_storage_path),
    parserVersion: String(fila.parser_version ?? F29_PARSER_VERSION),
    estadoExtraccion: String(fila.extraction_status ?? "pending"),
    nivelConfianza: String(fila.confidence_level ?? "unknown"),
    codigos: (fila.code_values ?? {}) as MapaCodigos,
    campos: (fila.normalized_fields ?? {}) as CamposNormalizadosF29,
    validaciones: (fila.validation_results ?? []) as ValidacionF29[],
    advertencias: (fila.warnings ?? []) as string[],
    fuente: String(fila.source ?? ORIGEN_F29_PDF),
  };
}

/** Lectura del F29 oficial ya extraído. No consulta al proveedor. */
export async function obtenerExtraccionF29(
  userId: string,
  entrada: { companyId: string; periodo: string },
): Promise<ExtraccionF29 | null> {
  await exigirRol(userId, entrada.companyId, [
    "owner",
    "business_user",
    "accountant",
    "viewer",
  ]);
  const { data } = await supabaseAdmin
    .from("tax_f29_extractions")
    .select("*")
    .eq("company_id", entrada.companyId)
    .eq("period", entrada.periodo)
    .eq("superseded", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? aExtraccion(data as Record<string, unknown>) : null;
}

/**
 * Historial de formularios ya leídos de la empresa, para cualquier año y mes.
 * No consulta al proveedor: solo lee lo ya guardado.
 */
export async function listarExtraccionesF29(
  userId: string,
  entrada: { companyId: string },
): Promise<ExtraccionF29[]> {
  await exigirRol(userId, entrada.companyId, [
    "owner",
    "business_user",
    "accountant",
    "viewer",
  ]);
  const { data } = await supabaseAdmin
    .from("tax_f29_extractions")
    .select("*")
    .eq("company_id", entrada.companyId)
    .eq("superseded", false)
    .order("period", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(aExtraccion);
}

/** URL temporal y privada para ver el PDF. Solo dueño y contador. */
export async function urlFirmadaF29(
  userId: string,
  entrada: { companyId: string; periodo: string },
): Promise<string> {
  await exigirRol(userId, entrada.companyId, ["owner", "accountant"]);
  const { data } = await supabaseAdmin
    .from("tax_f29_extractions")
    .select("pdf_storage_path")
    .eq("company_id", entrada.companyId)
    .eq("period", entrada.periodo)
    .eq("superseded", false)
    .not("pdf_storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ruta = data?.pdf_storage_path;
  if (!ruta) throw new ErrorNegocio("Todavía no hay un formulario oficial guardado.");

  const firmada = await supabaseAdmin.storage.from(BUCKET_F29).createSignedUrl(ruta, 300);
  if (firmada.error || !firmada.data?.signedUrl)
    throw new ErrorNegocio("No pudimos generar el enlace temporal del formulario.");
  return firmada.data.signedUrl;
}

// -------------------------------------------------------------------- proceso

export async function extraerF29Compacto(
  userId: string,
  entrada: EntradaExtraccionF29,
): Promise<ResultadoExtraccionF29> {
  await exigirRol(userId, entrada.companyId, ["owner", "accountant"]);
  if (!modoPruebaRealHabilitado())
    throw new ErrorNegocio("La consulta real con el proveedor no está habilitada.");
  if (!empresaAutorizadaParaPruebaReal(entrada.companyId))
    throw new ErrorNegocio("Esta empresa no está autorizada para consultas reales.");
  if (!entrada.consentimiento)
    throw new ErrorNegocio("Necesitamos tu autorización expresa para continuar.");
  if (!/^\d{4}-\d{2}$/.test(entrada.periodo))
    throw new ErrorNegocio("El periodo debe tener el formato AAAA-MM.");

  const { config } = leerConfiguracion();
  if (!config) throw new ErrorNegocio("La conexión con el proveedor no está configurada.");

  const rutUsuario = normalizarRut(entrada.rutUsuario ?? "");
  if (!esRutValido(rutUsuario))
    throw new ErrorNegocio("El RUT del usuario autorizado no es válido.");
  if (!entrada.claveTributaria || entrada.claveTributaria.length < 4)
    throw new ErrorNegocio("La clave indicada no es válida.");

  // La clave solo existe dentro de esta variable y se limpia en `finally`.
  let cuerpo: { auth: { pass: { rut: string; clave: string } } } | null =
    construirCuerpoAuth(rutUsuario, entrada.claveTributaria);

  const registro = new RegistroConsumo(2);
  const llamadas: LlamadaProveedor[] = [];
  let recalculado = false;

  try {
    const { data: empresa } = await supabaseAdmin
      .from("tax_companies")
      .select("id, rut")
      .eq("id", entrada.companyId)
      .maybeSingle();
    const { data: periodoFila } = await supabaseAdmin
      .from("tax_periods")
      .select("id")
      .eq("company_id", entrada.companyId)
      .eq("period", entrada.periodo)
      .maybeSingle();
    const periodId = periodoFila ? String(periodoFila.id) : null;

    // ---------- 1. Listado de declaraciones (con caché diaria) ----------
    const rutaListado = recursoDe("f29_periods").path.replace("{periodo}", entrada.periodo);
    let crudoListado = await listadoEnCache(entrada.companyId, entrada.periodo);

    if (crudoListado) {
      llamadas.push({
        endpoint: rutaListado,
        providerRequestId: null,
        actualCredits: 0,
        creditsBalance: null,
        cacheHit: true,
        preventedProviderCall: true,
        reasonForProviderCall: "Listado del día ya disponible: no se consultó al proveedor.",
      });
    } else {
      const { datos, log } = await requestApiGateway<typeof cuerpo & object, unknown>({
        config,
        modulo: "f29_periods",
        metodo: "POST",
        ruta: rutaListado,
        body: cuerpo,
        registro,
        sinReintentos: true,
      });
      crudoListado = sanitizarProfundo(datos);
      await guardarSnapshot({
        companyId: entrada.companyId,
        periodId,
        modulo: "f29_periods",
        referencia: `f29_pdf:listado:${entrada.periodo}`,
        payload: crudoListado,
      });
      llamadas.push(
        desdeLlamada(log, rutaListado, "No había listado vigente del día para este periodo."),
      );
    }

    const declaraciones = listarDeclaraciones(crudoListado);
    const resumenDeclaraciones = declaraciones.map((d) => ({
      folio: d.folio,
      fecha: d.fecha,
      estado: d.estado,
      esRectificatoria: d.esRectificatoria,
      vigente: d.vigente,
    }));

    if (!declaraciones.length)
      return {
        extraccion: await obtenerExtraccionF29(userId, entrada),
        declaraciones: resumenDeclaraciones,
        seleccion: "ambiguous",
        motivoSeleccion: "El SII no informa declaraciones para este periodo.",
        llamadas,
        creditosConsumidos: Number(registro.creditosUsados.toFixed(4)),
        creditosDisponibles: registro.creditosDisponibles,
        errorCodigo: "F29_NOT_DECLARED",
        mensaje: MENSAJE_ERROR_F29.F29_NOT_DECLARED,
        recalculado: false,
      };

    let seleccion = seleccionarDeclaracionVigente(declaraciones, entrada.periodo);
    let etiquetaSeleccion: ResultadoExtraccionF29["seleccion"] = seleccion.estado;
    let elegida: DeclaracionListada | null = seleccion.seleccionada;

    if (!elegida && entrada.folioConfirmado) {
      const confirmada = declaraciones.find((d) => d.folio === entrada.folioConfirmado);
      if (confirmada) {
        elegida = confirmada;
        etiquetaSeleccion = "confirmada";
        seleccion = { ...seleccion, motivo: "Declaración confirmada manualmente por el usuario." };
      }
    }

    if (!elegida) {
      // Ambigüedad: se registra el estado y NO se descarga ningún PDF.
      await supabaseAdmin.from("tax_f29_extractions").upsert(
        {
          company_id: entrada.companyId,
          tax_period_id: periodId,
          period: entrada.periodo,
          folio: `ambiguo:${entrada.periodo}`,
          parser_version: F29_PARSER_VERSION,
          extraction_status: "ambiguous_declaration",
          confidence_level: "unknown",
          warnings: [seleccion.motivo] as never,
          code_values: {} as never,
          normalized_fields: {} as never,
          validation_results: [] as never,
        },
        { onConflict: "company_id,folio" },
      );
      return {
        extraccion: null,
        declaraciones: resumenDeclaraciones,
        seleccion: "ambiguous",
        motivoSeleccion: seleccion.motivo,
        llamadas,
        creditosConsumidos: Number(registro.creditosUsados.toFixed(4)),
        creditosDisponibles: registro.creditosDisponibles,
        errorCodigo: "F29_MULTIPLE_DECLARATIONS",
        mensaje: MENSAJE_ERROR_F29.F29_MULTIPLE_DECLARATIONS,
        recalculado: false,
      };
    }

    // ---------- 2. Idempotencia: folio ya extraído con archivo válido ----------
    const { data: existente } = await supabaseAdmin
      .from("tax_f29_extractions")
      .select("*")
      .eq("company_id", entrada.companyId)
      .eq("folio", elegida.folio)
      .maybeSingle();

    const rutaPdfRecurso = recursoDe("f29_compact_pdf").path.replace("{folio}", elegida.folio);

    if (
      existente &&
      ["success", "needs_review", "partial"].includes(String(existente.extraction_status)) &&
      existente.pdf_sha256
    ) {
      llamadas.push({
        endpoint: rutaPdfRecurso,
        providerRequestId: null,
        actualCredits: 0,
        creditsBalance: registro.creditosDisponibles,
        cacheHit: true,
        preventedProviderCall: true,
        reasonForProviderCall: "El folio ya fue descargado y leído: no se repite la descarga.",
      });
      return {
        extraccion: aExtraccion(existente as Record<string, unknown>),
        declaraciones: resumenDeclaraciones,
        seleccion: "cache",
        motivoSeleccion: seleccion.motivo,
        llamadas,
        creditosConsumidos: Number(registro.creditosUsados.toFixed(4)),
        creditosDisponibles: registro.creditosDisponibles,
        errorCodigo: null,
        mensaje: "El formulario oficial de este periodo ya estaba leído y guardado.",
        recalculado: false,
      };
    }

    // ---------- 3. Descarga del PDF compacto ----------
    const binario = await requestApiGatewayBinary({
      config,
      modulo: "f29_compact_pdf",
      ruta: rutaPdfRecurso,
      body: cuerpo,
      registro,
    });
    llamadas.push(
      desdeLlamada(binario.log, rutaPdfRecurso, "Folio nuevo sin PDF guardado previamente."),
    );

    const decodificado = decodificarRespuestaPdf({
      contentType: binario.contentType,
      bytes: binario.bytes,
    });
    if (!decodificado.ok) throw new ErrorF29("F29_INVALID_PDF");

    const sha256 = await huellaSha256(decodificado.bytes);

    // ---------- 4. Lectura determinística ----------
    let lectura: Awaited<ReturnType<typeof leerPdf>>;
    try {
      lectura = await leerPdf(decodificado.bytes);
    } catch {
      throw new ErrorF29("F29_TEXT_EXTRACTION_FAILED");
    }

    const codigos = extraerCodigos({ items: lectura.items, texto: lectura.texto });
    const campos = construirCamposNormalizados(codigos);
    const validaciones = validarF29(campos, {
      rutEmpresa: empresa?.rut ?? null,
      rutDocumento: detectarRut(lectura.texto),
      periodoSolicitado: entrada.periodo,
      periodoDocumento: detectarPeriodo(lectura.texto),
      folioListado: elegida.folio,
      folioDocumento: detectarFolio(lectura.texto),
    });
    const evaluacion = evaluarExtraccion({ codigos, campos, validaciones });

    const rutDistinto = validaciones.some((v) => v.id === "rut" && v.estado === "error");
    const periodoDistinto = validaciones.some((v) => v.id === "periodo" && v.estado === "error");
    // El folio impreso coincidiendo con el del listado ya prueba la identidad
    // del documento: en ese caso una lectura dudosa del periodo no descarta el
    // formulario, solo queda como advertencia.
    const folioCoincide = validaciones.some((v) => v.id === "folio" && v.estado === "ok");
    if (rutDistinto) throw new ErrorF29("F29_RUT_MISMATCH");
    if (periodoDistinto && !folioCoincide) throw new ErrorF29("F29_PERIOD_MISMATCH");


    // ---------- 5. Almacenamiento privado (no bloquea el parser) ----------
    let rutaArchivo: string | null = rutaPdf(entrada.companyId, entrada.periodo, elegida.folio);
    let advertencias = [...evaluacion.advertencias];
    const subida = await supabaseAdmin.storage
      .from(BUCKET_F29)
      .upload(rutaArchivo, decodificado.bytes as unknown as ArrayBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (subida.error) {
      rutaArchivo = null;
      advertencias = [
        ...advertencias,
        "El archivo no pudo guardarse en el almacenamiento privado; los valores sí quedaron registrados.",
      ];
    }

    // ---------- 6. Persistencia ----------
    const esRectificatoria = elegida.esRectificatoria;
    const anteriores = declaraciones.filter((d) => d.folio !== elegida!.folio).map((d) => d.folio);

    const { data: guardado, error: errorGuardado } = await supabaseAdmin
      .from("tax_f29_extractions")
      .upsert(
        {
          company_id: entrada.companyId,
          tax_period_id: periodId,
          period: entrada.periodo,
          folio: elegida.folio,
          declaration_date: elegida.fecha,
          declaration_status: elegida.estado,
          is_rectification: esRectificatoria,
          supersedes_folio: esRectificatoria ? (anteriores[0] ?? null) : null,
          superseded: false,
          pdf_storage_path: rutaArchivo,
          pdf_sha256: sha256,
          pdf_page_count: lectura.paginas,
          parser_version: F29_PARSER_VERSION,
          extraction_status: evaluacion.estado,
          confidence_level: evaluacion.confianza,
          code_values: codigos as never,
          normalized_fields: campos as never,
          validation_results: validaciones as never,
          warnings: advertencias as never,
          source: ORIGEN_F29_PDF,
        },
        { onConflict: "company_id,folio" },
      )
      .select("*")
      .maybeSingle();
    if (errorGuardado) throw new ErrorNegocio("No pudimos guardar la lectura del formulario.");

    // Los folios anteriores del mismo periodo quedan como historial.
    await supabaseAdmin
      .from("tax_f29_extractions")
      .update({ superseded: true })
      .eq("company_id", entrada.companyId)
      .eq("period", entrada.periodo)
      .neq("folio", elegida.folio);

    await guardarSnapshot({
      companyId: entrada.companyId,
      periodId,
      modulo: "f29_compact_pdf",
      referencia: `f29_pdf:extraccion:${elegida.folio}`,
      // Nunca se guarda el archivo ni su base64: solo el resultado estructurado.
      payload: { sha256, paginas: lectura.paginas, codigos, campos },
    });

    // ---------- 7. Antecedente tributario y recálculo ----------
    // Basta con que el formulario entregue alguna cifra tributaria: si trae el
    // PPM, el remanente o las retenciones, ese antecedente debe guardarse aunque
    // el total a pagar no haya podido leerse.
    const hayCifrasF29 = [
      campos.declared_total_payable,
      campos.declared_vat_payable,
      campos.declared_ppm,
      campos.declared_withholdings,
      campos.declared_previous_carryforward,
      campos.declared_new_carryforward,
    ].some((v) => typeof v === "number" && Number.isFinite(v));
    if (
      ["success", "needs_review", "partial"].includes(evaluacion.estado) &&
      hayCifrasF29 &&
      periodId
    ) {

      await supabaseAdmin.from("tax_f29_history").upsert(
        {
          company_id: entrada.companyId,
          tax_period_id: periodId,
          declaration_status: "filed",
          folio: elegida.folio,
          filed_at: elegida.fecha ? new Date(elegida.fecha).toISOString() : null,
          declared_vat: campos.declared_vat_payable,
          declared_ppm: campos.declared_ppm,
          declared_withholdings: campos.declared_withholdings ?? 0,
          declared_total: campos.declared_total_payable,
          vat_carryforward: campos.declared_previous_carryforward,
          previous_vat_carryforward: campos.declared_previous_carryforward,
          new_vat_carryforward: campos.declared_new_carryforward,
          declared_ppm_rate: campos.declared_ppm_rate,
          declared_ppm_base: campos.declared_ppm_base,
          source: "f29_pdf_extracted",
          raw_data: {
            origin: ORIGEN_F29_PDF,
            parser_version: F29_PARSER_VERSION,
            folio: elegida.folio,
            pdf_sha256: sha256,
            ppm_rate: campos.declared_ppm_rate,
            ppm_tax_base: campos.declared_ppm_base,
            confidence_level: evaluacion.confianza,
          } as never,
        },
        { onConflict: "company_id,tax_period_id" },
      );

      try {
        await recalculateTaxPeriod(userId, {
          companyId: entrada.companyId,
          periodo: entrada.periodo,
        });
        recalculado = true;
      } catch {
        advertencias = [...advertencias, "El resumen del periodo no pudo recalcularse automáticamente."];
      }
    }

    await registrarActividad(
      entrada.companyId,
      userId,
      "sii.f29_pdf_extraction",
      "tax_f29_extractions",
      {
        periodo: entrada.periodo,
        estado: evaluacion.estado,
        confianza: evaluacion.confianza,
        creditos: Number(registro.creditosUsados.toFixed(4)),
        consultas: registro.consultas,
      },
    );

    const extraccion = guardado
      ? aExtraccion(guardado as Record<string, unknown>)
      : null;

    return {
      extraccion: extraccion ? { ...extraccion, advertencias } : null,
      declaraciones: resumenDeclaraciones,
      seleccion: etiquetaSeleccion,
      motivoSeleccion: seleccion.motivo,
      llamadas,
      creditosConsumidos: Number(registro.creditosUsados.toFixed(4)),
      creditosDisponibles: registro.creditosDisponibles,
      errorCodigo:
        evaluacion.estado === "partial"
          ? "F29_PARTIAL_EXTRACTION"
          : evaluacion.estado === "needs_review"
            ? "F29_VALIDATION_FAILED"
            : rutaArchivo === null
              ? "F29_STORAGE_FAILED"
              : null,
      mensaje:
        evaluacion.estado === "success"
          ? "Formulario 29 oficial descargado y leído correctamente."
          : evaluacion.estado === "partial"
            ? MENSAJE_ERROR_F29.F29_PARTIAL_EXTRACTION
            : MENSAJE_ERROR_F29.F29_VALIDATION_FAILED,
      recalculado,
    };
  } catch (error) {
    // Ante cualquier error se conservan los datos previos: no se ponen ceros,
    // no se vacía el periodo y no se reintenta automáticamente.
    const anterior = await obtenerExtraccionF29(userId, entrada).catch(() => null);
    if (error instanceof ErrorF29)
      return {
        extraccion: anterior,
        declaraciones: [],
        seleccion: "ambiguous",
        motivoSeleccion: "La descarga no pudo completarse.",
        llamadas,
        creditosConsumidos: Number(registro.creditosUsados.toFixed(4)),
        creditosDisponibles: registro.creditosDisponibles,
        errorCodigo: error.codigo,
        mensaje: error.message,
        recalculado: false,
      };
    if (error instanceof SiiProviderError)
      return {
        extraccion: anterior,
        declaraciones: [],
        seleccion: "ambiguous",
        motivoSeleccion: "La descarga no pudo completarse.",
        llamadas,
        creditosConsumidos: Number(registro.creditosUsados.toFixed(4)),
        creditosDisponibles: registro.creditosDisponibles,
        errorCodigo: "F29_PDF_DOWNLOAD_FAILED",
        mensaje: MENSAJE_ERROR_F29.F29_PDF_DOWNLOAD_FAILED,
        recalculado: false,
      };
    // Cualquier otro fallo queda registrado con su detalle técnico para poder
    // corregirlo sin volver a consultar al proveedor. Nunca interrumpe la
    // actualización de ventas y compras.
    const detalle =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    await registrarActividad(
      entrada.companyId,
      userId,
      "sii.f29_pdf_extraction_failed",
      "tax_f29_extractions",
      {
        periodo: entrada.periodo,
        detalle: detalle.slice(0, 300),
        consultas: registro.consultas,
      },
    ).catch(() => undefined);
    return {
      extraccion: anterior,
      declaraciones: [],
      seleccion: "ambiguous",
      motivoSeleccion: "La lectura no pudo completarse.",
      llamadas,
      creditosConsumidos: Number(registro.creditosUsados.toFixed(4)),
      creditosDisponibles: registro.creditosDisponibles,
      errorCodigo: "F29_UNKNOWN_ERROR",
      mensaje:
        "No pudimos leer el Formulario 29 de este periodo. Tus ventas y compras sí quedaron actualizadas.",
      recalculado: false,
    };

  } finally {
    // La Clave Tributaria se descarta siempre, con éxito o con error.
    if (cuerpo) cuerpo.auth.pass.clave = "";
    cuerpo = null;
  }
}
