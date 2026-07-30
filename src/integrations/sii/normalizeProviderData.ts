/**
 * Normalización de la información del proveedor hacia el modelo interno.
 *
 * Funciones puras y testeables: no acceden a la base de datos ni al reloj.
 * Toda validación defensiva ocurre aquí, de modo que un dato inconsistente
 * del proveedor nunca llegue al motor de cálculo.
 */
import type {
  ProviderDocument,
  ProviderF29Entry,
  ProviderPurchasesResult,
  ProviderSalesResult,
  ProviderWithholdingsResult,
} from "./contracts";

const TASA_IVA = 0.19;

export interface FilaDocumentoNormalizada {
  external_id: string;
  document_direction: "sale" | "purchase";
  document_type: string;
  folio: number;
  document_date: string;
  counterparty_name: string;
  counterparty_rut: string | null;
  net_amount: number;
  vat_amount: number;
  exempt_amount: number;
  total_amount: number;
  rcv_status: "registered" | "pending" | "claimed" | "excluded" | "accepted" | "unknown";
  raw_metadata: Record<string, string | number | boolean | null>;
}

export interface ResultadoNormalizacion {
  documentos: FilaDocumentoNormalizada[];
  descartados: { externalId: string; motivo: string }[];
  /** Documentos cuyo IVA hubo que inferir desde el total. */
  inferidos: number;
}

function esFechaDelPeriodo(fecha: string, periodo: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha.slice(0, 7) === periodo;
}

function normalizarMontos(doc: ProviderDocument): {
  neto: number;
  iva: number;
  exento: number;
  total: number;
  inferido: boolean;
} {
  const total = Math.max(0, Math.round(doc.totalAmount || 0));
  const exento = Math.max(0, Math.round(doc.exemptAmount ?? 0));
  if (doc.netAmount != null && doc.vatAmount != null) {
    return {
      neto: Math.max(0, Math.round(doc.netAmount)),
      iva: Math.max(0, Math.round(doc.vatAmount)),
      exento,
      total,
      inferido: false,
    };
  }
  // Sin desglose: se infiere el neto y el IVA desde el total afecto.
  const afecto = Math.max(0, total - exento);
  const neto = Math.round(afecto / (1 + TASA_IVA));
  return { neto, iva: afecto - neto, exento, total, inferido: true };
}

function normalizarDocumento(
  doc: ProviderDocument,
  direccion: "sale" | "purchase",
  periodo: string,
): { fila: FilaDocumentoNormalizada; inferido: boolean } | { motivo: string } {
  if (!doc.externalId) return { motivo: "Sin identificador del proveedor" };
  if (!esFechaDelPeriodo(doc.issueDate, periodo))
    return { motivo: "Fecha fuera del periodo consultado" };
  if (!Number.isFinite(doc.totalAmount) || doc.totalAmount < 0)
    return { motivo: "Monto total inválido" };
  if (!Number.isFinite(doc.folio) || doc.folio <= 0)
    return { motivo: "Folio inválido" };

  const m = normalizarMontos(doc);
  const esNotaCredito = doc.documentType === "notaCredito";

  return {
    inferido: m.inferido,
    fila: {
      external_id: doc.externalId,
      document_direction: direccion,
      document_type: doc.documentType,
      folio: Math.round(doc.folio),
      document_date: doc.issueDate,
      counterparty_name: doc.counterpartyName?.trim() || "Sin identificar",
      counterparty_rut: doc.counterpartyRut?.trim() || null,
      net_amount: esNotaCredito ? -Math.abs(m.neto) : m.neto,
      vat_amount: esNotaCredito ? -Math.abs(m.iva) : m.iva,
      exempt_amount: esNotaCredito ? -Math.abs(m.exento) : m.exento,
      total_amount: esNotaCredito ? -Math.abs(m.total) : m.total,
      rcv_status: doc.rcvStatus,
      raw_metadata: {
        origen: "proveedor_simulado",
        ivaInferido: m.inferido,
      },
    },
  };
}

/** Elimina duplicados por identificador externo conservando el último recibido. */
function deduplicar(filas: FilaDocumentoNormalizada[]): FilaDocumentoNormalizada[] {
  const mapa = new Map<string, FilaDocumentoNormalizada>();
  for (const fila of filas) mapa.set(fila.external_id, fila);
  return [...mapa.values()];
}

export function normalizarVentas(
  resultado: ProviderSalesResult,
): ResultadoNormalizacion {
  const documentos: FilaDocumentoNormalizada[] = [];
  const descartados: ResultadoNormalizacion["descartados"] = [];
  let inferidos = 0;

  for (const doc of resultado.documents) {
    const r = normalizarDocumento(doc, "sale", resultado.period);
    if ("motivo" in r) {
      descartados.push({ externalId: doc.externalId, motivo: r.motivo });
      continue;
    }
    if (r.inferido) inferidos += 1;
    documentos.push(r.fila);
  }

  return { documentos: deduplicar(documentos), descartados, inferidos };
}

export function normalizarCompras(
  resultado: ProviderPurchasesResult,
): ResultadoNormalizacion {
  const documentos: FilaDocumentoNormalizada[] = [];
  const descartados: ResultadoNormalizacion["descartados"] = [];
  let inferidos = 0;

  for (const grupo of Object.values(resultado.byStatus)) {
    for (const doc of grupo) {
      const r = normalizarDocumento(doc, "purchase", resultado.period);
      if ("motivo" in r) {
        descartados.push({ externalId: doc.externalId, motivo: r.motivo });
        continue;
      }
      if (r.inferido) inferidos += 1;
      documentos.push(r.fila);
    }
  }

  return { documentos: deduplicar(documentos), descartados, inferidos };
}

export interface FilaF29Normalizada {
  period: string;
  declaration_status: "filed" | "pending" | "not_available";
  declared_vat: number | null;
  declared_ppm: number | null;
  declared_withholdings: number | null;
  declared_total: number | null;
  vat_carryforward: number | null;
  filed_at: string | null;
}

export function normalizarF29(entradas: ProviderF29Entry[]): FilaF29Normalizada[] {
  const mapa = new Map<string, FilaF29Normalizada>();
  for (const e of entradas) {
    if (!/^\d{4}-\d{2}$/.test(e.period)) continue;
    const declarado = e.status === "filed";
    mapa.set(e.period, {
      period: e.period,
      declaration_status: e.status,
      declared_vat: declarado ? Math.round(e.declaredVat ?? 0) : null,
      declared_ppm: declarado ? Math.round(e.declaredPpm ?? 0) : null,
      declared_withholdings: declarado ? Math.round(e.declaredWithholdings ?? 0) : null,
      declared_total: declarado ? Math.round(e.declaredTotal ?? 0) : null,
      vat_carryforward: declarado ? Math.round(e.vatCarryforward ?? 0) : null,
      filed_at: declarado ? e.filedAt : null,
    });
  }
  return [...mapa.values()].sort((a, b) => b.period.localeCompare(a.period));
}

export function normalizarRetenciones(
  resultado: ProviderWithholdingsResult,
): { total: number; detalle: { concepto: string; monto: number }[] } {
  const detalle = resultado.detail
    .filter((d) => Number.isFinite(d.amount) && d.amount > 0)
    .map((d) => ({ concepto: d.concept, monto: Math.round(d.amount) }));
  const sumado = detalle.reduce((s, d) => s + d.monto, 0);
  const declarado = Math.round(resultado.totalAmount || 0);
  // Ante inconsistencia se prefiere la suma del detalle: es verificable.
  return { total: detalle.length ? sumado : Math.max(0, declarado), detalle };
}
