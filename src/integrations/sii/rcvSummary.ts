/**
 * Lectura del RESUMEN del RCV (ventas y compras).
 *
 * El resumen y el detalle NO tienen la misma estructura y aquí se tratan por
 * separado: el resumen alimenta los totales informados por el SII (cantidad de
 * documentos, neto, IVA, exento, total y tipos de DTE disponibles) y el detalle
 * alimenta los documentos individuales.
 *
 * Campos oficiales (esquema OpenAPI V2): `rsmnTipoDocInteger`, `rsmnTotDoc`,
 * `rsmnMntNeto`, `rsmnMntIVA`, `rsmnMntExe`, `rsmnMntTotal`, `rsmnIVAUsoComun`,
 * `rsmnMntIVANoRec`.
 *
 * Módulo puro: sin red, sin reloj, sin base de datos.
 */
import type { ProviderRcvSummary, ProviderRcvSummaryLine } from "./contracts";

/** Tipos de DTE cuyo efecto tributario es negativo (notas de crédito). */
export const DTE_EFECTO_NEGATIVO = new Set([60, 61, 112]);

export interface FilaResumenRcv {
  rsmnTipoDocInteger?: number | string | null;
  rsmnTotDoc?: number | string | null;
  rsmnMntNeto?: number | string | null;
  rsmnMntIVA?: number | string | null;
  rsmnMntExe?: number | string | null;
  rsmnMntTotal?: number | string | null;
  rsmnIVAUsoComun?: number | string | null;
  rsmnMntIVANoRec?: number | string | null;
  dcvNombreTipoDoc?: string | null;
}

/** Convierte a número tolerando strings del proveedor. Nunca devuelve NaN. */
export function aNumero(valor: unknown): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  if (typeof valor === "string") {
    const limpio = valor.replace(/\./g, "").replace(",", ".").trim();
    const n = Number(limpio);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function aEntero(valor: unknown): number | null {
  const n = aNumero(valor);
  return n === 0 && valor == null ? null : Math.round(n);
}

/**
 * Convierte las filas crudas del resumen en líneas normalizadas.
 * No descarta una fila porque sus montos no cuadren: el total informado por el
 * SII se conserva tal cual y la diferencia se expone como `unclassifiedAmount`.
 */
export function construirResumenRcv(filas: FilaResumenRcv[]): ProviderRcvSummary {
  const lines: ProviderRcvSummaryLine[] = [];

  for (const fila of filas) {
    const codigo = aEntero(fila.rsmnTipoDocInteger);
    if (codigo == null || codigo <= 0) continue;
    const documentCount = Math.max(0, Math.round(aNumero(fila.rsmnTotDoc)));
    lines.push({
      documentTypeCode: codigo,
      documentTypeLabel: (fila.dcvNombreTipoDoc ?? "").trim() || null,
      documentCount,
      netAmount: aNumero(fila.rsmnMntNeto),
      vatAmount: aNumero(fila.rsmnMntIVA),
      exemptAmount: aNumero(fila.rsmnMntExe),
      vatCommonUse: aNumero(fila.rsmnIVAUsoComun),
      vatNonRecoverable: aNumero(fila.rsmnMntIVANoRec),
      // Valor oficial del SII: se preserva exactamente como llega.
      totalAmount: aNumero(fila.rsmnMntTotal),
      taxEffect: DTE_EFECTO_NEGATIVO.has(codigo) ? -1 : 1,
    });
  }

  const sumar = (f: (l: ProviderRcvSummaryLine) => number) =>
    lines.reduce((s, l) => s + l.taxEffect * f(l), 0);

  const netAmount = sumar((l) => l.netAmount);
  const vatAmount = sumar((l) => l.vatAmount);
  const exemptAmount = sumar((l) => l.exemptAmount);
  const totalAmount = sumar((l) => l.totalAmount);

  return {
    lines,
    // Cantidad informada: todos los documentos, incluidas las notas de crédito.
    documentCount: lines.reduce((s, l) => s + l.documentCount, 0),
    netAmount,
    vatAmount,
    exemptAmount,
    totalAmount,
    /**
     * Diferencia aritmética entre el total oficial y las partidas conocidas.
     * Solo sirve para conciliación: no se presenta como un impuesto específico
     * mientras no se conozca su naturaleza, y nunca invalida el registro.
     */
    unclassifiedAmount:
      totalAmount -
      netAmount -
      vatAmount -
      exemptAmount -
      sumar((l) => l.vatCommonUse) -
      sumar((l) => l.vatNonRecoverable),
  };
}

/** Tipos de DTE que el resumen declara con documentos: guía del detalle. */
export function tiposConDocumentos(resumen: ProviderRcvSummary): number[] {
  return resumen.lines.filter((l) => l.documentCount > 0).map((l) => l.documentTypeCode);
}

export const RESUMEN_VACIO: ProviderRcvSummary = {
  lines: [],
  documentCount: 0,
  netAmount: 0,
  vatAmount: 0,
  exemptAmount: 0,
  totalAmount: 0,
  unclassifiedAmount: 0,
};

/** Une varios resúmenes (por ejemplo, los cuatro estados de compras). */
export function sumarResumenes(resumenes: ProviderRcvSummary[]): ProviderRcvSummary {
  const lines = resumenes.flatMap((r) => r.lines);
  const sumar = (f: (r: ProviderRcvSummary) => number) =>
    resumenes.reduce((s, r) => s + f(r), 0);
  return {
    lines,
    documentCount: sumar((r) => r.documentCount),
    netAmount: sumar((r) => r.netAmount),
    vatAmount: sumar((r) => r.vatAmount),
    exemptAmount: sumar((r) => r.exemptAmount),
    totalAmount: sumar((r) => r.totalAmount),
    unclassifiedAmount: sumar((r) => r.unclassifiedAmount),
  };
}

