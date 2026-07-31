/**
 * Tabla única y cerrada de naturaleza tributaria por DTE, usada SOLO por el
 * Motor Espejo. El motor productivo conserva su clasificación actual.
 *
 * Módulo puro: sin red, sin reloj, sin base de datos.
 */
import type { DteNature, MirrorLedger } from "./types";

export const DTE_RULE_VERSION = "dte-rules-1.0.0";

export interface DteTaxRule {
  documentType: number;
  documentNature: DteNature;
  /** Libros donde el DTE puede aparecer. */
  ledgerApplicability: MirrorLedger[];
  /** +1 suma, −1 rebaja. */
  taxEffect: 1 | -1;
  /**
   * Verdadero cuando el IVA lo entera el comprador (cambio de sujeto en la
   * factura de compra, DTE 46): no es débito fiscal del vendedor.
   */
  vatWithheldByBuyer: boolean;
  validFrom: string;
  validTo: string | null;
  ruleVersion: string;
  label: string;
}

const VENTAS: MirrorLedger[] = ["sales"];
const COMPRAS: MirrorLedger[] = [
  "purchases_registry",
  "purchases_pending",
  "purchases_claimed",
  "purchases_excluded",
];
const AMBOS: MirrorLedger[] = [...VENTAS, ...COMPRAS];

function regla(
  documentType: number,
  label: string,
  documentNature: DteNature,
  ledgerApplicability: MirrorLedger[],
  opciones: { taxEffect?: 1 | -1; vatWithheldByBuyer?: boolean } = {},
): DteTaxRule {
  return {
    documentType,
    label,
    documentNature,
    ledgerApplicability,
    taxEffect: opciones.taxEffect ?? 1,
    vatWithheldByBuyer: opciones.vatWithheldByBuyer ?? false,
    validFrom: "2020-01",
    validTo: null,
    ruleVersion: DTE_RULE_VERSION,
  };
}

/** Registro cerrado. Un DTE aparece una sola vez. */
export const DTE_TAX_RULES: DteTaxRule[] = [
  regla(29, "Factura de inicio", "taxable_invoice", AMBOS),
  regla(30, "Factura", "taxable_invoice", AMBOS),
  regla(32, "Factura exenta", "exempt_invoice", AMBOS),
  regla(33, "Factura electrónica", "taxable_invoice", AMBOS),
  regla(34, "Factura exenta electrónica", "exempt_invoice", AMBOS),
  regla(35, "Boleta", "receipt", VENTAS),
  regla(38, "Boleta exenta", "exempt_receipt", VENTAS),
  regla(39, "Boleta electrónica", "receipt", VENTAS),
  regla(41, "Boleta exenta electrónica", "exempt_receipt", VENTAS),
  regla(43, "Liquidación factura", "settlement", AMBOS),
  regla(45, "Factura de compra", "purchase_invoice_withheld", AMBOS, {
    vatWithheldByBuyer: true,
  }),
  regla(46, "Factura de compra electrónica", "purchase_invoice_withheld", AMBOS, {
    vatWithheldByBuyer: true,
  }),
  regla(48, "Comprobante de pago electrónico", "electronic_payment_voucher", VENTAS),
  regla(52, "Guía de despacho electrónica", "dispatch_guide", AMBOS),
  regla(55, "Nota de débito", "debit_note", AMBOS),
  regla(56, "Nota de débito electrónica", "debit_note", AMBOS),
  regla(60, "Nota de crédito", "credit_note", AMBOS, { taxEffect: -1 }),
  regla(61, "Nota de crédito electrónica", "credit_note", AMBOS, { taxEffect: -1 }),
  regla(101, "Factura de exportación", "export", VENTAS),
  regla(110, "Factura de exportación electrónica", "export", VENTAS),
  regla(111, "Nota de débito de exportación", "debit_note", VENTAS),
  regla(112, "Nota de crédito de exportación", "credit_note", VENTAS, { taxEffect: -1 }),
];

const POR_CODIGO = new Map(DTE_TAX_RULES.map((r) => [r.documentType, r]));

/** Devuelve la regla vigente para el periodo. `null` si el DTE es desconocido. */
export function resolverReglaDte(
  documentType: number | null | undefined,
  periodo: string,
): DteTaxRule | null {
  if (documentType == null) return null;
  const regla = POR_CODIGO.get(documentType);
  if (!regla) return null;
  if (periodo < regla.validFrom) return null;
  if (regla.validTo && periodo > regla.validTo) return null;
  return regla;
}

export function naturalezaDte(
  documentType: number | null | undefined,
  periodo: string,
): DteNature {
  return resolverReglaDte(documentType, periodo)?.documentNature ?? "unknown";
}
