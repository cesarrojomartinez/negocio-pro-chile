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

/**
 * Tipos que el SII informa SOLO como total mensual agregado, sin detalle
 * documento por documento (boletas electrónicas, boletas exentas y
 * comprobantes de pago electrónico). Pedirles el detalle devuelve vacío y
 * gasta créditos, y su cantidad NO debe compararse con lo guardado.
 */
export const TIPOS_SOLO_RESUMEN_MENSUAL = new Set([39, 41, 48]);

/**
 * Tipos de DTE que el resumen declara con documentos Y tienen detalle
 * disponible en el RCV: guía del detalle.
 */
export function tiposConDocumentos(resumen: ProviderRcvSummary): number[] {
  return resumen.lines
    .filter(
      (l) => l.documentCount > 0 && !TIPOS_SOLO_RESUMEN_MENSUAL.has(l.documentTypeCode),
    )
    .map((l) => l.documentTypeCode);
}

/** Documentos informados que sí deberían llegar uno a uno en el detalle. */
export function documentosConDetalleEsperados(resumen: ProviderRcvSummary): number {
  return resumen.lines
    .filter((l) => !TIPOS_SOLO_RESUMEN_MENSUAL.has(l.documentTypeCode))
    .reduce((s, l) => s + l.documentCount, 0);
}

/** Documentos que el SII solo entrega como total del mes (boletas y similares). */
export function documentosSoloResumenMensual(resumen: ProviderRcvSummary): number {
  return resumen.lines
    .filter((l) => TIPOS_SOLO_RESUMEN_MENSUAL.has(l.documentTypeCode))
    .reduce((s, l) => s + l.documentCount, 0);
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


/** Totales de las líneas que el SII solo informa como agregado mensual. */
export interface TotalesAgregadosMensuales {
  cantidadDocumentos: number;
  neto: number;
  iva: number;
  exento: number;
  total: number;
}

/**
 * Suma las líneas del resumen que NO tienen detalle documento por documento
 * (boletas electrónicas, boletas exentas y comprobantes de pago electrónico).
 * Son cifras oficiales del SII: se usan para completar los totales del periodo
 * sin inventar documentos individuales.
 */
export function totalesSoloResumenMensual(
  resumen: ProviderRcvSummary | null | undefined,
): TotalesAgregadosMensuales {
  const vacio: TotalesAgregadosMensuales = {
    cantidadDocumentos: 0,
    neto: 0,
    iva: 0,
    exento: 0,
    total: 0,
  };
  if (!resumen || !Array.isArray(resumen.lines)) return vacio;
  return resumen.lines
    .filter((l) => TIPOS_SOLO_RESUMEN_MENSUAL.has(l.documentTypeCode))
    .reduce(
      (acc, l) => ({
        cantidadDocumentos: acc.cantidadDocumentos + l.documentCount,
        neto: acc.neto + l.taxEffect * l.netAmount,
        iva: acc.iva + l.taxEffect * l.vatAmount,
        exento: acc.exento + l.taxEffect * l.exemptAmount,
        total: acc.total + l.taxEffect * l.totalAmount,
      }),
      vacio,
    );
}

/**
 * Lee el resumen guardado del periodo (`tax_periods.rcv_summary`) y devuelve
 * las ventas informadas solo como total del mes. Devuelve `null` cuando no hay
 * agregados, para no alterar los totales de periodos con detalle completo.
 */
export function ventasAgregadasDeResumenGuardado(
  rcvSummary: unknown,
): TotalesAgregadosMensuales | null {
  const ventas = resumenGuardado(rcvSummary, "ventas");
  if (!ventas) return null;
  const t = totalesSoloResumenMensual(ventas);
  return t.total === 0 && t.iva === 0 && t.cantidadDocumentos === 0 ? null : t;
}

// ---------------------------------------------------------------------------
// Agregados por categoría: permiten calcular el periodo completo desde el
// RESUMEN oficial cuando no se descargó el detalle documento por documento.
// ---------------------------------------------------------------------------

/** Boletas y comprobantes de pago electrónico (nunca tienen detalle individual). */
export const TIPOS_BOLETA = new Set([35, 38, 39, 41, 48]);

export type CategoriaDte = "factura" | "boleta" | "notaCredito";

/** Categoría comercial de un tipo de DTE. Nunca se infiere un código nuevo. */
export function categoriaDte(codigo: number): CategoriaDte {
  if (DTE_EFECTO_NEGATIVO.has(codigo)) return "notaCredito";
  return TIPOS_BOLETA.has(codigo) ? "boleta" : "factura";
}

export interface AgregadoDte {
  cantidad: number;
  neto: number;
  iva: number;
  exento: number;
  total: number;
}

export const AGREGADO_VACIO: AgregadoDte = {
  cantidad: 0,
  neto: 0,
  iva: 0,
  exento: 0,
  total: 0,
};

export type AgregadosPorCategoria = Record<CategoriaDte, AgregadoDte>;

export const AGREGADOS_VACIOS: AgregadosPorCategoria = {
  factura: AGREGADO_VACIO,
  boleta: AGREGADO_VACIO,
  notaCredito: AGREGADO_VACIO,
};

/**
 * Suma las líneas del resumen oficial agrupadas por categoría comercial.
 * Los montos se devuelven en valor absoluto: el signo lo aporta la categoría,
 * exactamente igual que con los documentos individuales.
 */
export function agregadosPorCategoria(
  resumen: ProviderRcvSummary | null | undefined,
): AgregadosPorCategoria {
  const acumular: AgregadosPorCategoria = {
    factura: { ...AGREGADO_VACIO },
    boleta: { ...AGREGADO_VACIO },
    notaCredito: { ...AGREGADO_VACIO },
  };
  if (!resumen || !Array.isArray(resumen.lines)) return acumular;
  for (const l of resumen.lines) {
    const destino = acumular[categoriaDte(l.documentTypeCode)];
    destino.cantidad += Math.max(0, Math.round(l.documentCount));
    destino.neto += Math.abs(l.netAmount);
    destino.iva += Math.abs(l.vatAmount);
    destino.exento += Math.abs(l.exemptAmount);
    destino.total += Math.abs(l.totalAmount);
  }
  return acumular;
}

function resumenGuardado(
  rcvSummary: unknown,
  clave: "ventas" | "compras",
): ProviderRcvSummary | null {
  const valor =
    rcvSummary && typeof rcvSummary === "object"
      ? (rcvSummary as Record<string, unknown>)[clave]
      : null;
  return valor && typeof valor === "object" ? (valor as ProviderRcvSummary) : null;
}

/**
 * Agregados de VENTAS a partir del resumen guardado.
 *
 * - `conDetalleGuardado = true` (el periodo tiene documentos individuales):
 *   solo se agregan boletas y comprobantes, exactamente como hasta ahora.
 * - `conDetalleGuardado = false` (actualización económica: no se descargó el
 *   detalle): se agregan también facturas y notas de crédito, para que los
 *   totales del periodo sean los mismos que se obtenían con el detalle.
 */
export function agregadosVentasDeResumen(
  rcvSummary: unknown,
  conDetalleGuardado: boolean,
): (TotalesAgregadosMensuales & {
  facturas?: AgregadoDte;
  notasCredito?: AgregadoDte;
}) | null {
  const ventas = resumenGuardado(rcvSummary, "ventas");
  if (!ventas) return null;
  if (conDetalleGuardado) return ventasAgregadasDeResumenGuardado(rcvSummary);

  const cat = agregadosPorCategoria(ventas);
  const boleta = cat.boleta;
  const vacio =
    boleta.total === 0 &&
    cat.factura.total === 0 &&
    cat.notaCredito.total === 0 &&
    boleta.cantidad + cat.factura.cantidad + cat.notaCredito.cantidad === 0;
  if (vacio) return null;
  return {
    cantidadDocumentos: boleta.cantidad,
    neto: boleta.neto,
    iva: boleta.iva,
    exento: boleta.exento,
    total: boleta.total,
    facturas: cat.factura,
    notasCredito: cat.notaCredito,
  };
}

/**
 * Agregados de COMPRAS a partir del resumen guardado. Solo se usan cuando el
 * periodo no tiene documentos de compra individuales.
 */
export function agregadosComprasDeResumen(
  rcvSummary: unknown,
  conDetalleGuardado: boolean,
): { facturas: AgregadoDte; notasCredito: AgregadoDte } | null {
  if (conDetalleGuardado) return null;
  const compras = resumenGuardado(rcvSummary, "compras");
  if (!compras) return null;
  const cat = agregadosPorCategoria(compras);
  // Las boletas de compra no dan crédito y no aparecen en el RCV de compras;
  // si llegaran, se suman al bloque de facturas para no perder el monto.
  const facturas: AgregadoDte = {
    cantidad: cat.factura.cantidad + cat.boleta.cantidad,
    neto: cat.factura.neto + cat.boleta.neto,
    iva: cat.factura.iva + cat.boleta.iva,
    exento: cat.factura.exento + cat.boleta.exento,
    total: cat.factura.total + cat.boleta.total,
  };
  if (facturas.total === 0 && cat.notaCredito.total === 0 && facturas.cantidad === 0)
    return null;
  return { facturas, notasCredito: cat.notaCredito };
}

