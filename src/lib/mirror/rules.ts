/**
 * Registro de reglas tributarias versionadas del Motor Espejo.
 *
 * Cada regla declara sus entradas, su versión y cómo calcula un componente.
 * El resultado siempre registra la regla y la fuente utilizada. Ninguna regla
 * usa `?? 0` sobre una entrada tributaria: si falta un antecedente, el monto
 * queda en `null` y el antecedente faltante queda registrado.
 *
 * Módulo puro: sin red, sin reloj, sin base de datos.
 */
import { resolverReglaDte } from "./dteTaxRules";
import type { ConfiguracionTributariaOpcional } from "./optionalConfig";
import {
  CODIGO,
  leerCodigo,
  sumarRetencionesOficiales,
} from "./officialContext";
import { normalizarTasaPpm, tasaPpmIncoherente } from "./ppmRate";

import type {
  ComponentCalculation,
  ComponentStatus,
  HistoricalOfficialContext,
  MirrorConcept,
  MirrorConfidence,
  NormalizedTaxFact,
} from "./types";

export interface MuestraAnticipoEspejo {
  period: string;
  /** Código 556 del periodo. */
  monthAdvance: number | null;
  /** Código 573 del periodo. */
  nextRemainder: number | null;
}

export interface MirrorEngineInput {
  companyId?: string | null;
  period: string;
  facts: NormalizedTaxFact[];
  /** F29 del mismo periodo, si existe y es confiable. */
  official: HistoricalOfficialContext | null;
  /** F29 vigente anterior. */
  previousOfficial: HistoricalOfficialContext | null;
  vatAdvanceHistory?: MuestraAnticipoEspejo[];
  /** Antecedentes declarados por la empresa. Opcionales: sin ellos nada cambia. */
  optionalConfig?: ConfiguracionTributariaOpcional | null;
  /**
   * Remanente que dejó calculado el periodo anterior cuando no existe F29 que
   * lo informe. Última fuente de la jerarquía, nunca la primera.
   */
  previousComputedCarryforward?: number | null;

  /** Proporción confirmada de recuperación del IVA de uso común (0..1). */
  commonUseRecoveryRatio?: number | null;
  /** Factor de reajuste del remanente. Sin dato: `null` (nunca 1 silencioso). */
  utmAdjustmentFactor?: number | null;
  /** Evidencia de pago independiente del F29. */
  paymentEvidence?: { amount: number | null } | null;
  calculatedAt?: string;
}

export interface RuleContext extends MirrorEngineInput {
  resolved: Map<MirrorConcept, ComponentCalculation>;
}

export type RuleOutput = {
  amount: number | null;
  status: ComponentStatus;
  sources: string[];
  calculationDescription: string;
  inputValues: Record<string, number | string | null | undefined>;
  missingInputs?: string[];
  warnings?: string[];
  confidence?: MirrorConfidence;
};

export interface VersionedTaxRule {
  ruleId: string;
  ruleVersion: string;
  concept: MirrorConcept;
  validFrom: string;
  validTo: string | null;
  requiredInputs: string[];
  optionalInputs: string[];
  roundingRule: "none" | "round_to_peso";
  legalBasisReference: string;
  supportsEstimation: boolean;
  testCaseReferences: string[];
  calculate: (ctx: RuleContext) => RuleOutput;
}

const V = "1.0.0";

/* ───────────────────────────── utilidades ──────────────────────────────── */

function monto(ctx: RuleContext, concepto: MirrorConcept): number | null {
  return ctx.resolved.get(concepto)?.amount ?? null;
}

function estado(ctx: RuleContext, concepto: MirrorConcept): ComponentStatus | null {
  return ctx.resolved.get(concepto)?.status ?? null;
}

/**
 * Verdadero cuando el crédito recuperable ya incorpora el remanente anterior
 * (código 537). En ese caso el remanente no vuelve a restarse ni a sumarse.
 */
function creditoIncluyeRemanente(ctx: RuleContext): boolean {
  return (
    ctx.resolved
      .get("recoverable_vat_credit")
      ?.warnings?.includes("credito_incluye_remanente_anterior") ?? false
  );
}

function peso(valor: number): number {
  return Math.round(valor);
}

function lineasVentas(facts: NormalizedTaxFact[]) {
  return facts.filter(
    (f) => f.ledger === "sales" && f.granularity === "document_type_summary",
  );
}

function lineasCompras(facts: NormalizedTaxFact[]) {
  return facts.filter(
    (f) => f.ledger === "purchases_registry" && f.granularity === "document_type_summary",
  );
}

/** Suma con signo tributario. `null` cuando no hay ninguna línea con dato. */
function sumaConSigno(
  lineas: NormalizedTaxFact[],
  campo: (f: NormalizedTaxFact) => number | null,
): number | null {
  let hayDato = false;
  let total = 0;
  for (const l of lineas) {
    const v = campo(l);
    if (v == null) continue;
    hayDato = true;
    total += (l.taxEffect ?? 1) * v;
  }
  return hayDato ? peso(total) : null;
}

function sinFuente(descripcion: string, faltantes: string[]): RuleOutput {
  return {
    amount: null,
    status: "requires_confirmation",
    sources: [],
    calculationDescription: descripcion,
    inputValues: {},
    missingInputs: faltantes,
    confidence: "unknown",
  };
}

function oficial(
  ctx: RuleContext,
  codigo: string,
  descripcion: string,
): RuleOutput | null {
  const valor = leerCodigo(ctx.official, codigo);
  if (valor == null) return null;
  return {
    amount: valor,
    status: "official",
    sources: [`f29:${codigo}`],
    calculationDescription: descripcion,
    inputValues: { [`codigo_${codigo}`]: valor },
    confidence: "high",
  };
}

/* ─────────────────────────────── reglas ────────────────────────────────── */

const VAT_DEBIT_FROM_RCV_SUMMARY: VersionedTaxRule = {
  ruleId: "VAT_DEBIT_FROM_RCV_SUMMARY",
  ruleVersion: V,
  concept: "vat_debit",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["rcv_sales_summary | f29:538"],
  optionalInputs: [],
  roundingRule: "round_to_peso",
  legalBasisReference: "DL825-art20",
  supportsEstimation: true,
  testCaseReferences: ["golden:*", "mirror:vat_debit"],
  calculate: (ctx) => {
    const oficialF29 = oficial(ctx, CODIGO.debitoTotal, "Total de débitos del F29 (código 538).");
    if (oficialF29) return oficialF29;
    const lineas = lineasVentas(ctx.facts);
    if (lineas.length === 0)
      return sinFuente("Sin resumen de ventas ni F29.", ["rcv_sales_summary"]);
    const conDebito = lineas.filter(
      (l) => !resolverReglaDte(l.documentType, ctx.period)?.vatWithheldByBuyer,
    );
    const total = sumaConSigno(conDebito, (l) => l.vatAmount);
    if (total == null) return sinFuente("El resumen de ventas no informa IVA.", ["rcv_sales_vat"]);
    const retenido = sumaConSigno(
      lineas.filter((l) => resolverReglaDte(l.documentType, ctx.period)?.vatWithheldByBuyer),
      (l) => l.vatAmount,
    );
    return {
      amount: total,
      status: "estimated",
      sources: ["rcv:sales_summary"],
      calculationDescription:
        "Suma del IVA de las ventas con efecto tributario, excluyendo el IVA retenido por el comprador (factura de compra).",
      inputValues: { iva_ventas: total, iva_retenido_por_comprador: retenido },
      confidence: "medium",
    };
  },
};

const VAT_TOTAL_PURCHASES: VersionedTaxRule = {
  ruleId: "VAT_TOTAL_PURCHASES",
  ruleVersion: V,
  concept: "vat_total_purchases",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["rcv_purchases_summary | f29:520"],
  optionalInputs: ["rcv_common_use_vat", "rcv_non_recoverable_vat"],
  roundingRule: "round_to_peso",
  legalBasisReference: "DL825-art23",
  supportsEstimation: true,
  testCaseReferences: ["mirror:credito"],
  calculate: (ctx) => {
    const oficialF29 = oficial(
      ctx,
      CODIGO.creditoDelMesConNoRecuperable,
      "IVA total de compras del mes informado en el F29 (código 520).",
    );
    if (oficialF29) return oficialF29;
    const lineas = lineasCompras(ctx.facts);
    if (lineas.length === 0)
      return sinFuente("Sin resumen de compras ni F29.", ["rcv_purchases_summary"]);
    const iva = sumaConSigno(lineas, (l) => l.vatAmount);
    const usoComun = sumaConSigno(lineas, (l) => l.vatCommonUse);
    const noRec = sumaConSigno(lineas, (l) => l.vatNonRecoverable);
    if (iva == null) return sinFuente("El resumen de compras no informa IVA.", ["rcv_purchases_vat"]);
    return {
      // TAX_ZERO_JUSTIFIED: uso común y no recuperable son sumandos opcionales
      // declarados en optionalInputs; su ausencia se registra como omisión.
      amount: peso(iva + (usoComun ?? 0) + (noRec ?? 0)),
      status: "estimated",
      sources: ["rcv:purchases_summary"],
      calculationDescription:
        "IVA de compras registradas más IVA de uso común y no recuperable informados por el SII.",
      inputValues: { iva: iva, uso_comun: usoComun, no_recuperable: noRec },
      warnings: [
        ...(usoComun == null ? ["uso_comun_no_informado"] : []),
        ...(noRec == null ? ["no_recuperable_no_informado"] : []),
      ],
      confidence: "medium",
    };
  },
};

const VAT_COMMON_USE: VersionedTaxRule = {
  ruleId: "VAT_COMMON_USE",
  ruleVersion: V,
  concept: "vat_common_use",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["rcv_purchases_summary"],
  optionalInputs: [],
  roundingRule: "round_to_peso",
  legalBasisReference: "DL825-art23-n3",
  supportsEstimation: false,
  testCaseReferences: ["mirror:credito"],
  calculate: (ctx) => {
    const lineas = lineasCompras(ctx.facts);
    const usoComun = sumaConSigno(lineas, (l) => l.vatCommonUse);
    if (usoComun == null)
      return sinFuente("El SII no informó IVA de uso común.", ["rcv_common_use_vat"]);
    return {
      amount: usoComun,
      status: "official",
      sources: ["rcv:purchases_summary"],
      calculationDescription: "IVA de uso común informado por el SII en el resumen de compras.",
      inputValues: { uso_comun: usoComun },
      confidence: "high",
    };
  },
};

const VAT_NON_RECOVERABLE: VersionedTaxRule = {
  ruleId: "VAT_NON_RECOVERABLE",
  ruleVersion: V,
  concept: "vat_non_recoverable",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["rcv_purchases_summary | f29:528"],
  optionalInputs: [],
  roundingRule: "round_to_peso",
  legalBasisReference: "DL825-art23-n2",
  supportsEstimation: false,
  testCaseReferences: ["mirror:credito"],
  calculate: (ctx) => {
    const oficialF29 = oficial(
      ctx,
      CODIGO.ivaNoRecuperable,
      "IVA no recuperable declarado en el F29 (código 528).",
    );
    if (oficialF29) return oficialF29;
    const noRec = sumaConSigno(lineasCompras(ctx.facts), (l) => l.vatNonRecoverable);
    if (noRec == null)
      return sinFuente("El SII no informó IVA no recuperable.", ["rcv_non_recoverable_vat"]);
    return {
      amount: noRec,
      status: "official",
      sources: ["rcv:purchases_summary"],
      calculationDescription: "IVA no recuperable informado por el SII.",
      inputValues: { no_recuperable: noRec },
      confidence: "high",
    };
  },
};

const VAT_CREDIT_RECOVERABLE: VersionedTaxRule = {
  ruleId: "VAT_CREDIT_RECOVERABLE",
  ruleVersion: V,
  concept: "recoverable_vat_credit",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["vat_total_purchases | f29:511"],
  optionalInputs: ["vat_common_use", "vat_non_recoverable", "common_use_recovery_ratio"],
  roundingRule: "round_to_peso",
  legalBasisReference: "DL825-art23",
  supportsEstimation: true,
  testCaseReferences: ["golden:*", "mirror:credito"],
  calculate: (ctx) => {
    // El código 537 es el crédito total del periodo: crédito de documentos
    // del mes más el remanente anterior. Es el que el F29 usa para determinar
    // el IVA, así que manda cuando existe. Queda marcado para que la posición
    // de IVA no vuelva a restar el remanente.
    const totalConRemanente = leerCodigo(ctx.official, CODIGO.creditoTotalConRemanente);
    if (totalConRemanente != null) {
      return {
        amount: peso(totalConRemanente),
        status: "official",
        sources: [`f29:${CODIGO.creditoTotalConRemanente}`],
        calculationDescription:
          "Crédito fiscal total declarado en el F29 (código 537): crédito de documentos del mes más el remanente anterior.",
        inputValues: {
          codigo_537: totalConRemanente,
          codigo_511: leerCodigo(ctx.official, CODIGO.creditoDocumentos),
          codigo_504: leerCodigo(ctx.official, CODIGO.remanenteAnterior),
        },
        warnings: ["credito_incluye_remanente_anterior"],
        confidence: "high",
      };
    }

    const oficialF29 = oficial(
      ctx,
      CODIGO.creditoDocumentos,
      "Crédito fiscal recuperable declarado en el F29 (código 511).",
    );
    if (oficialF29) return oficialF29;





    const total = monto(ctx, "vat_total_purchases");
    if (total == null)
      return sinFuente("Sin IVA total de compras.", ["vat_total_purchases"]);
    const noRecuperable = monto(ctx, "vat_non_recoverable");
    // TAX_ZERO_JUSTIFIED: sustraendo opcional. Cuando el SII no informa IVA no
    // recuperable no hay nada que restar, y la omisión queda registrada.
    const noRec = noRecuperable ?? 0;
    const avisosBase = noRecuperable == null ? ["no_recuperable_no_informado"] : [];
    const usoComun = monto(ctx, "vat_common_use");
    const ratio =
      ctx.commonUseRecoveryRatio ?? ctx.optionalConfig?.commonUseRecoveryRatio ?? null;
    const inputValues = {
      iva_total_compras: total,
      no_recuperable: noRecuperable,
      uso_comun: usoComun,
      proporcion_uso_comun: ratio,
    };

    if (usoComun != null && usoComun > 0 && ratio == null) {
      return {
        amount: peso(total - noRec - usoComun),
        status: "requires_confirmation",
        sources: ["rcv:purchases_summary"],
        calculationDescription:
          "IVA total de compras menos el no recuperable. El IVA de uso común queda fuera porque no hay proporción confirmada: no se asume recuperación completa.",
        inputValues,
        missingInputs: ["common_use_recovery_ratio"],
        warnings: ["uso_comun_sin_proporcion_confirmada", ...avisosBase],
        confidence: "low",
      };
    }

    const recuperableUsoComun = usoComun != null && ratio != null ? usoComun * ratio : 0;
    return {
      // TAX_ZERO_JUSTIFIED: el uso común ausente no aporta ni descuenta.
      amount: peso(total - noRec - (usoComun ?? 0) + recuperableUsoComun),
      status: usoComun != null && usoComun > 0 ? "confirmed" : "estimated",
      sources: ["rcv:purchases_summary"],
      calculationDescription:
        "IVA total de compras menos el no recuperable, más la parte recuperable del IVA de uso común según la proporción confirmada.",
      inputValues,
      warnings: avisosBase,
      confidence: usoComun != null && usoComun > 0 ? "high" : "medium",
    };
  },
};

const PREVIOUS_CARRYFORWARD: VersionedTaxRule = {
  ruleId: "PREVIOUS_CARRYFORWARD",
  ruleVersion: V,
  concept: "previous_nominal_carryforward",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["f29:504 | previous_f29:77"],
  optionalInputs: [],
  roundingRule: "round_to_peso",
  legalBasisReference: "DL825-art27",
  supportsEstimation: true,
  testCaseReferences: ["golden:*"],
  calculate: (ctx) => {
    const propio = leerCodigo(ctx.official, CODIGO.remanenteAnterior);
    if (propio != null) {
      return {
        amount: propio,
        status: "official",
        sources: [`f29:${CODIGO.remanenteAnterior}`],
        calculationDescription: "Remanente anterior declarado en el F29 (código 504).",
        inputValues: { codigo_504: propio },
        confidence: "high",
      };
    }
    // Jerarquía: 504 propio → confirmado por el contador o la empresa →
    // código 77 del F29 anterior → remanente calculado del periodo anterior.
    const declarado = ctx.optionalConfig?.confirmedCarryforward ?? null;
    if (declarado != null) {
      return {
        amount: peso(declarado),
        status: "confirmed",
        sources: ["client_declared:confirmed_carryforward"],
        calculationDescription:
          "Remanente anterior confirmado en la configuración tributaria opcional.",
        inputValues: { remanente_declarado: declarado },
        warnings: ["remanente_declarado_por_la_empresa"],
        confidence: "medium",
      };
    }
    const anterior = leerCodigo(ctx.previousOfficial, CODIGO.remanenteSiguiente);
    if (anterior != null) {
      return {
        amount: anterior,
        status: "confirmed",
        sources: [`previous_f29:${CODIGO.remanenteSiguiente}`],
        calculationDescription:
          "Remanente que dejó el F29 del periodo anterior (código 77), en valores nominales.",
        inputValues: { codigo_77_anterior: anterior },
        warnings: ["remanente_nominal_sin_reajuste"],
        confidence: "medium",
      };
    }
    const calculado = ctx.previousComputedCarryforward ?? null;
    if (calculado != null) {
      return {
        amount: peso(calculado),
        status: "estimated",
        sources: ["mirror:previous_period_next_carryforward"],
        calculationDescription:
          "Remanente que dejó calculado el periodo anterior, usado mientras no exista F29 que lo informe.",
        inputValues: { remanente_calculado_anterior: calculado },
        warnings: ["remanente_encadenado_sin_f29"],
        confidence: "low",
      };
    }
    return sinFuente("Sin F29 propio ni anterior que informe el remanente.", [
      "previous_period_f29",
    ]);

  },
};

const ADJUSTED_PREVIOUS_CARRYFORWARD: VersionedTaxRule = {
  ruleId: "ADJUSTED_PREVIOUS_CARRYFORWARD",
  ruleVersion: V,
  concept: "adjusted_previous_carryforward",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["previous_nominal_carryforward", "adjustment_factor"],
  optionalInputs: [],
  roundingRule: "round_to_peso",
  legalBasisReference: "DL825-art27",
  supportsEstimation: false,
  testCaseReferences: ["mirror:remanente"],
  calculate: (ctx) => {
    const nominal = monto(ctx, "previous_nominal_carryforward");
    const factor = monto(ctx, "adjustment_factor");
    if (nominal == null || factor == null) {
      return {
        amount: null,
        status: "unsupported",
        sources: [],
        calculationDescription:
          "El reajuste en UTM del remanente todavía no está implementado. No se usa 1 como factor silencioso.",
        inputValues: { remanente_nominal: nominal, factor: factor },
        missingInputs: factor == null ? ["utm_adjustment_factor"] : ["previous_carryforward"],
        confidence: "unknown",
      };
    }
    return {
      amount: peso(nominal * factor),
      status: "estimated",
      sources: ["utm"],
      calculationDescription: "Remanente anterior reajustado por el factor UTM informado.",
      inputValues: { remanente_nominal: nominal, factor },
      confidence: "medium",
    };
  },
};

const ADJUSTMENT_FACTOR: VersionedTaxRule = {
  ruleId: "ADJUSTMENT_FACTOR",
  ruleVersion: V,
  concept: "adjustment_factor",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["utm_adjustment_factor"],
  optionalInputs: [],
  roundingRule: "none",
  legalBasisReference: "DL825-art27",
  supportsEstimation: false,
  testCaseReferences: ["mirror:remanente"],
  calculate: (ctx) => {
    const factor = ctx.utmAdjustmentFactor ?? null;
    if (factor == null) {
      return {
        amount: null,
        status: "unsupported",
        sources: [],
        calculationDescription: "Factor de reajuste UTM no disponible en esta etapa.",
        inputValues: {},
        missingInputs: ["utm_adjustment_factor"],
        confidence: "unknown",
      };
    }
    return {
      amount: factor,
      status: "confirmed",
      sources: ["utm"],
      calculationDescription: "Factor de reajuste UTM informado.",
      inputValues: { factor },
      confidence: "high",
    };
  },
};

const VAT_POSITION: VersionedTaxRule = {
  ruleId: "VAT_POSITION",
  ruleVersion: V,
  concept: "vat_determined",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["vat_debit", "recoverable_vat_credit", "previous_nominal_carryforward"],
  optionalInputs: ["adjusted_previous_carryforward"],
  roundingRule: "round_to_peso",
  legalBasisReference: "DL825-art20-art23",
  supportsEstimation: true,
  testCaseReferences: ["golden:*"],
  calculate: (ctx) => {
    const oficialF29 = oficial(
      ctx,
      CODIGO.ivaDeterminado,
      "IVA determinado declarado en el F29 (código 89).",
    );
    if (oficialF29) return oficialF29;

    const debito = monto(ctx, "vat_debit");
    const credito = monto(ctx, "recoverable_vat_credit");
    const remanente = monto(ctx, "previous_nominal_carryforward");
    const faltantes: string[] = [];
    if (debito == null) faltantes.push("vat_debit");
    if (credito == null) faltantes.push("recoverable_vat_credit");
    if (remanente == null) faltantes.push("previous_carryforward");
    if (faltantes.length > 0) {
      return {
        amount: null,
        status: "requires_confirmation",
        sources: [],
        calculationDescription: "Faltan componentes para determinar el IVA del periodo.",
        inputValues: { debito, credito, remanente },
        missingInputs: faltantes,
        confidence: "unknown",
      };
    }
    const remanenteYaIncluido = creditoIncluyeRemanente(ctx);
    const posicion =
      (debito as number) - (credito as number) - (remanenteYaIncluido ? 0 : (remanente as number));
    return {
      amount: peso(Math.max(0, posicion)),
      status: estado(ctx, "recoverable_vat_credit") === "requires_confirmation"
        ? "requires_confirmation"
        : "estimated",
      sources: ["mirror:vat_debit", "mirror:recoverable_vat_credit"],
      calculationDescription: remanenteYaIncluido
        ? "Débito fiscal menos el crédito total del periodo, que ya incluye el remanente anterior."
        : "Débito fiscal menos crédito recuperable menos remanente anterior. El resultado negativo no es impuesto: se traslada como remanente.",
      inputValues: { debito, credito, remanente, posicion: peso(posicion) },
      warnings: ["remanente_sin_reajuste_utm"],
      confidence: "medium",
    };
  },
};

const NEXT_CARRYFORWARD: VersionedTaxRule = {
  ruleId: "NEXT_CARRYFORWARD",
  ruleVersion: V,
  concept: "next_carryforward",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["f29:77 | vat_debit + recoverable_vat_credit"],
  optionalInputs: [],
  roundingRule: "round_to_peso",
  legalBasisReference: "DL825-art27",
  supportsEstimation: true,
  testCaseReferences: ["golden:*"],
  calculate: (ctx) => {
    const oficialF29 = oficial(
      ctx,
      CODIGO.remanenteSiguiente,
      "Remanente para el periodo siguiente declarado en el F29 (código 77).",
    );
    if (oficialF29) return oficialF29;
    const debito = monto(ctx, "vat_debit");
    const credito = monto(ctx, "recoverable_vat_credit");
    const remanente = monto(ctx, "previous_nominal_carryforward");
    if (debito == null || credito == null || remanente == null) {
      return sinFuente("Faltan componentes para calcular el remanente siguiente.", [
        ...(debito == null ? ["vat_debit"] : []),
        ...(credito == null ? ["recoverable_vat_credit"] : []),
        ...(remanente == null ? ["previous_carryforward"] : []),
      ]);
    }
    const remanenteYaIncluido = creditoIncluyeRemanente(ctx);
    return {
      amount: peso(
        Math.max(0, credito + (remanenteYaIncluido ? 0 : remanente) - debito),
      ),
      status: "estimated",
      sources: ["mirror:vat_debit", "mirror:recoverable_vat_credit"],
      calculationDescription:
        "Crédito recuperable más remanente anterior menos débito fiscal, cuando el resultado es favorable al contribuyente.",
      inputValues: { debito, credito, remanente },
      confidence: "medium",
    };
  },
};

const PPM_BASE: VersionedTaxRule = {
  ruleId: "PPM_BASE",
  ruleVersion: V,
  concept: "ppm_base",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["f29:563 | rcv_sales_summary"],
  optionalInputs: [],
  roundingRule: "round_to_peso",
  legalBasisReference: "LIR-art84",
  supportsEstimation: true,
  testCaseReferences: ["golden:*"],
  calculate: (ctx) => {
    const oficialF29 = oficial(ctx, CODIGO.basePpm, "Base imponible del PPM del F29 (código 563).");
    if (oficialF29) return oficialF29;
    const neto = monto(ctx, "sales_taxable");
    if (neto == null) return sinFuente("Sin ventas netas para la base del PPM.", ["sales_taxable"]);
    return {
      amount: neto,
      status: "estimated",
      sources: ["mirror:sales_taxable"],
      calculationDescription: "Ventas netas del periodo como base del PPM.",
      inputValues: { ventas_netas: neto },
      confidence: "medium",
    };
  },
};

const PPM_RATE: VersionedTaxRule = {
  ruleId: "PPM_RATE",
  ruleVersion: V,
  concept: "ppm_rate",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["f29:115 | previous_f29:115"],
  optionalInputs: [],
  roundingRule: "none",
  legalBasisReference: "LIR-art84",
  supportsEstimation: true,
  testCaseReferences: ["golden:*"],
  calculate: (ctx) => {
    const base = leerCodigo(ctx.official, CODIGO.basePpm);
    const ppm = leerCodigo(ctx.official, CODIGO.ppm);
    const propia = normalizarTasaPpm(leerCodigo(ctx.official, CODIGO.tasaPpm), {
      base,
      amount: ppm,
    });
    if (propia.rate != null) {
      const warnings: string[] = [];
      if (propia.ambiguous) warnings.push("unidad_tasa_ppm_ambigua");
      if (tasaPpmIncoherente(propia, { base, amount: ppm })) {
        warnings.push("tasa_ppm_incoherente_con_base_y_monto");
      }
      return {
        amount: propia.rate,
        status: "official",
        sources: [`f29:${CODIGO.tasaPpm}`],
        calculationDescription:
          "Tasa de PPM declarada en el F29 (código 115), expresada como fracción.",
        inputValues: {
          codigo_115: leerCodigo(ctx.official, CODIGO.tasaPpm),
          unidad_detectada: propia.unit,
          codigo_563: base,
          codigo_62: ppm,
        },
        warnings,
        confidence: warnings.length > 0 ? "low" : "high",
      };
    }
    const declarada = normalizarTasaPpm(ctx.optionalConfig?.ppmRate ?? null, {
      base,
      amount: ppm,
    });
    if (declarada.rate != null) {
      return {
        amount: declarada.rate,
        status: "confirmed",
        sources: ["client_declared:ppm_rate"],
        calculationDescription:
          "Tasa de PPM vigente confirmada en la configuración tributaria de la empresa.",
        inputValues: { tasa_declarada: declarada.rate, unidad_detectada: declarada.unit },
        warnings: ["tasa_ppm_declarada_por_la_empresa"],
        confidence: "medium",
      };
    }
    const baseAnterior = leerCodigo(ctx.previousOfficial, CODIGO.basePpm);
    const ppmAnterior = leerCodigo(ctx.previousOfficial, CODIGO.ppm);
    const anterior = normalizarTasaPpm(
      leerCodigo(ctx.previousOfficial, CODIGO.tasaPpm),
      { base: baseAnterior, amount: ppmAnterior },
    );
    if (anterior.rate != null) {
      // Una tasa incoherente en el F29 anterior no se propaga al periodo
      // siguiente: se marca como antecedente contradictorio y queda sin monto.
      if (tasaPpmIncoherente(anterior, { base: baseAnterior, amount: ppmAnterior })) {
        return {
          amount: null,
          status: "requires_confirmation",
          sources: [`previous_f29:${CODIGO.tasaPpm}`],
          calculationDescription:
            "La tasa del F29 anterior es incoherente con su base y su monto, por lo que no se arrastra a este periodo.",
          inputValues: {
            tasa_anterior: anterior.rate,
            codigo_563_anterior: baseAnterior,
            codigo_62_anterior: ppmAnterior,
          },
          missingInputs: ["ppm_rate"],
          warnings: ["tasa_ppm_anterior_incoherente"],
          confidence: "unknown",
        };
      }
      return {
        amount: anterior.rate,
        status: "estimated",
        sources: [`previous_f29:${CODIGO.tasaPpm}`],
        calculationDescription:
          "Tasa del F29 anterior utilizada como referencia. No se asume vigencia indefinida.",
        inputValues: {
          tasa_anterior: anterior.rate,
          periodo_anterior: ctx.previousOfficial?.period ?? null,
        },
        warnings: ["tasa_ppm_de_periodo_anterior"],
        confidence: "low",
      };
    }
    return sinFuente("Sin tasa de PPM conocida.", ["ppm_rate"]);

  },
};

const PPM_AMOUNT: VersionedTaxRule = {
  ruleId: "PPM_AMOUNT",
  ruleVersion: V,
  concept: "ppm_amount",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["f29:62 | ppm_base + ppm_rate"],
  optionalInputs: [],
  roundingRule: "round_to_peso",
  legalBasisReference: "LIR-art84",
  supportsEstimation: true,
  testCaseReferences: ["golden:*"],
  calculate: (ctx) => {
    const oficialF29 = oficial(ctx, CODIGO.ppm, "PPM declarado en el F29 (código 62).");
    if (oficialF29) return oficialF29;
    const base = monto(ctx, "ppm_base");
    const tasa = monto(ctx, "ppm_rate");
    if (base == null || tasa == null) {
      return sinFuente("Sin base o sin tasa de PPM.", [
        ...(base == null ? ["ppm_base"] : []),
        ...(tasa == null ? ["ppm_rate"] : []),
      ]);
    }
    return {
      amount: peso(base * tasa),
      status: "estimated",
      sources: ["mirror:ppm_base", "mirror:ppm_rate"],
      calculationDescription: "Base del PPM por la tasa vigente.",
      inputValues: { base, tasa },
      confidence: "medium",
    };
  },
};

const WITHHOLDINGS: VersionedTaxRule = {
  ruleId: "WITHHOLDINGS",
  ruleVersion: V,
  concept: "withholdings",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["f29:151 | f29:153 | f29:48 | f29:39 | f29:50"],
  optionalInputs: [],
  roundingRule: "round_to_peso",
  legalBasisReference: "LIR-art74",
  supportsEstimation: false,
  testCaseReferences: ["golden:*"],
  calculate: (ctx) => {
    // El F29 reparte las retenciones en varios códigos: honorarios,
    // trabajadores independientes, construcción y otras. Tomar solo el 151
    // subdeclaraba el total.
    const { total, detalle } = sumarRetencionesOficiales(ctx.official);
    if (total != null) {
      return {
        amount: peso(total),
        status: "official",
        sources: Object.keys(detalle).map((c) => `f29:${c}`),
        calculationDescription:
          "Suma de las retenciones declaradas en el F29 (códigos 151, 153, 48, 39 y 50).",
        inputValues: Object.fromEntries(
          Object.entries(detalle).map(([c, v]) => [`codigo_${c}`, v]),
        ),
        confidence: "high",
      };
    }

    const declaradas = ctx.optionalConfig?.withholdingsEstimate ?? null;
    if (declaradas != null) {
      return {
        amount: peso(declaradas),
        status: "estimated",
        sources: ["client_declared:withholdings_estimate"],
        calculationDescription:
          "Retenciones habituales declaradas por la empresa mientras no exista F29 del periodo.",
        inputValues: { retenciones_declaradas: declaradas },
        warnings: ["retenciones_declaradas_por_la_empresa"],
        confidence: "medium",
      };
    }
    return sinFuente(
      "Las retenciones no se deducen del RCV: requieren antecedente propio.",
      ["withholdings_source"],
    );
  },
};

const VAT_ADVANCE_CHANGE_OF_SUBJECT: VersionedTaxRule = {
  ruleId: "VAT_ADVANCE_CHANGE_OF_SUBJECT",
  ruleVersion: V,
  concept: "vat_advance_change_of_subject",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["f29:598 | historial_anticipo"],
  optionalInputs: ["f29:543", "f29:556", "f29:557", "f29:573"],
  roundingRule: "round_to_peso",
  legalBasisReference: "SII-cambio-de-sujeto",
  supportsEstimation: true,
  testCaseReferences: ["golden:panaderia-2026-06"],
  calculate: (ctx) => {
    const imputado = leerCodigo(ctx.official, CODIGO.anticipoImputado);
    if (imputado != null) {
      return {
        amount: imputado,
        status: "official",
        sources: [`f29:${CODIGO.anticipoImputado}`],
        calculationDescription:
          "Anticipo de IVA por cambio de sujeto imputado al impuesto del mes (código 598).",
        inputValues: {
          codigo_598: imputado,
          codigo_543: leerCodigo(ctx.official, CODIGO.anticipoDisponible),
          codigo_556: leerCodigo(ctx.official, CODIGO.anticipoDelMes),
          codigo_557: leerCodigo(ctx.official, CODIGO.anticipoRemanenteAnterior),
          codigo_573: leerCodigo(ctx.official, CODIGO.anticipoRemanenteSiguiente),
        },
        confidence: "high",
      };
    }
    if (ctx.official) {
      const disponible = leerCodigo(ctx.official, CODIGO.anticipoDisponible);
      if (disponible == null) {
        return {
          amount: null,
          status: "not_applicable",
          sources: ["f29"],
          calculationDescription:
            "El F29 del periodo no informa códigos de anticipo por cambio de sujeto.",
          inputValues: {},
          confidence: "high",
        };
      }
      // El código 598 ausente NO es un cero: hay anticipo disponible y el
      // formulario simplemente no informó imputación.
      return {
        amount: null,
        status: "requires_confirmation",
        sources: [`f29:${CODIGO.anticipoDisponible}`],
        calculationDescription:
          "El F29 informa anticipo disponible (código 543) pero no trae el código 598 de imputación.",
        inputValues: {
          codigo_543: disponible,
          codigo_573: leerCodigo(ctx.official, CODIGO.anticipoRemanenteSiguiente),
        },
        missingInputs: ["f29_code_598"],
        confidence: "medium",
      };
    }

    if (ctx.optionalConfig?.vatAdvanceRegime === false) {
      return {
        amount: null,
        status: "not_applicable",
        sources: ["client_declared:vat_advance_regime"],
        calculationDescription:
          "La empresa declaró que no está afecta a cambio de sujeto ni anticipo de IVA.",
        inputValues: {},
        confidence: "medium",
      };
    }
    const historial = (ctx.vatAdvanceHistory ?? []).filter((m) => m.period < ctx.period);
    if (historial.length === 0) {
      return {
        amount: null,
        status: "requires_confirmation",
        sources: [],
        calculationDescription:
          "No hay antecedente para estimar el anticipo por cambio de sujeto. No se inventa un crédito ni se esconde dentro de otro concepto.",
        inputValues: {},
        missingInputs: ["vat_advance_history"],
        confidence: "unknown",
      };
    }
    const ordenado = [...historial].sort((a, b) => (a.period < b.period ? 1 : -1));
    const remanente = ordenado[0].nextRemainder;
    const mensuales = ordenado
      .slice(0, 6)
      .map((m) => m.monthAdvance)
      .filter((v): v is number => v != null && v > 0)
      .sort((a, b) => a - b);
    const medio = Math.floor(mensuales.length / 2);
    const mediana =
      mensuales.length === 0
        ? null
        : mensuales.length % 2 === 1
          ? mensuales[medio]
          : Math.round((mensuales[medio - 1] + mensuales[medio]) / 2);
    if (remanente == null && mediana == null) {
      return {
        amount: null,
        status: "requires_confirmation",
        sources: ["f29_history"],
        calculationDescription: "El historial no informa montos de anticipo.",
        inputValues: {},
        missingInputs: ["vat_advance_history"],
        confidence: "unknown",
      };
    }
    return {
      // TAX_ZERO_JUSTIFIED: sumandos opcionales de una estimación declarada;
      // el caso en que ambos faltan ya retornó sin monto más arriba.
      amount: peso((remanente ?? 0) + (mediana ?? 0)),
      status: "estimated",
      sources: ["f29_history:573", "f29_history:556"],
      calculationDescription:
        "Anticipo disponible estimado: remanente oficial del último F29 más la mediana de los anticipos mensuales recientes.",
      inputValues: { remanente_anterior: remanente, mediana_anticipo_mensual: mediana },
      warnings: ["anticipo_estimado_sin_f29"],
      confidence: "low",
    };
  },
};

const TAX_TOTAL_BEFORE_SURCHARGES: VersionedTaxRule = {
  ruleId: "TAX_TOTAL_BEFORE_SURCHARGES",
  ruleVersion: V,
  concept: "tax_total_before_surcharges",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["vat_determined", "ppm_amount"],
  optionalInputs: ["withholdings", "vat_advance_change_of_subject"],
  roundingRule: "round_to_peso",
  legalBasisReference: "F29-547",
  supportsEstimation: true,
  testCaseReferences: ["golden:*"],
  calculate: (ctx) => {
    const subtotalOficial = oficial(
      ctx,
      CODIGO.subtotalDeterminado,
      "Subtotal determinado declarado en el F29 (código 547).",
    );
    if (subtotalOficial) return subtotalOficial;
    const iva = monto(ctx, "vat_determined");
    const anticipo = monto(ctx, "vat_advance_change_of_subject");
    const ppm = monto(ctx, "ppm_amount");
    const retenciones = monto(ctx, "withholdings");
    const faltantes: string[] = [];
    if (iva == null) faltantes.push("vat_determined");
    if (ppm == null) faltantes.push("ppm_amount");
    // El anticipo por cambio de sujeto solo bloquea cuando hay evidencia de
    // que la empresa está afecta a ese régimen. Sin F29, sin historial y sin
    // declaración de la empresa no hay anticipo que imputar.
    const afectaAnticipo =
      ctx.optionalConfig?.vatAdvanceRegime === true ||
      // TAX_ZERO_JUSTIFIED: largo de una lista ausente es cero elementos, no un monto.
      (ctx.vatAdvanceHistory?.length ?? 0) > 0;
    if (ctx.official == null && anticipo == null && afectaAnticipo) {
      faltantes.push("vat_advance_change_of_subject");
    }

    if (faltantes.length > 0) {
      return {
        amount: null,
        status: "requires_confirmation",
        sources: [],
        calculationDescription:
          "Faltan componentes para totalizar el impuesto del periodo. No se completa con ceros.",
        inputValues: { iva, anticipo, ppm, retenciones },
        missingInputs: faltantes,
        confidence: "unknown",
      };
    }
    // TAX_ZERO_JUSTIFIED: cuando el F29 del periodo existe y no trae el código
    // 598, no hubo imputación de anticipo. Cubierto por la prueba
    // "anticipo ausente no resta".
    const anticipoImputado = anticipo ?? 0;
    // Las retenciones son un sumando: sin antecedente no hay nada que sumar y
    // el faltante queda declarado como aviso, no como total desconocido.
    // TAX_ZERO_JUSTIFIED: sin antecedente de retenciones no hay sumando; queda declarado en avisos.
    const retencionesSumadas = retenciones ?? 0;
    const avisos = retenciones == null ? ["retenciones_no_informadas"] : [];
    const total =
      (iva as number) - anticipoImputado + (ppm as number) + retencionesSumadas;

    const derivadoDeOficiales =
      estado(ctx, "vat_determined") === "official" && estado(ctx, "ppm_amount") === "official";
    return {
      amount: peso(Math.max(0, total)),
      status: derivadoDeOficiales ? "official" : "estimated",
      sources: [
        "mirror:vat_determined",
        "mirror:vat_advance_change_of_subject",
        "mirror:ppm_amount",
        "mirror:withholdings",
      ],
      calculationDescription:
        "IVA determinado menos el anticipo por cambio de sujeto imputado, más PPM y retenciones. Equivale al código 547 del F29.",
      inputValues: { iva, anticipo, ppm, retenciones },
      warnings: avisos,
      confidence: derivadoDeOficiales ? "high" : "medium",

    };
  },
};

const TAX_TOTAL_DECLARED: VersionedTaxRule = {
  ruleId: "TAX_TOTAL_DECLARED",
  ruleVersion: V,
  concept: "official_declared_total",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["f29:91"],
  optionalInputs: [],
  roundingRule: "round_to_peso",
  legalBasisReference: "F29-91",
  supportsEstimation: false,
  testCaseReferences: ["golden:*"],
  calculate: (ctx) => {
    const oficialF29 = oficial(ctx, CODIGO.totalAPagar, "Total declarado en el F29 (código 91).");
    if (oficialF29) return oficialF29;
    return {
      amount: null,
      status: "unavailable",
      sources: [],
      calculationDescription: "El periodo no tiene un F29 con código 91.",
      inputValues: {},
      missingInputs: ["f29_code_91"],
      confidence: "unknown",
    };
  },
};

const PAYMENT_STATUS_RESOLUTION: VersionedTaxRule = {
  ruleId: "PAYMENT_STATUS_RESOLUTION",
  ruleVersion: V,
  concept: "confirmed_paid_total",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["payment_evidence"],
  optionalInputs: [],
  roundingRule: "round_to_peso",
  legalBasisReference: "F29-pago",
  supportsEstimation: false,
  testCaseReferences: ["mirror:declarado_vs_pagado"],
  calculate: (ctx) => {
    const evidencia = ctx.paymentEvidence ?? null;
    if (evidencia?.amount != null) {
      return {
        amount: peso(evidencia.amount),
        status: "confirmed",
        sources: ["payment_evidence"],
        calculationDescription: "Pago confirmado con una fuente independiente del F29.",
        inputValues: { pago: evidencia.amount },
        confidence: "high",
      };
    }
    return {
      amount: null,
      status: "unavailable",
      sources: [],
      calculationDescription:
        "Un F29 presentado no acredita pago. Sin fuente independiente, el pago es desconocido.",
      inputValues: { codigo_91: leerCodigo(ctx.official, CODIGO.totalAPagar) },
      missingInputs: ["payment_evidence"],
      confidence: "unknown",
    };
  },
};

const SURCHARGES: VersionedTaxRule = {
  ruleId: "SURCHARGES",
  ruleVersion: V,
  concept: "surcharges",
  validFrom: "2020-01",
  validTo: null,
  requiredInputs: ["f29:91", "f29:547"],
  optionalInputs: [],
  roundingRule: "round_to_peso",
  legalBasisReference: "CT-art53",
  supportsEstimation: false,
  testCaseReferences: ["golden:*"],
  calculate: (ctx) => {
    const total = leerCodigo(ctx.official, CODIGO.totalAPagar);
    const subtotal = leerCodigo(ctx.official, CODIGO.subtotalDeterminado);
    if (total == null || subtotal == null) {
      return {
        amount: null,
        status: "unavailable",
        sources: [],
        calculationDescription: "Sin F29 no se pueden conocer recargos.",
        inputValues: { codigo_91: total, codigo_547: subtotal },
        missingInputs: ["f29_code_91", "f29_code_547"],
        confidence: "unknown",
      };
    }
    return {
      amount: peso(total - subtotal),
      status: "official",
      sources: [`f29:${CODIGO.totalAPagar}`, `f29:${CODIGO.subtotalDeterminado}`],
      calculationDescription: "Diferencia entre el total a pagar y el subtotal determinado.",
      inputValues: { codigo_91: total, codigo_547: subtotal },
      confidence: "high",
    };
  },
};

/* ─────────────────── reglas de agregados del RCV ───────────────────────── */

function reglaAgregado(
  ruleId: string,
  concept: MirrorConcept,
  ledger: "sales" | "purchases_registry",
  campo: (f: NormalizedTaxFact) => number | null,
  descripcion: string,
  faltante: string,
): VersionedTaxRule {
  return {
    ruleId,
    ruleVersion: V,
    concept,
    validFrom: "2020-01",
    validTo: null,
    requiredInputs: [ledger === "sales" ? "rcv_sales_summary" : "rcv_purchases_summary"],
    optionalInputs: [],
    roundingRule: "round_to_peso",
    legalBasisReference: "RCV",
    supportsEstimation: true,
    testCaseReferences: ["mirror:agregados"],
    calculate: (ctx) => {
      const lineas = ledger === "sales" ? lineasVentas(ctx.facts) : lineasCompras(ctx.facts);
      const total = sumaConSigno(lineas, campo);
      if (total == null) return sinFuente(descripcion, [faltante]);
      return {
        amount: total,
        status: "official",
        sources: [`rcv:${ledger}`],
        calculationDescription: descripcion,
        inputValues: { total },
        confidence: "high",
      };
    },
  };
}

/** Orden de ejecución: las reglas dependientes van después de sus insumos. */
export const VERSIONED_TAX_RULES: VersionedTaxRule[] = [
  reglaAgregado(
    "SALES_TAXABLE",
    "sales_taxable",
    "sales",
    (f) => f.taxableNet,
    "Ventas netas afectas informadas en el resumen del RCV.",
    "rcv_sales_summary",
  ),
  reglaAgregado(
    "SALES_EXEMPT",
    "sales_exempt",
    "sales",
    (f) => f.exemptAmount,
    "Ventas exentas informadas en el resumen del RCV.",
    "rcv_sales_summary",
  ),
  reglaAgregado(
    "SALES_TOTAL",
    "sales_total",
    "sales",
    (f) => f.totalAmount,
    "Total de ventas informado por el SII.",
    "rcv_sales_summary",
  ),
  reglaAgregado(
    "PURCHASES_TAXABLE",
    "purchases_taxable",
    "purchases_registry",
    (f) => f.taxableNet,
    "Compras netas registradas informadas en el resumen del RCV.",
    "rcv_purchases_summary",
  ),
  reglaAgregado(
    "PURCHASES_EXEMPT",
    "purchases_exempt",
    "purchases_registry",
    (f) => f.exemptAmount,
    "Compras exentas registradas.",
    "rcv_purchases_summary",
  ),
  reglaAgregado(
    "PURCHASES_TOTAL",
    "purchases_total",
    "purchases_registry",
    (f) => f.totalAmount,
    "Total de compras registradas informado por el SII.",
    "rcv_purchases_summary",
  ),
  VAT_DEBIT_FROM_RCV_SUMMARY,
  VAT_TOTAL_PURCHASES,
  VAT_COMMON_USE,
  VAT_NON_RECOVERABLE,
  VAT_CREDIT_RECOVERABLE,
  PREVIOUS_CARRYFORWARD,
  ADJUSTMENT_FACTOR,
  ADJUSTED_PREVIOUS_CARRYFORWARD,
  VAT_POSITION,
  NEXT_CARRYFORWARD,
  PPM_BASE,
  PPM_RATE,
  PPM_AMOUNT,
  WITHHOLDINGS,
  VAT_ADVANCE_CHANGE_OF_SUBJECT,
  TAX_TOTAL_BEFORE_SURCHARGES,
  SURCHARGES,
  TAX_TOTAL_DECLARED,
  PAYMENT_STATUS_RESOLUTION,
];

export function reglaPorConcepto(concepto: MirrorConcept): VersionedTaxRule | undefined {
  return VERSIONED_TAX_RULES.find((r) => r.concept === concepto);
}
