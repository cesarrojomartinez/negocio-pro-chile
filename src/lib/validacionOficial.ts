/**
 * Validación de información oficial: reglas puras.
 *
 * Este módulo NO consulta al proveedor ni a la base de datos. Solo describe:
 * - qué tipos de validación existen;
 * - qué periodos son válidos (cualquier año y mes);
 * - cuántas llamadas y créditos implicaría una ejecución;
 * - qué códigos del Formulario 29 se muestran;
 * - cómo se compara el total oficial con la estimación del motor.
 *
 * No contiene lógica especial para ninguna empresa, año ni mes.
 */
import {
  CODIGOS_PRIORITARIOS,
  GRUPOS_CONSERVADOS,
  definicionDeCodigo,
  type F29Group,
} from "@/lib/f29Codes";
import type { CamposNormalizadosF29, MapaCodigos } from "@/lib/f29PdfParser";
import { RECURSOS_DTE, recursoDe } from "@/integrations/sii/apiGatewayResourceMap";
import type { TipoArchivoDte } from "@/lib/dteXmlParser";

// ---------------------------------------------------------------- tipo de prueba

export type TipoValidacion = "f29" | "f29_sale" | "f29_purchase" | "f29_both";

export const TIPOS_VALIDACION: {
  id: TipoValidacion;
  letra: string;
  titulo: string;
  descripcion: string;
}[] = [
  {
    id: "f29",
    letra: "A",
    titulo: "Solo Formulario 29",
    descripcion: "Descarga y lee el formulario oficial del periodo elegido.",
  },
  {
    id: "f29_sale",
    letra: "B",
    titulo: "Formulario 29 y una factura emitida",
    descripcion: "Agrega el archivo oficial de un documento que tú elijas.",
  },
  {
    id: "f29_purchase",
    letra: "C",
    titulo: "Formulario 29 y una factura recibida",
    descripcion: "Agrega el archivo oficial de una compra que tú elijas.",
  },
  {
    id: "f29_both",
    letra: "D",
    titulo: "Formulario 29, una emitida y una recibida",
    descripcion: "La prueba más completa: formulario y dos documentos.",
  },
];

export function documentosRequeridos(tipo: TipoValidacion): {
  venta: boolean;
  compra: boolean;
} {
  return {
    venta: tipo === "f29_sale" || tipo === "f29_both",
    compra: tipo === "f29_purchase" || tipo === "f29_both",
  };
}

// -------------------------------------------------------------------- periodos

export function esPeriodoValido(periodo: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(periodo)) return false;
  const mes = Number(periodo.slice(5, 7));
  const anio = Number(periodo.slice(0, 4));
  return mes >= 1 && mes <= 12 && anio >= 1990 && anio <= 2999;
}

export function periodoDe(anio: number, mes: number): string {
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12)
    throw new Error("Periodo fuera de rango");
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

export function partesPeriodo(periodo: string): { anio: number; mes: number } {
  if (!esPeriodoValido(periodo)) throw new Error("Periodo inválido");
  return { anio: Number(periodo.slice(0, 4)), mes: Number(periodo.slice(5, 7)) };
}

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Años elegibles. No se limita a un año en particular. */
export function aniosDisponibles(anioActual: number, haciaAtras = 12): number[] {
  return Array.from({ length: haciaAtras + 1 }, (_, i) => anioActual - i);
}

export function etiquetaPeriodo(periodo: string): string {
  const { anio, mes } = partesPeriodo(periodo);
  return `${MESES[mes - 1]} de ${anio}`;
}

// ---------------------------------------------------------------------- errores

export type CodigoErrorValidacion =
  | "F29_NOT_DECLARED"
  | "F29_FOLIO_NOT_FOUND"
  | "F29_MULTIPLE_DECLARATIONS"
  | "F29_PDF_DOWNLOAD_FAILED"
  | "F29_INVALID_PDF"
  | "F29_EXTRACTION_FAILED"
  | "F29_VALIDATION_FAILED"
  | "DTE_FILE_NOT_AVAILABLE"
  | "DTE_PROVIDER_NOT_ENABLED"
  | "DTE_PDF_DOWNLOAD_FAILED"
  | "DTE_XML_DOWNLOAD_FAILED"
  | "DTE_IDENTITY_MISMATCH"
  | "SESSION_INVALID"
  | "INVALID_CREDENTIALS";

export const MENSAJE_ERROR_VALIDACION: Record<CodigoErrorValidacion, string> = {
  F29_NOT_DECLARED:
    "Este periodo todavía no tiene un Formulario 29 declarado. El periodo sigue abierto y la información del RCV se conserva.",
  F29_FOLIO_NOT_FOUND: "El listado del SII no entregó el folio de la declaración.",
  F29_MULTIPLE_DECLARATIONS:
    "Hay más de una declaración para el periodo. Confirma cuál corresponde antes de descargar.",
  F29_PDF_DOWNLOAD_FAILED: "No pudimos descargar el formulario oficial desde el SII.",
  F29_INVALID_PDF: "El archivo recibido no es un formulario válido y no se guardó.",
  F29_EXTRACTION_FAILED: "No pudimos leer el contenido del formulario oficial.",
  F29_VALIDATION_FAILED: "Las cifras leídas no cuadran entre sí y quedan en revisión.",
  DTE_FILE_NOT_AVAILABLE:
    "El documento se encuentra registrado en el RCV, pero su archivo no está disponible mediante esta fuente.",
  DTE_PROVIDER_NOT_ENABLED:
    "La descarga de documentos individuales no está habilitada para esta empresa.",
  DTE_PDF_DOWNLOAD_FAILED: "No pudimos descargar el PDF de este documento.",
  DTE_XML_DOWNLOAD_FAILED: "No pudimos descargar el XML de este documento.",
  DTE_IDENTITY_MISMATCH:
    "El archivo recibido corresponde a otro documento: no se usó para nada.",
  SESSION_INVALID:
    "La sesión con el SII se cerró antes de terminar. Vuelve a intentarlo cuando quieras.",
  INVALID_CREDENTIALS: "El RUT o la Clave Tributaria no fueron aceptados por el SII.",
};

/** Traduce el error del extractor del F29 al catálogo de esta validación. */
export function errorValidacionDesdeF29(
  codigo: string | null,
): CodigoErrorValidacion | null {
  if (!codigo) return null;
  const mapa: Record<string, CodigoErrorValidacion> = {
    F29_NOT_DECLARED: "F29_NOT_DECLARED",
    F29_FOLIO_NOT_FOUND: "F29_FOLIO_NOT_FOUND",
    F29_MULTIPLE_DECLARATIONS: "F29_MULTIPLE_DECLARATIONS",
    F29_PDF_DOWNLOAD_FAILED: "F29_PDF_DOWNLOAD_FAILED",
    F29_INVALID_PDF: "F29_INVALID_PDF",
    F29_TEXT_EXTRACTION_FAILED: "F29_EXTRACTION_FAILED",
    F29_PARTIAL_EXTRACTION: "F29_VALIDATION_FAILED",
    F29_VALIDATION_FAILED: "F29_VALIDATION_FAILED",
    F29_RUT_MISMATCH: "F29_VALIDATION_FAILED",
    F29_PERIOD_MISMATCH: "F29_VALIDATION_FAILED",
    F29_STORAGE_FAILED: "F29_VALIDATION_FAILED",
  };
  return mapa[codigo] ?? null;
}

/** Traduce el error del proveedor al catálogo de esta validación. */
export function errorValidacionDesdeProveedor(
  codigo: string,
  tipoArchivo?: TipoArchivoDte,
): CodigoErrorValidacion {
  if (codigo === "INVALID_CREDENTIALS") return "INVALID_CREDENTIALS";
  if (["SESSION_INVALID", "SESSION_EXPIRED", "AUTH_EXPIRED"].includes(codigo))
    return "SESSION_INVALID";
  if (["NOT_AUTHORIZED", "PRODUCT_NOT_ENABLED", "COMPANY_ACCESS_DENIED"].includes(codigo))
    return "DTE_PROVIDER_NOT_ENABLED";
  if (["PERIOD_NOT_AVAILABLE", "NOT_FOUND", "DOCUMENT_NOT_FOUND"].includes(codigo))
    return "DTE_FILE_NOT_AVAILABLE";
  return tipoArchivo === "xml" ? "DTE_XML_DOWNLOAD_FAILED" : "DTE_PDF_DOWNLOAD_FAILED";
}

// ------------------------------------------------------- disponibilidad de DTE

export type EstadoArchivoDte =
  | "available"
  | "archived"
  | "unavailable"
  | "not_in_mipyme"
  | "provider_not_enabled"
  | "not_checked"
  | "error";

export const ETIQUETA_ARCHIVO_DTE: Record<EstadoArchivoDte, string> = {
  available: "Disponible para solicitar",
  archived: "Ya archivado",
  unavailable: "No disponible en esta fuente",
  not_in_mipyme: "No está en Portal MIPYME",
  provider_not_enabled: "Descarga no habilitada",
  not_checked: "Sin comprobar",
  error: "Con error en el último intento",
};

export function estadoArchivoDte(entrada: {
  archivo: { estado: string; errorCode?: string | null } | null;
  proveedorHabilitado: boolean;
  simulado: boolean;
}): EstadoArchivoDte {
  if (entrada.archivo?.estado === "stored") return "archived";
  if (entrada.simulado) return "not_in_mipyme";
  if (!entrada.proveedorHabilitado) return "provider_not_enabled";
  if (entrada.archivo?.estado === "unavailable") return "unavailable";
  if (entrada.archivo?.estado === "failed") return "error";
  if (!entrada.archivo) return "not_checked";
  return "available";
}

// ------------------------------------------------------------- previsualización

export interface LlamadaPrevista {
  etapa: string;
  recurso: string;
  seEjecuta: boolean;
  motivo: string;
  creditosEstimados: number | null;
}

export interface PlanValidacion {
  llamadas: LlamadaPrevista[];
  llamadasEstimadas: number;
  llamadasEvitadasPorCache: number;
  creditosEstimados: number;
  /** Verdadero cuando algún recurso no publica su costo por consulta. */
  costoParcialmenteDesconocido: boolean;
}

export interface EntradaPlan {
  tipo: TipoValidacion;
  /** Ya existe una lectura válida del F29 de este periodo. */
  f29Archivado: boolean;
  /** El listado de declaraciones del día ya está guardado. */
  listadoEnCache: boolean;
  documentos: {
    direccion: "sale" | "purchase";
    archivos: { tipoArchivo: TipoArchivoDte; yaArchivado: boolean }[];
  }[];
}

/** Costos vigentes según el mapa oficial de recursos. No hay precios escritos aquí. */
export function tarifarioVigente() {
  return {
    f29Listado: recursoDe("f29_periods").estimatedCredits ?? null,
    f29Pdf: recursoDe("f29_compact_pdf").estimatedCredits ?? null,
    dtePdf: RECURSOS_DTE.dte_pdf_issued.estimatedCredits,
    dteXml: RECURSOS_DTE.dte_xml_issued.estimatedCredits,
  };
}

export function planDeValidacion(entrada: EntradaPlan): PlanValidacion {
  const tarifa = tarifarioVigente();
  const llamadas: LlamadaPrevista[] = [];

  llamadas.push({
    etapa: "Listado de declaraciones",
    recurso: recursoDe("f29_periods").path,
    seEjecuta: !entrada.listadoEnCache && !entrada.f29Archivado,
    motivo: entrada.f29Archivado
      ? "El formulario de este periodo ya está leído y guardado."
      : entrada.listadoEnCache
        ? "El listado del día ya está guardado."
        : "No hay listado guardado para este periodo.",
    creditosEstimados: tarifa.f29Listado,
  });

  llamadas.push({
    etapa: "Formulario 29 compacto",
    recurso: recursoDe("f29_compact_pdf").path,
    seEjecuta: !entrada.f29Archivado,
    motivo: entrada.f29Archivado
      ? "El folio ya fue descargado: no se vuelve a pedir."
      : "Todavía no hay un formulario guardado para este periodo.",
    creditosEstimados: tarifa.f29Pdf,
  });

  for (const documento of entrada.documentos) {
    for (const archivo of documento.archivos) {
      llamadas.push({
        etapa:
          documento.direccion === "sale"
            ? `Documento emitido (${archivo.tipoArchivo.toUpperCase()})`
            : `Documento recibido (${archivo.tipoArchivo.toUpperCase()})`,
        recurso: RECURSOS_DTE[
          documento.direccion === "sale"
            ? archivo.tipoArchivo === "pdf"
              ? "dte_pdf_issued"
              : "dte_xml_issued"
            : archivo.tipoArchivo === "pdf"
              ? "dte_pdf_received"
              : "dte_xml_received"
        ].path,
        seEjecuta: !archivo.yaArchivado,
        motivo: archivo.yaArchivado
          ? "Este archivo ya está guardado: se abre sin costo."
          : "El archivo todavía no está guardado.",
        creditosEstimados: archivo.tipoArchivo === "pdf" ? tarifa.dtePdf : tarifa.dteXml,
      });
    }
  }

  const aEjecutar = llamadas.filter((l) => l.seEjecuta);
  return {
    llamadas,
    llamadasEstimadas: aEjecutar.length,
    llamadasEvitadasPorCache: llamadas.length - aEjecutar.length,
    creditosEstimados: Number(
      aEjecutar.reduce((suma, l) => suma + (l.creditosEstimados ?? 0), 0).toFixed(4),
    ),
    costoParcialmenteDesconocido: aEjecutar.some((l) => l.creditosEstimados == null),
  };
}

// ----------------------------------------------------------------- códigos F29

export interface CodigoMostrado {
  codigo: string;
  etiqueta: string;
  grupo: F29Group | null;
  valor: number | null;
  /** Texto listo para pantalla: nunca convierte un vacío en cero. */
  informado: boolean;
}

function aCodigoMostrado(codigo: string, codigos: MapaCodigos): CodigoMostrado {
  const definicion = definicionDeCodigo(codigo);
  const valor = codigos[codigo]?.normalized_value ?? null;
  return {
    codigo,
    etiqueta: definicion?.label ?? `Código ${codigo}`,
    grupo: definicion?.group ?? null,
    valor,
    informado: valor != null,
  };
}

/** Los códigos que siempre se muestran, informados o no. */
export function codigosPrioritarios(codigos: MapaCodigos): CodigoMostrado[] {
  return CODIGOS_PRIORITARIOS.map((c) => aCodigoMostrado(c, codigos));
}

/**
 * Cualquier otro código informado que pertenezca a los grupos conservados
 * (retenciones, impuesto único, honorarios, otros PPM, créditos y débitos
 * especiales, postergaciones, intereses y multas).
 */
export function codigosAdicionales(codigos: MapaCodigos): CodigoMostrado[] {
  const prioritarios = new Set<string>(CODIGOS_PRIORITARIOS);
  return Object.keys(codigos)
    .filter((c) => !prioritarios.has(c))
    .map((c) => aCodigoMostrado(c, codigos))
    .filter((c) => c.informado && c.grupo != null && GRUPOS_CONSERVADOS.includes(c.grupo))
    .sort((a, b) => Number(a.codigo) - Number(b.codigo));
}

export function codigosFaltantes(codigos: MapaCodigos): string[] {
  return CODIGOS_PRIORITARIOS.filter(
    (c) => codigos[c]?.normalized_value == null,
  ) as unknown as string[];
}

export function codigosEncontrados(codigos: MapaCodigos): string[] {
  return Object.keys(codigos)
    .filter((c) => codigos[c]?.normalized_value != null)
    .sort((a, b) => Number(a) - Number(b));
}

// -------------------------------------------------------------- total oficial

export interface TotalOficial {
  valor: number | null;
  codigo: "91" | "94" | null;
  etiqueta: string;
  conRecargos: boolean;
}

/**
 * El total oficial es el código 91 (dentro del plazo legal). El código 94 solo
 * se usa como referencia cuando el formulario informa recargos. Nunca se
 * reconstruye el total cuando el 91 está informado.
 */
export function totalOficialDeclarado(codigos: MapaCodigos): TotalOficial {
  const valor91 = codigos["91"]?.normalized_value ?? null;
  const valor94 = codigos["94"]?.normalized_value ?? null;
  const reajuste = codigos["92"]?.normalized_value ?? 0;
  const intereses = codigos["93"]?.normalized_value ?? 0;
  const hayRecargos = (reajuste ?? 0) > 0 || (intereses ?? 0) > 0;

  if (valor91 != null)
    return {
      valor: valor91,
      codigo: "91",
      etiqueta: "Total a pagar dentro del plazo legal (código 91)",
      conRecargos: false,
    };
  if (hayRecargos && valor94 != null)
    return {
      valor: valor94,
      codigo: "94",
      etiqueta: "Total a pagar con recargos (código 94)",
      conRecargos: true,
    };
  return {
    valor: null,
    codigo: null,
    etiqueta: "Total oficial no informado",
    conRecargos: false,
  };
}

// ------------------------------------------------------ comparación con motor

export interface ResumenEstimado {
  estimatedTotal: number | null;
  estimatedVatPayable: number | null;
  estimatedPpm: number | null;
  estimatedWithholdings: number | null;
  previousCarryforward: number | null;
  newCarryforward: number | null;
  ppmRate: number | null;
  specialCredits: number | null;
  specialDebits: number | null;
}

export interface ExplicacionDiferencia {
  codigo:
    | "remanente"
    | "ppm"
    | "tasa_ppm"
    | "retenciones"
    | "creditos_especiales"
    | "debitos_especiales"
    | "documentos"
    | "rectificatoria"
    | "otros_ajustes";
  etiqueta: string;
  diferencia: number | null;
  detalle: string;
}

export interface ComparacionOficial {
  estimatedTotal: number | null;
  declaredTotal: number | null;
  difference: number | null;
  differencePercentage: number | null;
  explanationCodes: ExplicacionDiferencia[];
}

function diferencia(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return Number((a - b).toFixed(2));
}

/**
 * Compara lo estimado por la aplicación con lo declarado en el F29.
 * Solo explica: nunca ajusta fórmulas ni fuerza que las cifras coincidan.
 */
export function compararConMotor(entrada: {
  resumen: ResumenEstimado;
  campos: CamposNormalizadosF29;
  total: TotalOficial;
  esRectificatoria: boolean;
  documentosConDiferencia?: number;
}): ComparacionOficial {
  const { resumen, campos, total } = entrada;
  const declarado = total.valor;
  const estimado = resumen.estimatedTotal;
  const dif = diferencia(estimado, declarado);
  const porcentaje =
    dif != null && declarado != null && declarado !== 0
      ? Number(((dif / Math.abs(declarado)) * 100).toFixed(2))
      : null;

  const explicaciones: ExplicacionDiferencia[] = [];
  const agregar = (
    codigo: ExplicacionDiferencia["codigo"],
    etiqueta: string,
    valor: number | null,
    detalle: string,
  ) => {
    if (valor != null && Math.abs(valor) >= 1) explicaciones.push({ codigo, etiqueta, diferencia: valor, detalle });
  };

  agregar(
    "remanente",
    "Remanente de crédito fiscal",
    diferencia(resumen.previousCarryforward, campos.declared_previous_carryforward),
    "El remanente considerado por la aplicación no coincide con el declarado en el formulario.",
  );
  agregar(
    "remanente",
    "Remanente para el periodo siguiente",
    diferencia(resumen.newCarryforward, campos.declared_new_carryforward),
    "El remanente que queda para el mes siguiente difiere del declarado.",
  );
  agregar(
    "ppm",
    "Pago provisional mensual",
    diferencia(resumen.estimatedPpm, campos.declared_ppm),
    "El PPM estimado difiere del declarado en el formulario.",
  );
  const difTasa = diferencia(resumen.ppmRate, campos.declared_ppm_rate);
  if (difTasa != null && Math.abs(difTasa) >= 0.01)
    explicaciones.push({
      codigo: "tasa_ppm",
      etiqueta: "Tasa de PPM",
      diferencia: difTasa,
      detalle: "La tasa usada por la aplicación no es la misma del formulario.",
    });
  agregar(
    "retenciones",
    "Retenciones",
    diferencia(resumen.estimatedWithholdings, campos.declared_withholdings),
    "Las retenciones estimadas difieren de las declaradas.",
  );
  agregar(
    "creditos_especiales",
    "Créditos especiales",
    resumen.specialCredits && resumen.specialCredits !== 0 ? resumen.specialCredits : null,
    "El periodo tiene créditos especiales registrados que pueden explicar la diferencia.",
  );
  agregar(
    "debitos_especiales",
    "Débitos especiales",
    resumen.specialDebits && resumen.specialDebits !== 0 ? resumen.specialDebits : null,
    "El periodo tiene débitos especiales registrados que pueden explicar la diferencia.",
  );
  agregar(
    "documentos",
    "Diferencias entre documentos",
    diferencia(resumen.estimatedVatPayable, campos.declared_vat_payable),
    "El IVA determinado por los documentos del RCV difiere del declarado.",
  );
  if (entrada.documentosConDiferencia && entrada.documentosConDiferencia > 0)
    explicaciones.push({
      codigo: "documentos",
      etiqueta: "Documentos con diferencias respecto del archivo oficial",
      diferencia: entrada.documentosConDiferencia,
      detalle: "Algún documento revisado no coincide con el registro guardado.",
    });
  if (entrada.esRectificatoria)
    explicaciones.push({
      codigo: "rectificatoria",
      etiqueta: "Declaración rectificatoria",
      diferencia: null,
      detalle: "El formulario vigente es una rectificatoria del periodo.",
    });

  if (dif != null && Math.abs(dif) >= 1 && explicaciones.length === 0)
    explicaciones.push({
      codigo: "otros_ajustes",
      etiqueta: "Otros ajustes",
      diferencia: dif,
      detalle:
        "La diferencia no se explica por los componentes conocidos. Revísala con tu contador.",
    });

  return {
    estimatedTotal: estimado,
    declaredTotal: declarado,
    difference: dif,
    differencePercentage: porcentaje,
    explanationCodes: explicaciones,
  };
}
