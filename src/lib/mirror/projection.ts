/**
 * Proyección de dashboard en modo sombra.
 *
 * Traduce los componentes del Motor Espejo a lo que *se mostraría* si el
 * espejo mandara sobre la interfaz. No se renderiza en ninguna pantalla: sirve
 * para comparar contra el dashboard actual y detectar dónde el motor vigente
 * muestra un cero que en realidad es un desconocido.
 *
 * Módulo puro.
 */
import {
  evaluarCertezaPeriodo,
  type PeriodCalculationCertainty,
  type TaxComponentValue,
} from "./certainty";
import type { MirrorConcept, MirrorEngineResult } from "./types";
import { valoresTributarios } from "./certainty";
import { auditarCeros } from "./zeroPolicy";

export type PresentationMode = "amount" | "unknown" | "not_applicable" | "requires_confirmation";

export interface MirrorProjectedCard {
  concept: MirrorConcept;
  label: string;
  /** Monto a mostrar. `null` obliga a la interfaz a no inventar cifra. */
  amount: number | null;
  presentation: PresentationMode;
  /** Texto exacto que reemplazaría a la cifra cuando no hay monto. */
  placeholder: string | null;
  isEstimate: boolean;
  explicitlyReportedZero: boolean;
  detail: string;
}

export interface MirrorDashboardProjection {
  period: string;
  cards: MirrorProjectedCard[];
  certainty: PeriodCalculationCertainty;
  /** Ceros cuyo respaldo no cumple la política de la regla. */
  zeroAudit: ReturnType<typeof auditarCeros>;
  /** Conceptos donde el espejo mostraría "desconocido" en vez de una cifra. */
  hiddenAmounts: MirrorConcept[];
}

const ETIQUETAS: Partial<Record<MirrorConcept, string>> = {
  sales_total: "Ventas del periodo",
  purchases_total: "Compras del periodo",
  vat_debit: "IVA débito",
  recoverable_vat_credit: "IVA crédito recuperable",
  previous_nominal_carryforward: "Remanente anterior",
  next_carryforward: "Remanente siguiente",
  vat_determined: "IVA determinado",
  vat_advance_change_of_subject: "Anticipo de IVA imputado",
  ppm_base: "Base del PPM",
  ppm_rate: "Tasa de PPM",
  ppm_amount: "PPM del periodo",
  withholdings: "Retenciones",
  tax_total_before_surcharges: "Total tributario estimado",
  official_declared_total: "Total declarado en el F29",
  confirmed_paid_total: "Pago confirmado",
};

/** Conceptos que la interfaz mostraría como tarjeta. */
export const CONCEPTOS_DASHBOARD: MirrorConcept[] = Object.keys(ETIQUETAS) as MirrorConcept[];

function presentacion(valor: TaxComponentValue): PresentationMode {
  if (valor.amount != null) return "amount";
  if (valor.status === "not_applicable") return "not_applicable";
  if (valor.requiresConfirmation) return "requires_confirmation";
  return "unknown";
}

const TEXTO_PLACEHOLDER: Record<Exclude<PresentationMode, "amount">, string> = {
  unknown: "Sin información suficiente",
  not_applicable: "No aplica a este periodo",
  requires_confirmation: "Requiere confirmar antecedentes",
};

export function proyectarTarjeta(valor: TaxComponentValue): MirrorProjectedCard {
  const modo = presentacion(valor);
  return {
    concept: valor.concept,
    label: ETIQUETAS[valor.concept] ?? valor.concept,
    amount: valor.amount,
    presentation: modo,
    placeholder: modo === "amount" ? null : TEXTO_PLACEHOLDER[modo],
    isEstimate: valor.isEstimate,
    explicitlyReportedZero: valor.explicitlyReportedZero,
    detail: valor.absenceDetail ?? valor.description,
  };
}

/**
 * Construye la proyección del periodo. Nunca escribe ni depende de la base de
 * datos: recibe el resultado del motor espejo y lo traduce.
 */
export function proyectarDashboardEspejo(
  resultado: MirrorEngineResult,
  conceptos: MirrorConcept[] = CONCEPTOS_DASHBOARD,
): MirrorDashboardProjection {
  const valores = valoresTributarios(resultado);
  const lista = [...valores.values()];
  const cards = conceptos
    .map((c) => valores.get(c))
    .filter((v): v is TaxComponentValue => v != null)
    .map(proyectarTarjeta);

  return {
    period: resultado.period,
    cards,
    certainty: evaluarCertezaPeriodo(resultado.period, lista),
    zeroAudit: auditarCeros(lista),
    hiddenAmounts: cards.filter((c) => c.amount == null).map((c) => c.concept),
  };
}
