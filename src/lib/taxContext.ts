/**
 * Motor general del contexto tributario de un periodo.
 *
 * Resuelve cada componente del Formulario 29 según su fuente real y no según
 * una fuente única del periodo. El Registro de Compras y Ventas entrega el
 * débito y el crédito del mes, pero el remanente anterior, la tasa de PPM, las
 * retenciones y los ajustes especiales provienen de otros antecedentes. Este
 * módulo es puro: no consulta la base de datos ni ningún proveedor externo.
 */
import { aplicarAnticipoIva } from "./anticipoIva";
import type {

  CalculationStatus,
  CarryforwardSource,
  ConceptSource,
  ConceptSources,
  ConfidenceLevel,
  PpmSource,
  WithholdingsSource,
} from "@/types/engine";

const seguro = (n: number | null | undefined): number =>
  n != null && Number.isFinite(n) ? n : 0;
const redondear = (n: number): number => Math.round(seguro(n));

/* ------------------------------------------------------------------ */
/* Traducción de fuentes heredadas a procedencia por concepto          */
/* ------------------------------------------------------------------ */

export function fuenteConceptoRemanente(f: CarryforwardSource): ConceptSource {
  switch (f) {
    case "accountant_confirmed_f29":
      return "accountant_confirmed";
    case "f29":
      return "f29_confirmed";
    case "previous_period":
      return "previous_confirmed_period";
    case "mock":
      return "mock";
    default:
      return "unknown";
  }
}

export function fuenteConceptoPpm(f: PpmSource): ConceptSource {
  switch (f) {
    case "accountant_confirmed_f29":
      return "accountant_confirmed";
    case "configured":
      return "company_tax_profile";
    case "previous_f29":
      return "previous_confirmed_period";
    case "mock":
      return "mock";
    default:
      return "unknown";
  }
}

export function fuenteConceptoRetenciones(f: WithholdingsSource): ConceptSource {
  switch (f) {
    case "accountant_confirmed_f29":
      return "accountant_confirmed";
    case "f29_history":
      return "f29_confirmed";
    case "documents":
      return "rcv";
    case "configured":
      return "company_tax_profile";
    case "mock":
      return "mock";
    default:
      return "unknown";
  }
}

/** Fuentes que corresponden a un antecedente confirmado. */
const CONFIRMADAS: ReadonlySet<ConceptSource> = new Set<ConceptSource>([
  "f29_confirmed",
  "accountant_confirmed",
  "previous_confirmed_period",
]);

/* ------------------------------------------------------------------ */
/* Componentes faltantes                                               */
/* ------------------------------------------------------------------ */

export type ClaveComponente =
  | "carryforward"
  | "ppm_rate"
  | "ppm_base"
  | "withholdings"
  | "sales"
  | "purchases";

export interface ComponenteFaltante {
  clave: ClaveComponente;
  etiqueta: string;
  detalle: string;
}

export const MENSAJE_REMANENTE_DESCONOCIDO =
  "El remanente anterior todavía no está confirmado y podría modificar esta estimación.";

const FALTANTES: Record<ClaveComponente, Omit<ComponenteFaltante, "clave">> = {
  carryforward: {
    etiqueta: "Remanente anterior",
    detalle: MENSAJE_REMANENTE_DESCONOCIDO,
  },
  ppm_rate: {
    etiqueta: "Tasa de PPM",
    detalle:
      "No hay una tasa de PPM confirmada para este periodo, por lo que el PPM no está incluido.",
  },
  ppm_base: {
    etiqueta: "Base del PPM",
    detalle: "La base del PPM se estimó a partir de las ventas informadas.",
  },
  withholdings: {
    etiqueta: "Retenciones",
    detalle: "No hay retenciones confirmadas para este periodo.",
  },
  sales: {
    etiqueta: "Ventas del periodo",
    detalle: "No hay documentos de venta informados en este periodo.",
  },
  purchases: {
    etiqueta: "Compras del periodo",
    detalle: "No hay documentos de compra informados en este periodo.",
  },
};

/* ------------------------------------------------------------------ */
/* Entrada y salida del contexto                                       */
/* ------------------------------------------------------------------ */

export interface EntradaContextoTributario {
  periodo: string;
  /** IVA débito del periodo, ya con el efecto de las notas de crédito. */
  vatDebit: number;
  vatDebitSource: ConceptSource;
  /** IVA crédito del propio periodo. */
  currentPeriodVatCredit: number;
  vatCreditSource: ConceptSource;
  /** Remanente del periodo anterior. `null` significa desconocido, no cero. */
  previousVatCarryforward: number | null;
  carryforwardSource: ConceptSource;
  otherVatDebits?: number;
  otherVatCredits?: number;
  specialDebits?: number;
  specialCredits?: number;
  specialAdjustmentsSource?: ConceptSource;
  /**
   * Anticipo de IVA por cambio de sujeto disponible para imputar (códigos 543
   * y 573 del F29). Se descuenta del IVA determinado, nunca del débito.
   */
  vatAdvanceAvailable?: number | null;
  vatAdvanceSource?: ConceptSource;

  ppmTaxBase: number | null;
  ppmBaseSource: ConceptSource;
  ppmRate: number | null;
  ppmRateSource: ConceptSource;
  withholdings: number | null;
  withholdingsSource: ConceptSource;
  salesSource: ConceptSource;
  hasSales: boolean;
  hasPurchases: boolean;
  /** Total declarado en el F29 del periodo, cuando existe. */
  declaredTaxTotal?: number | null;
  declaredVat?: number | null;
  declaredPpm?: number | null;
  declaredWithholdings?: number | null;
  /** El contador confirmó los antecedentes del F29 del periodo. */
  f29Confirmado?: boolean;
  /** El periodo ya cerró respecto de la fecha actual. */
  periodoCerrado?: boolean;
  /** Marca de tiempo del cálculo. Se omite para mantener la función pura. */
  calculatedAt?: string | null;
}

export interface DiferenciaComponente {
  clave: "vat" | "ppm" | "withholdings" | "total";
  etiqueta: string;
  estimado: number;
  declarado: number;
  diferencia: number;
}

export interface ContextoTributario {
  periodo: string;
  vat_debit: number;
  current_period_vat_credit: number;
  previous_vat_carryforward: number;
  /** Falso cuando el remanente no está confirmado y se asumió cero. */
  carryforward_known: boolean;
  other_vat_debits: number;
  other_vat_credits: number;
  special_debits: number;
  special_credits: number;
  total_vat_credits: number;
  gross_vat_position: number;
  /** Anticipo de IVA disponible antes de imputar (cambio de sujeto). */
  vat_advance_available: number;
  /** Anticipo de IVA imputado al IVA determinado del periodo. */
  vat_advance_applied: number;
  /** Anticipo de IVA que quedaría disponible para el periodo siguiente. */
  vat_advance_carryforward: number;
  estimated_vat_payable: number;
  estimated_new_carryforward: number;

  ppm_tax_base: number;
  ppm_rate: number | null;
  estimated_ppm: number;
  withholdings: number;
  estimated_tax_total: number;
  declared_tax_total: number | null;
  /** declarado − estimado; positivo significa que el F29 fue mayor. */
  declared_difference: number | null;
  diferencias: DiferenciaComponente[];
  sources: ConceptSources;
  calculation_status: CalculationStatus;
  confidence_level: ConfidenceLevel;
  missing_components: ComponenteFaltante[];
  calculated_at: string | null;
}

/* ------------------------------------------------------------------ */
/* Motor                                                               */
/* ------------------------------------------------------------------ */

/**
 * Fórmula general del IVA:
 *   total_vat_credits = crédito del mes + remanente anterior + otros créditos
 *   gross_vat_position = débito + otros débitos − total_vat_credits
 * Si la posición es positiva hay IVA por pagar; si es negativa se genera un
 * nuevo remanente. El remanente desconocido nunca se presenta como cero
 * confirmado: se calcula con cero pero el periodo queda incompleto.
 */
export function construirContextoTributario(
  entrada: EntradaContextoTributario,
): ContextoTributario {
  const remanenteConocido = entrada.previousVatCarryforward != null;
  const remanente = Math.max(0, redondear(entrada.previousVatCarryforward ?? 0));

  const otrosDebitos = Math.max(0, redondear(entrada.otherVatDebits ?? 0));
  const otrosCreditos = Math.max(0, redondear(entrada.otherVatCredits ?? 0));
  const debitosEspeciales = Math.max(0, redondear(entrada.specialDebits ?? 0));
  const creditosEspeciales = Math.max(0, redondear(entrada.specialCredits ?? 0));

  const debito = Math.max(0, redondear(entrada.vatDebit));
  const credito = Math.max(0, redondear(entrada.currentPeriodVatCredit));

  const totalCreditos = redondear(
    credito + remanente + otrosCreditos + creditosEspeciales,
  );
  const posicion = redondear(debito + otrosDebitos + debitosEspeciales - totalCreditos);

  const ivaBruto = posicion > 0 ? posicion : 0;
  const nuevoRemanente = posicion < 0 ? Math.abs(posicion) : 0;

  // El anticipo por cambio de sujeto se imputa al IVA ya determinado.
  const anticipo = aplicarAnticipoIva(ivaBruto, entrada.vatAdvanceAvailable ?? 0);
  const ivaPorPagar = anticipo.ivaPorPagar;

  const basePpm = Math.max(0, redondear(entrada.ppmTaxBase ?? 0));
  const tasaPpm =
    entrada.ppmRate != null && Number.isFinite(entrada.ppmRate) && entrada.ppmRate > 0
      ? entrada.ppmRate
      : null;
  const ppmDesconocido = tasaPpm == null || entrada.ppmRateSource === "unknown";
  const ppm = ppmDesconocido ? 0 : redondear(basePpm * tasaPpm);

  const retenciones = Math.max(0, redondear(entrada.withholdings ?? 0));
  const total = redondear(ivaPorPagar + ppm + retenciones);


  const faltantes: ComponenteFaltante[] = [];
  const agregar = (clave: ClaveComponente) =>
    faltantes.push({ clave, ...FALTANTES[clave] });

  if (!remanenteConocido || entrada.carryforwardSource === "unknown")
    agregar("carryforward");
  if (ppmDesconocido) agregar("ppm_rate");
  if (entrada.withholdings == null) agregar("withholdings");
  if (!entrada.hasSales) agregar("sales");
  if (!entrada.hasPurchases) agregar("purchases");

  const sources: ConceptSources = {
    sales_source: entrada.salesSource,
    vat_debit_source: entrada.vatDebitSource,
    vat_credit_source: entrada.vatCreditSource,
    carryforward_source: remanenteConocido ? entrada.carryforwardSource : "unknown",
    ppm_rate_source: ppmDesconocido ? "unknown" : entrada.ppmRateSource,
    ppm_base_source: entrada.ppmBaseSource,
    withholdings_source: entrada.withholdingsSource,
    special_adjustments_source:
      entrada.specialAdjustmentsSource ??
      (otrosDebitos + otrosCreditos + debitosEspeciales + creditosEspeciales > 0
        ? "accountant_confirmed"
        : "calculated"),
    total_source: "calculated",
  };

  const declarado =
    entrada.declaredTaxTotal != null && Number.isFinite(entrada.declaredTaxTotal)
      ? redondear(entrada.declaredTaxTotal)
      : null;

  const diferencias: DiferenciaComponente[] = [];
  const comparar = (
    clave: DiferenciaComponente["clave"],
    etiqueta: string,
    estimado: number,
    valor: number | null | undefined,
  ) => {
    if (valor == null || !Number.isFinite(valor)) return;
    diferencias.push({
      clave,
      etiqueta,
      estimado,
      declarado: redondear(valor),
      diferencia: redondear(valor) - estimado,
    });
  };
  comparar("vat", "IVA determinado", ivaPorPagar, entrada.declaredVat);
  comparar("ppm", "PPM", ppm, entrada.declaredPpm);
  comparar("withholdings", "Retenciones", retenciones, entrada.declaredWithholdings);
  comparar("total", "Total tributario", total, declarado);

  const confirmado = !!entrada.f29Confirmado;
  const cerrado = !!entrada.periodoCerrado;

  const bloqueantes = faltantes.filter(
    (f) => f.clave === "carryforward" || f.clave === "ppm_rate",
  );

  let calculation_status: CalculationStatus;
  if (confirmado && cerrado && declarado != null) calculation_status = "closed";
  else if (confirmado) calculation_status = "confirmed";
  else if (bloqueantes.length > 0) calculation_status = "incomplete";
  else if (
    CONFIRMADAS.has(sources.carryforward_source) &&
    CONFIRMADAS.has(sources.ppm_rate_source) &&
    sources.vat_debit_source !== "unknown" &&
    sources.vat_credit_source !== "unknown"
  )
    calculation_status = "complete";
  else calculation_status = "estimated_complete";

  const confidence_level: ConfidenceLevel =
    calculation_status === "closed" || calculation_status === "confirmed"
      ? "high"
      : calculation_status === "incomplete"
        ? bloqueantes.length > 1
          ? "low"
          : "medium"
        : calculation_status === "complete"
          ? "high"
          : "medium";

  return {
    periodo: entrada.periodo,
    vat_debit: debito,
    current_period_vat_credit: credito,
    previous_vat_carryforward: remanente,
    carryforward_known: remanenteConocido && entrada.carryforwardSource !== "unknown",
    other_vat_debits: otrosDebitos,
    other_vat_credits: otrosCreditos,
    special_debits: debitosEspeciales,
    special_credits: creditosEspeciales,
    total_vat_credits: totalCreditos,
    gross_vat_position: posicion,
    vat_advance_available: anticipo.disponible,
    vat_advance_applied: anticipo.aplicado,
    vat_advance_carryforward: anticipo.remanenteSiguiente,
    estimated_vat_payable: ivaPorPagar,

    estimated_new_carryforward: nuevoRemanente,
    ppm_tax_base: basePpm,
    ppm_rate: ppmDesconocido ? null : tasaPpm,
    estimated_ppm: ppm,
    withholdings: retenciones,
    estimated_tax_total: total,
    declared_tax_total: declarado,
    declared_difference: declarado == null ? null : declarado - total,
    diferencias,
    sources,
    calculation_status,
    confidence_level,
    missing_components: faltantes,
    calculated_at: entrada.calculatedAt ?? null,
  };
}

/** El cálculo no puede presentarse como definitivo. */
export function calculoIncompleto(contexto: ContextoTributario): boolean {
  return contexto.calculation_status === "incomplete";
}

/** Texto del estado de completitud para la interfaz. */
export const ETIQUETA_ESTADO_CALCULO: Record<CalculationStatus, string> = {
  complete: "Cálculo completo",
  estimated_complete: "Estimación completa",
  incomplete: "Cálculo incompleto",
  confirmed: "Antecedentes confirmados por el contador",
  closed: "Periodo cerrado con F29 confirmado",
};

/** Texto de la procedencia de cada concepto. */
export const ETIQUETA_FUENTE_CONCEPTO: Record<ConceptSource, string> = {
  rcv: "Registro de Compras y Ventas",
  f29_confirmed: "F29 confirmado",
  accountant_confirmed: "Confirmado por el contador",
  previous_confirmed_period: "Periodo anterior confirmado",
  company_tax_profile: "Perfil tributario de la empresa",
  calculated: "Cálculo interno",
  estimated: "Estimación",
  unknown: "Sin confirmar",
  mock: "Datos demostrativos",
};
