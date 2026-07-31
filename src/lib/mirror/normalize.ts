/**
 * Normalización sin pérdida para el Motor Espejo.
 *
 * Convierte resúmenes RCV persistidos, códigos del F29 y antecedentes
 * confirmados en `NormalizedTaxFact[]`. No modifica el snapshot original, no
 * reclasifica un DTE en varias capas y nunca convierte un dato ausente en
 * cero.
 *
 * Módulo puro: sin red, sin reloj, sin base de datos.
 */
import { resolverReglaDte } from "./dteTaxRules";
import {
  MIRROR_NORMALIZATION_VERSION,
  type MirrorGranularity,
  type MirrorLedger,
  type MirrorSourceStatus,
  type NormalizedTaxFact,
} from "./types";

/** Hash determinístico y estable del origen. No es criptográfico. */
export function hashOrigen(valor: unknown): string {
  const texto = JSON.stringify(valor ?? null);
  let h = 5381;
  for (let i = 0; i < texto.length; i += 1) {
    h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  }
  return `h${h.toString(16)}`;
}

/** Número o `null`. Un valor ausente jamás se transforma en cero. */
export function numeroONulo(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

export interface LineaResumenNormalizable {
  documentTypeCode?: number | null;
  documentCount?: number | null;
  netAmount?: number | null;
  vatAmount?: number | null;
  exemptAmount?: number | null;
  vatCommonUse?: number | null;
  vatNonRecoverable?: number | null;
  totalAmount?: number | null;
  taxEffect?: number | null;
}

export interface ResumenNormalizable {
  lines?: LineaResumenNormalizable[] | null;
  documentCount?: number | null;
  netAmount?: number | null;
  vatAmount?: number | null;
  exemptAmount?: number | null;
  totalAmount?: number | null;
  unclassifiedAmount?: number | null;
}

export interface ContextoNormalizacion {
  companyId?: string | null;
  accountId?: string | null;
  period: string;
  snapshotId?: string | null;
  adapterVersion?: string | null;
  source: string;
  sourceStatus?: MirrorSourceStatus;
}

function base(
  ctx: ContextoNormalizacion,
  ledger: MirrorLedger,
  granularity: MirrorGranularity,
  rawHash: string,
): NormalizedTaxFact {
  return {
    companyId: ctx.companyId ?? null,
    accountId: ctx.accountId ?? null,
    period: ctx.period,
    ledger,
    documentType: null,
    documentNature: null,
    documentCount: null,
    taxEffect: null,
    taxableNet: null,
    exemptAmount: null,
    nonTaxableAmount: null,
    vatAmount: null,
    vatCommonUse: null,
    vatNonRecoverable: null,
    otherTaxes: null,
    totalAmount: null,
    unclassifiedAmount: null,
    granularity,
    source: ctx.source,
    sourceStatus: ctx.sourceStatus ?? "official",
    snapshotId: ctx.snapshotId ?? null,
    adapterVersion: ctx.adapterVersion ?? null,
    normalizationVersion: MIRROR_NORMALIZATION_VERSION,
    rawHash,
  };
}

/**
 * Normaliza un resumen RCV. Genera una fila por tipo de documento más una
 * fila agregada del mes que conserva el total oficial y el monto no
 * clasificado tal como los informó el SII.
 */
export function normalizarResumenRcv(
  resumen: ResumenNormalizable | null | undefined,
  ledger: MirrorLedger,
  ctx: ContextoNormalizacion,
): NormalizedTaxFact[] {
  if (!resumen) return [];
  const hechos: NormalizedTaxFact[] = [];

  for (const linea of resumen.lines ?? []) {
    const codigo = numeroONulo(linea.documentTypeCode);
    const regla = resolverReglaDte(codigo, ctx.period);
    const efectoLeido = numeroONulo(linea.taxEffect);
    const efecto: 1 | -1 | null =
      efectoLeido === -1 ? -1 : efectoLeido === 1 ? 1 : (regla?.taxEffect ?? null);
    hechos.push({
      ...base(ctx, ledger, "document_type_summary", hashOrigen(linea)),
      documentType: codigo,
      documentNature: regla?.documentNature ?? "unknown",
      documentCount: numeroONulo(linea.documentCount),
      taxEffect: efecto,
      taxableNet: numeroONulo(linea.netAmount),
      exemptAmount: numeroONulo(linea.exemptAmount),
      vatAmount: numeroONulo(linea.vatAmount),
      vatCommonUse: numeroONulo(linea.vatCommonUse),
      vatNonRecoverable: numeroONulo(linea.vatNonRecoverable),
      totalAmount: numeroONulo(linea.totalAmount),
      sourceStatus: ctx.sourceStatus ?? (regla ? "official" : "partial"),
    });
  }

  hechos.push({
    ...base(ctx, ledger, "monthly_summary", hashOrigen({ resumen: "total", ...resumen })),
    documentCount: numeroONulo(resumen.documentCount),
    taxableNet: numeroONulo(resumen.netAmount),
    exemptAmount: numeroONulo(resumen.exemptAmount),
    vatAmount: numeroONulo(resumen.vatAmount),
    totalAmount: numeroONulo(resumen.totalAmount),
    unclassifiedAmount: numeroONulo(resumen.unclassifiedAmount),
  });

  return hechos;
}

/** Códigos del F29 que representan montos del libro oficial. */
const CODIGOS_MONETARIOS_F29 = new Set([
  "502",
  "504",
  "510",
  "511",
  "520",
  "528",
  "537",
  "538",
  "543",
  "547",
  "556",
  "557",
  "563",
  "573",
  "595",
  "598",
  "62",
  "77",
  "89",
  "91",
  "142",
  "151",
]);

/**
 * Normaliza los códigos de un F29. Cada código presente genera un hecho
 * oficial; un código ausente simplemente no genera hecho (nunca un cero).
 */
export function normalizarCodigosF29(
  codigos: Record<string, unknown> | null | undefined,
  ctx: ContextoNormalizacion,
): NormalizedTaxFact[] {
  if (!codigos) return [];
  const hechos: NormalizedTaxFact[] = [];
  for (const [codigo, valor] of Object.entries(codigos)) {
    if (!CODIGOS_MONETARIOS_F29.has(codigo)) continue;
    const monto = numeroONulo(valor);
    if (monto == null) continue;
    hechos.push({
      ...base(ctx, "f29", "official_form", hashOrigen({ codigo, monto })),
      totalAmount: monto,
      sourceStatus: ctx.sourceStatus ?? "official",
      documentNature: null,
      source: `${ctx.source}:${codigo}`,
    });
  }
  return hechos;
}

/** Normaliza antecedentes confirmados por el contador. */
export function normalizarAntecedenteConfirmado(
  valores: Record<string, unknown> | null | undefined,
  ctx: ContextoNormalizacion,
): NormalizedTaxFact[] {
  if (!valores) return [];
  const hechos: NormalizedTaxFact[] = [];
  for (const [clave, valor] of Object.entries(valores)) {
    const monto = numeroONulo(valor);
    if (monto == null) continue;
    hechos.push({
      ...base(
        ctx,
        "historical_context",
        "manually_confirmed",
        hashOrigen({ clave, monto }),
      ),
      totalAmount: monto,
      sourceStatus: "confirmed",
      source: `${ctx.source}:${clave}`,
    });
  }
  return hechos;
}

/** Clave de unicidad de un hecho, alineada con el índice de la base. */
export function claveHecho(h: NormalizedTaxFact): string {
  return [
    h.companyId ?? "",
    h.period,
    h.ledger,
    h.documentType ?? "",
    h.source,
    h.rawHash,
    h.normalizationVersion,
  ].join("|");
}

/** Elimina duplicados exactos conservando el primero. */
export function deduplicarHechos(hechos: NormalizedTaxFact[]): NormalizedTaxFact[] {
  const vistos = new Set<string>();
  const salida: NormalizedTaxFact[] = [];
  for (const h of hechos) {
    const k = claveHecho(h);
    if (vistos.has(k)) continue;
    vistos.add(k);
    salida.push(h);
  }
  return salida;
}
