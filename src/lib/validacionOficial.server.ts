/**
 * Validación controlada de información oficial.
 *
 * Orquesta, en el servidor y sin reintentos automáticos:
 *  1. previsualización con lo que ya está guardado y el costo estimado;
 *  2. lectura del Formulario 29 oficial del periodo elegido;
 *  3. descarga opcional del archivo oficial de un documento emitido y/o recibido;
 *  4. comparación entre lo estimado por el motor y lo declarado;
 *  5. una tarjeta permanente por ejecución.
 *
 * No hay lógica especial para ninguna empresa, año ni mes.
 * La Clave Tributaria vive solo durante la ejecución y se limpia en `finally`.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ErrorNegocio, exigirRol, registrarActividad } from "@/lib/companies.server";
import {
  empresaAutorizadaParaPruebaReal,
  modoPruebaRealHabilitado,
} from "@/lib/apiGateway.server";
import { SiiProviderError } from "@/integrations/sii/contracts";
import {
  codigosEncontrados,
  codigosFaltantes,
  compararConMotor,
  documentosRequeridos,
  errorValidacionDesdeF29,
  errorValidacionDesdeProveedor,
  esPeriodoValido,
  estadoArchivoDte,
  MENSAJE_ERROR_VALIDACION,
  planDeValidacion,
  totalOficialDeclarado,
  type CodigoErrorValidacion,
  type ComparacionOficial,
  type EstadoArchivoDte,
  type PlanValidacion,
  type ResumenEstimado,
  type TipoValidacion,
} from "@/lib/validacionOficial";
import type { TipoArchivoDte } from "@/lib/dteXmlParser";
import type { MapaCodigos, CamposNormalizadosF29 } from "@/lib/f29PdfParser";

// ------------------------------------------------------------------- contratos

export interface DocumentoElegible {
  id: string;
  direccion: "sale" | "purchase";
  dteCode: number;
  tipo: string;
  folio: number;
  fecha: string;
  emisor: string;
  receptor: string;
  contraparteRut: string | null;
  total: number;
  estadoPdf: EstadoArchivoDte;
  estadoXml: EstadoArchivoDte;
  simulado: boolean;
}

export interface PrevisualizacionValidacion {
  companyId: string;
  empresa: string;
  rutEmpresa: string;
  periodo: string;
  tipo: TipoValidacion;
  periodoPersistido: boolean;
  f29Archivado: boolean;
  f29Folio: string | null;
  listadoEnCache: boolean;
  emitidos: number;
  recibidos: number;
  documentos: DocumentoElegible[];
  plan: PlanValidacion;
  proveedorHabilitado: boolean;
  estimacionMotor: ResumenEstimado | null;
}

export interface ResultadoDocumentoValidacion {
  documentoId: string;
  direccion: "sale" | "purchase";
  dteCode: number;
  folio: number;
  tipoArchivo: TipoArchivoDte;
  obtenido: boolean;
  desdeArchivoGuardado: boolean;
  archivoId: string | null;
  sha256: string | null;
  comparacionXml: "matched" | "difference" | "not_applicable";
  detalleComparacion: string[];
  creditos: number;
  errorCodigo: CodigoErrorValidacion | null;
  mensaje: string;
}

export interface RegistroValidacion {
  id: string;
  syncRunId: string;
  companyId: string;
  empresa: string | null;
  periodo: string;
  tipo: TipoValidacion;
  estado: "running" | "success" | "partial" | "failed";
  etapa: string | null;
  f29Encontrado: boolean;
  f29Folio: string | null;
  f29PdfArchivado: boolean;
  f29EstadoExtraccion: string | null;
  f29Confianza: string | null;
  codigosEncontrados: string[];
  codigosFaltantes: string[];
  codigos: MapaCodigos;
  campos: CamposNormalizadosF29 | null;
  totalOficial: number | null;
  comparacion: ComparacionOficial | null;
  documentos: ResultadoDocumentoValidacion[];
  solicitudesReales: number;
  cacheUtilizada: number;
  llamadasEvitadas: number;
  creditosConsumidos: number;
  creditosDisponibles: number | null;
  errorCodigo: CodigoErrorValidacion | null;
  mensaje: string | null;
  creadoEn: string;
}

export interface EntradaValidacion {
  companyId: string;
  periodo: string;
  tipo: TipoValidacion;
  documentoVentaId?: string | null;
  documentoCompraId?: string | null;
  archivos: TipoArchivoDte[];
  rutUsuario: string;
  claveTributaria: string;
  consentimiento: boolean;
  folioConfirmado?: string | null;
}

// ------------------------------------------------------------------ auxiliares

async function exigirDueñoAutorizado(userId: string, companyId: string) {
  await exigirRol(userId, companyId, ["owner"]);
  if (!modoPruebaRealHabilitado())
    throw new ErrorNegocio("La consulta real con el proveedor no está habilitada.");
  if (!empresaAutorizadaParaPruebaReal(companyId))
    throw new ErrorNegocio("Esta empresa no está autorizada para consultas reales.");
}

async function hayListadoDelDia(companyId: string, periodo: string): Promise<boolean> {
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);
  const { data } = await supabaseAdmin
    .from("tax_provider_snapshots")
    .select("id")
    .eq("company_id", companyId)
    .eq("module", "f29_periods")
    .eq("provider_reference", `f29_pdf:listado:${periodo}`)
    .gte("received_at", desde.toISOString())
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function leerEstimacion(
  companyId: string,
  periodo: string,
): Promise<{ resumen: ResumenEstimado | null; periodId: string | null }> {
  const { data: periodoFila } = await supabaseAdmin
    .from("tax_periods")
    .select("id")
    .eq("company_id", companyId)
    .eq("period", periodo)
    .maybeSingle();
  if (!periodoFila) return { resumen: null, periodId: null };

  const { data } = await supabaseAdmin
    .from("tax_monthly_summaries")
    .select("*")
    .eq("company_id", companyId)
    .eq("tax_period_id", periodoFila.id)
    .maybeSingle();
  if (!data) return { resumen: null, periodId: String(periodoFila.id) };

  const fila = data as Record<string, unknown>;
  const numero = (clave: string): number | null => {
    const valor = fila[clave];
    return valor == null ? null : Number(valor);
  };

  return {
    periodId: String(periodoFila.id),
    resumen: {
      estimatedTotal: numero("estimated_tax_total"),
      estimatedVatPayable: numero("estimated_vat_payable"),
      estimatedPpm: numero("estimated_ppm"),
      estimatedWithholdings: numero("estimated_withholdings"),
      previousCarryforward: numero("previous_vat_carryforward"),
      newCarryforward: numero("estimated_new_carryforward"),
      ppmRate: numero("ppm_rate"),
      specialCredits: numero("special_credits"),
      specialDebits: numero("special_debits"),
    },
  };
}

function aRegistro(fila: Record<string, unknown>): RegistroValidacion {
  const extra = (fila.calls ?? {}) as Record<string, unknown>;
  return {
    id: String(fila.id),
    syncRunId: String(fila.id),
    companyId: String(fila.company_id),
    empresa: (fila.empresa as string) ?? null,
    periodo: String(fila.period),
    tipo: String(fila.validation_type) as TipoValidacion,
    estado: String(fila.status) as RegistroValidacion["estado"],
    etapa: (fila.stage as string) ?? null,
    f29Encontrado: Boolean(fila.f29_found),
    f29Folio: (fila.f29_folio as string) ?? null,
    f29PdfArchivado: Boolean(fila.f29_pdf_archived),
    f29EstadoExtraccion: (fila.f29_extraction_status as string) ?? null,
    f29Confianza: (fila.f29_confidence as string) ?? null,
    codigosEncontrados: (fila.codes_found ?? []) as string[],
    codigosFaltantes: (fila.codes_missing ?? []) as string[],
    codigos: (extra.codigos ?? {}) as MapaCodigos,
    campos: (extra.campos as CamposNormalizadosF29) ?? null,
    totalOficial: fila.declared_total == null ? null : Number(fila.declared_total),
    comparacion: {
      estimatedTotal: fila.estimated_total == null ? null : Number(fila.estimated_total),
      declaredTotal: fila.declared_total == null ? null : Number(fila.declared_total),
      difference: fila.difference == null ? null : Number(fila.difference),
      differencePercentage:
        fila.difference_percentage == null ? null : Number(fila.difference_percentage),
      explanationCodes: (fila.explanation_codes ?? []) as ComparacionOficial["explanationCodes"],
    },
    documentos: (fila.document_results ?? []) as ResultadoDocumentoValidacion[],
    solicitudesReales: Number(fila.provider_requests ?? 0),
    cacheUtilizada: Number(fila.cache_hits ?? 0),
    llamadasEvitadas: Number(fila.prevented_provider_calls ?? 0),
    creditosConsumidos: Number(fila.actual_credits ?? 0),
    creditosDisponibles:
      fila.credits_balance == null ? null : Number(fila.credits_balance),
    errorCodigo: (fila.error_code as CodigoErrorValidacion) ?? null,
    mensaje: (fila.error_message as string) ?? null,
    creadoEn: String(fila.created_at ?? ""),
  };
}

// -------------------------------------------------------------- previsualizar

export async function previsualizarValidacion(
  userId: string,
  entrada: {
    companyId: string;
    periodo: string;
    tipo: TipoValidacion;
    documentoVentaId?: string | null;
    documentoCompraId?: string | null;
    archivos?: TipoArchivoDte[];
  },
): Promise<PrevisualizacionValidacion> {
  await exigirDueñoAutorizado(userId, entrada.companyId);
  if (!esPeriodoValido(entrada.periodo))
    throw new ErrorNegocio("El periodo debe tener el formato AAAA-MM.");

  const { data: empresa } = await supabaseAdmin
    .from("tax_companies")
    .select("business_name, rut")
    .eq("id", entrada.companyId)
    .maybeSingle();

  const { listarDocumentosPeriodo } = await import("@/lib/dteFiles.server");
  const [listado, extraccion, listadoCache, estimacion] = await Promise.all([
    listarDocumentosPeriodo(userId, {
      companyId: entrada.companyId,
      periodo: entrada.periodo,
    }),
    supabaseAdmin
      .from("tax_f29_extractions")
      .select("folio, pdf_sha256, extraction_status")
      .eq("company_id", entrada.companyId)
      .eq("period", entrada.periodo)
      .eq("superseded", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    hayListadoDelDia(entrada.companyId, entrada.periodo),
    leerEstimacion(entrada.companyId, entrada.periodo),
  ]);

  const filaF29 = extraccion.data as Record<string, unknown> | null;
  const f29Archivado = Boolean(
    filaF29?.pdf_sha256 &&
      ["success", "needs_review", "partial"].includes(String(filaF29.extraction_status)),
  );

  const razonEmpresa = String(empresa?.business_name ?? "");
  const rutEmpresa = String(empresa?.rut ?? "");
  const proveedorHabilitado = listado.descargaDisponible;

  const documentos: DocumentoElegible[] = listado.documentos.map((d) => {
    const pdf = d.archivos.find((a) => a.tipoArchivo === "pdf") ?? null;
    const xml = d.archivos.find((a) => a.tipoArchivo === "xml") ?? null;
    return {
      id: d.id,
      direccion: d.direccion,
      dteCode: d.dteCode,
      tipo: d.tipo,
      folio: d.folio,
      fecha: d.fecha,
      emisor: d.direccion === "sale" ? razonEmpresa : d.contraparte,
      receptor: d.direccion === "sale" ? d.contraparte : razonEmpresa,
      contraparteRut: d.contraparteRut,
      total: d.total,
      simulado: d.simulado,
      estadoPdf: estadoArchivoDte({
        archivo: pdf ? { estado: pdf.estado } : null,
        proveedorHabilitado,
        simulado: d.simulado,
      }),
      estadoXml: estadoArchivoDte({
        archivo: xml ? { estado: xml.estado } : null,
        proveedorHabilitado,
        simulado: d.simulado,
      }),
    };
  });

  return {
    companyId: entrada.companyId,
    empresa: razonEmpresa,
    rutEmpresa,
    periodo: entrada.periodo,
    tipo: entrada.tipo,
    periodoPersistido: estimacion.periodId != null,
    f29Archivado,
    f29Folio: (filaF29?.folio as string) ?? null,
    listadoEnCache: listadoCache,
    emitidos: listado.totales.emitidos,
    recibidos: listado.totales.recibidos,
    documentos,
    proveedorHabilitado,
    estimacionMotor: estimacion.resumen,
    plan: planDeValidacion({
      tipo: entrada.tipo,
      f29Archivado,
      listadoEnCache: listadoCache,
      documentos: (() => {
        const tipos = entrada.archivos?.length ? entrada.archivos : (["pdf"] as TipoArchivoDte[]);
        const requeridos = documentosRequeridos(entrada.tipo);
        const elegidos = [
          requeridos.venta ? entrada.documentoVentaId : null,
          requeridos.compra ? entrada.documentoCompraId : null,
        ].filter((id): id is string => Boolean(id));
        return elegidos.flatMap((id) => {
          const documento = documentos.find((d) => d.id === id);
          if (!documento) return [];
          return [
            {
              direccion: documento.direccion,
              archivos: tipos.map((tipoArchivo) => ({
                tipoArchivo,
                yaArchivado:
                  (tipoArchivo === "pdf" ? documento.estadoPdf : documento.estadoXml) ===
                  "archived",
              })),
            },
          ];
        });
      })(),
    }),
  };
}

// ------------------------------------------------------------------- ejecutar

export async function ejecutarValidacion(
  userId: string,
  entrada: EntradaValidacion,
): Promise<RegistroValidacion> {
  await exigirDueñoAutorizado(userId, entrada.companyId);
  if (!esPeriodoValido(entrada.periodo))
    throw new ErrorNegocio("El periodo debe tener el formato AAAA-MM.");
  if (!entrada.consentimiento)
    throw new ErrorNegocio("Necesitamos tu autorización expresa para continuar.");

  const requeridos = documentosRequeridos(entrada.tipo);
  if (requeridos.venta && !entrada.documentoVentaId)
    throw new ErrorNegocio("Elige el documento emitido que quieres validar.");
  if (requeridos.compra && !entrada.documentoCompraId)
    throw new ErrorNegocio("Elige el documento recibido que quieres validar.");

  const archivos = entrada.archivos.length ? entrada.archivos : (["pdf"] as TipoArchivoDte[]);

  // La clave solo existe en esta variable durante la ejecución.
  let clave: string | null = entrada.claveTributaria;

  let etapa = "Formulario 29";
  let estado: RegistroValidacion["estado"] = "success";
  let errorCodigo: CodigoErrorValidacion | null = null;
  let mensaje: string | null = null;
  let solicitudes = 0;
  let cacheHits = 0;
  let evitadas = 0;
  let creditos = 0;
  let saldo: number | null = null;

  let f29Encontrado = false;
  let f29Folio: string | null = null;
  let f29PdfArchivado = false;
  let f29Estado: string | null = null;
  let f29Confianza: string | null = null;
  let codigos: MapaCodigos = {};
  let campos: CamposNormalizadosF29 | null = null;
  let esRectificatoria = false;
  const documentos: ResultadoDocumentoValidacion[] = [];

  const { resumen, periodId } = await leerEstimacion(entrada.companyId, entrada.periodo);

  try {
    // ---------------------------------------------------------- 1. Formulario 29
    const { extraerF29Compacto } = await import("@/lib/f29PdfExtraction.server");
    const resultadoF29 = await extraerF29Compacto(userId, {
      companyId: entrada.companyId,
      periodo: entrada.periodo,
      rutUsuario: entrada.rutUsuario,
      claveTributaria: clave,
      consentimiento: true,
      folioConfirmado: entrada.folioConfirmado ?? null,
    });

    creditos += resultadoF29.creditosConsumidos;
    saldo = resultadoF29.creditosDisponibles ?? saldo;
    for (const llamada of resultadoF29.llamadas) {
      if (llamada.cacheHit) cacheHits += 1;
      else solicitudes += 1;
      if (llamada.preventedProviderCall) evitadas += 1;
    }

    const extraccion = resultadoF29.extraccion;
    if (extraccion) {
      f29Encontrado = true;
      f29Folio = extraccion.folio;
      f29PdfArchivado = extraccion.archivoGuardado;
      f29Estado = extraccion.estadoExtraccion;
      f29Confianza = extraccion.nivelConfianza;
      codigos = extraccion.codigos ?? {};
      campos = extraccion.campos ?? null;
      esRectificatoria = extraccion.esRectificatoria;
    }

    const errorF29 = errorValidacionDesdeF29(resultadoF29.errorCodigo);
    if (errorF29) {
      errorCodigo = errorF29;
      mensaje = MENSAJE_ERROR_VALIDACION[errorF29];
      estado = errorF29 === "F29_NOT_DECLARED" ? "partial" : f29Encontrado ? "partial" : "failed";
    }

    // No se continúa con documentos si el proveedor cortó la sesión.
    const cortado = errorCodigo === "SESSION_INVALID" || errorCodigo === "INVALID_CREDENTIALS";

    // ------------------------------------------------------------ 2. Documentos
    if (!cortado) {
      const seleccionados = [
        requeridos.venta ? entrada.documentoVentaId : null,
        requeridos.compra ? entrada.documentoCompraId : null,
      ].filter((id): id is string => Boolean(id));

      if (seleccionados.length) {
        etapa = "Archivos de documentos";
        const { descargarArchivoDte, codigoDteDeDocumento } = await import(
          "@/lib/dteFiles.server"
        );
        const { data: filasDocumentos } = await supabaseAdmin
          .from("tax_documents")
          .select("id, document_direction, document_type, external_id, folio")
          .eq("company_id", entrada.companyId)
          .in("id", seleccionados);
        const fichaDe = (id: string) => {
          const fila = ((filasDocumentos ?? []) as Record<string, unknown>[]).find(
            (f) => String(f.id) === id,
          );
          return {
            direccion: (fila?.document_direction as "sale" | "purchase") ?? "sale",
            dteCode: fila
              ? codigoDteDeDocumento({
                  external_id: (fila.external_id as string) ?? null,
                  document_type: String(fila.document_type),
                })
              : 0,
            folio: Number(fila?.folio ?? 0),
          };
        };

        for (const documentoId of seleccionados) {
          const ficha = fichaDe(documentoId);
          for (const tipoArchivo of archivos) {
            const resultado = await descargarArchivoDte(userId, {
              companyId: entrada.companyId,
              periodo: entrada.periodo,
              documentoId,
              tipoArchivo,
              rutUsuario: entrada.rutUsuario,
              claveTributaria: clave,
              consentimiento: true,
            });

            creditos += resultado.creditosConsumidos;
            saldo = resultado.creditosDisponibles ?? saldo;
            if (resultado.desdeArchivoGuardado) {
              cacheHits += 1;
              evitadas += 1;
            } else if (resultado.creditosConsumidos > 0 || resultado.archivo) {
              solicitudes += 1;
            }

            const validaciones = resultado.archivo?.validaciones ?? [];
            const conDiferencia = validaciones.some((v) => v.estado !== "ok");
            const errorDocumento: CodigoErrorValidacion | null = resultado.error
              ? resultado.error === "DOCUMENTO_SIMULADO"
                ? "DTE_FILE_NOT_AVAILABLE"
                : resultado.error === "ARCHIVO_INVALIDO"
                  ? tipoArchivo === "xml"
                    ? "DTE_XML_DOWNLOAD_FAILED"
                    : "DTE_PDF_DOWNLOAD_FAILED"
                  : "DTE_FILE_NOT_AVAILABLE"
              : null;

            documentos.push({
              documentoId,
              direccion: ficha.direccion,
              dteCode: ficha.dteCode,
              folio: ficha.folio,
              tipoArchivo,
              obtenido: Boolean(resultado.archivo),
              desdeArchivoGuardado: resultado.desdeArchivoGuardado,
              archivoId: resultado.archivo?.id ?? null,
              sha256: resultado.archivo?.sha256 ?? null,
              comparacionXml:
                tipoArchivo !== "xml" || !resultado.archivo
                  ? "not_applicable"
                  : conDiferencia
                    ? "difference"
                    : "matched",
              detalleComparacion: validaciones
                .filter((v) => v.estado !== "ok")
                .map((v) => v.detalle),
              creditos: resultado.creditosConsumidos,
              errorCodigo: errorDocumento,
              mensaje: resultado.mensaje,
            });

            if (errorDocumento) {
              // No se reintenta y no se sigue gastando en este documento.
              estado = estado === "failed" ? "failed" : "partial";
              errorCodigo = errorCodigo ?? errorDocumento;
              mensaje = mensaje ?? MENSAJE_ERROR_VALIDACION[errorDocumento];
              break;
            }
          }
        }
      }
    }
  } catch (error) {
    estado = "failed";
    if (error instanceof SiiProviderError) {
      errorCodigo = errorValidacionDesdeProveedor(error.code);
      mensaje = MENSAJE_ERROR_VALIDACION[errorCodigo];
    } else if (error instanceof Error && error.name === "ErrorNegocio") {
      mensaje = error.message;
    } else {
      mensaje = "No pudimos completar la validación. No se realizaron más consultas.";
      console.error("[validacion]", error);
    }
  } finally {
    // La Clave Tributaria se descarta siempre.
    clave = null;
  }

  // ------------------------------------------------------- 3. Datos y comparación
  const total = totalOficialDeclarado(codigos);
  const comparacion = compararConMotor({
    resumen:
      resumen ??
      {
        estimatedTotal: null,
        estimatedVatPayable: null,
        estimatedPpm: null,
        estimatedWithholdings: null,
        previousCarryforward: null,
        newCarryforward: null,
        ppmRate: null,
        specialCredits: null,
        specialDebits: null,
      },
    campos:
      campos ??
      ({
        declared_vat_debit: null,
        declared_current_vat_credit: null,
        declared_previous_carryforward: null,
        declared_total_vat_credits: null,
        declared_vat_payable: null,
        declared_new_carryforward: null,
        declared_ppm_base: null,
        declared_ppm_rate: null,
        declared_ppm: null,
        declared_subtotal: null,
        declared_total_determined: null,
        declared_total_payable: null,
        declared_total_with_surcharges: null,
        declared_withholdings: null,
      } as CamposNormalizadosF29),
    total,
    esRectificatoria,
    documentosConDiferencia: documentos.filter((d) => d.comparacionXml === "difference")
      .length,
  });

  const { data: guardado } = await supabaseAdmin
    .from("tax_validation_runs")
    .insert({
      company_id: entrada.companyId,
      tax_period_id: periodId,
      period: entrada.periodo,
      validation_type: entrada.tipo,
      status: estado,
      stage: etapa,
      f29_found: f29Encontrado,
      f29_folio: f29Folio,
      f29_pdf_archived: f29PdfArchivado,
      f29_extraction_status: f29Estado,
      f29_confidence: f29Confianza,
      codes_found: codigosEncontrados(codigos) as never,
      codes_missing: codigosFaltantes(codigos) as never,
      estimated_total: comparacion.estimatedTotal,
      declared_total: comparacion.declaredTotal,
      difference: comparacion.difference,
      difference_percentage: comparacion.differencePercentage,
      explanation_codes: comparacion.explanationCodes as never,
      selected_documents: [
        entrada.documentoVentaId,
        entrada.documentoCompraId,
      ].filter(Boolean) as never,
      document_results: documentos as never,
      provider_requests: solicitudes,
      cache_hits: cacheHits,
      prevented_provider_calls: evitadas,
      actual_credits: Number(creditos.toFixed(4)),
      credits_balance: saldo,
      calls: { codigos, campos } as never,
      error_code: errorCodigo,
      error_message: mensaje,
      created_by: userId,
    } as never)
    .select("*")
    .maybeSingle();

  await registrarActividad(
    entrada.companyId,
    userId,
    "sii.validacion_oficial",
    "tax_validation_runs",
    {
      periodo: entrada.periodo,
      tipo: entrada.tipo,
      estado,
      creditos: Number(creditos.toFixed(4)),
      solicitudes,
    },
  );

  if (!guardado) throw new ErrorNegocio("No pudimos guardar el resultado de la validación.");
  return aRegistro(guardado as Record<string, unknown>);
}

/** Tarjetas ya guardadas. Solo lectura: nunca consulta al proveedor. */
export async function listarValidaciones(
  userId: string,
  entrada: { companyId: string; limite?: number },
): Promise<RegistroValidacion[]> {
  await exigirRol(userId, entrada.companyId, ["owner", "accountant"]);
  const { data } = await supabaseAdmin
    .from("tax_validation_runs")
    .select("*")
    .eq("company_id", entrada.companyId)
    .order("created_at", { ascending: false })
    .limit(entrada.limite ?? 10);
  return ((data ?? []) as Record<string, unknown>[]).map(aRegistro);
}
