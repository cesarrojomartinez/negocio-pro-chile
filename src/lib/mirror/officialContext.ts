/**
 * Contexto oficial histórico del Motor Espejo.
 *
 * Resuelve, por separado y sin suposiciones: F29 del periodo, F29 anterior
 * vigente, remanente, tasa y base de PPM, PPM declarado, retenciones,
 * anticipo por cambio de sujeto, código 91, folio y estado de declaración.
 *
 * Reglas duras:
 *  - un código ausente es `null`, jamás cero;
 *  - presentado no significa pagado: `paymentStatus` parte en `unknown`;
 *  - una tasa anterior no se considera vigente indefinidamente.
 *
 * Módulo puro.
 */
import type {
  DeclarationStatus,
  ExtractionStatus,
  HistoricalOfficialContext,
  MirrorConfidence,
  PaymentStatus,
} from "./types";

export const CODIGO = {
  debitoTotal: "538",
  creditoDocumentos: "511",
  creditoTotalConRemanente: "537",
  creditoDelMesConNoRecuperable: "520",
  ivaNoRecuperable: "528",
  remanenteAnterior: "504",
  remanenteSiguiente: "77",
  ivaDeterminado: "89",
  basePpm: "563",
  tasaPpm: "115",
  ppm: "62",
  retenciones: "151",
  anticipoDelMes: "556",
  anticipoRemanenteAnterior: "557",
  anticipoDisponible: "543",
  anticipoImputado: "598",
  anticipoRemanenteSiguiente: "573",
  subtotalDeterminado: "547",
  totalAPagar: "91",
  ventasExentas: "142",
} as const;

export interface EntradaContextoOficial {
  period: string;
  codes?: Record<string, unknown> | null;
  folio?: string | null;
  declarationStatus?: string | null;
  extractionStatus?: string | null;
  confidence?: string | null;
  filedAt?: string | null;
  source?: string | null;
  /** Evidencia de pago independiente del F29. Sin ella, el pago es desconocido. */
  paymentEvidence?: boolean | null;
}

function normalizarCodigos(codes: Record<string, unknown> | null | undefined) {
  const salida: Record<string, number> = {};
  for (const [k, v] of Object.entries(codes ?? {})) {
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) salida[String(k)] = n;
  }
  return salida;
}

function estadoDeclaracion(valor: string | null | undefined): DeclarationStatus {
  if (valor === "filed" || valor === "pending" || valor === "rectified") return valor;
  return "unknown";
}

function estadoExtraccion(valor: string | null | undefined): ExtractionStatus {
  if (valor === "valid" || valor === "partial" || valor === "needs_review") return valor;
  return "unknown";
}

function confianza(valor: string | null | undefined): MirrorConfidence {
  if (valor === "high" || valor === "alta") return "high";
  if (valor === "medium" || valor === "media") return "medium";
  if (valor === "low" || valor === "baja") return "low";
  return "unknown";
}

export function construirContextoOficial(
  entrada: EntradaContextoOficial,
): HistoricalOfficialContext {
  const paymentStatus: PaymentStatus = entrada.paymentEvidence === true ? "paid" : "unknown";
  return {
    period: entrada.period,
    folio: entrada.folio ?? null,
    codes: normalizarCodigos(entrada.codes),
    declarationStatus: estadoDeclaracion(entrada.declarationStatus),
    extractionStatus: estadoExtraccion(entrada.extractionStatus),
    confidence: confianza(entrada.confidence),
    filedAt: entrada.filedAt ?? null,
    paymentStatus,
    source: entrada.source ?? "f29",
  };
}

/** Lee un código. Ausente → `null`. Presente en cero → `0`. */
export function leerCodigo(
  ctx: HistoricalOfficialContext | null | undefined,
  codigo: string,
): number | null {
  if (!ctx) return null;
  const v = ctx.codes[codigo];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Un contexto solo sirve como referencia oficial cuando la extracción es
 * confiable. Una extracción `partial` o `needs_review` queda como candidata.
 */
export function esReferenciaOficialConfiable(
  ctx: HistoricalOfficialContext | null | undefined,
): boolean {
  if (!ctx) return false;
  if (ctx.extractionStatus === "partial" || ctx.extractionStatus === "needs_review") return false;
  if (ctx.confidence === "low") return false;
  return ctx.declarationStatus === "filed" || ctx.declarationStatus === "rectified";
}

export type PromotionStatus = "promoted" | "candidate" | "rejected";

export interface EvaluacionRectificatoria {
  candidateFolio: string | null;
  currentOfficialFolio: string | null;
  candidateConfidence: MirrorConfidence;
  promotionStatus: PromotionStatus;
  promotionReason: string;
}

/**
 * Decide si una extracción candidata puede reemplazar la referencia oficial
 * vigente del espejo. Nunca cambia el comportamiento productivo.
 */
export function evaluarRectificatoria(
  candidato: HistoricalOfficialContext | null,
  vigente: HistoricalOfficialContext | null,
): EvaluacionRectificatoria {
  const base: EvaluacionRectificatoria = {
    candidateFolio: candidato?.folio ?? null,
    currentOfficialFolio: vigente?.folio ?? null,
    candidateConfidence: candidato?.confidence ?? "unknown",
    promotionStatus: "candidate",
    promotionReason: "",
  };
  if (!candidato) {
    return { ...base, promotionStatus: "rejected", promotionReason: "sin_extraccion" };
  }
  if (!esReferenciaOficialConfiable(candidato)) {
    return {
      ...base,
      promotionStatus: "candidate",
      promotionReason: `extraccion_${candidato.extractionStatus}_confianza_${candidato.confidence}`,
    };
  }
  if (vigente && candidato.folio && vigente.folio && candidato.folio === vigente.folio) {
    return { ...base, promotionStatus: "promoted", promotionReason: "mismo_folio_vigente" };
  }
  return { ...base, promotionStatus: "promoted", promotionReason: "extraccion_valida" };
}
