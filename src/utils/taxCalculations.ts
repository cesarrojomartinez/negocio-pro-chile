/**
 * Adaptador de compatibilidad del motor tributario anterior (Etapa 6.8).
 *
 * El cálculo tributario canónico vive en `src/lib/mirror/unifiedTaxEngine.ts`.
 * Este módulo se conserva solo para sostener el contrato productivo visible
 * mientras se completa la migración: no debe recibir fórmulas nuevas ni
 * conceptos nuevos, y toda corrección tributaria se hace en el núcleo.
 *
 * @deprecated Use UnifiedTaxEngine (src/lib/mirror/unifiedTaxEngine.ts).
 */
import { aplicarAnticipoIva } from "@/lib/anticipoIva";
import type {

  AdditionalSaleInput,
  AdditionalSaleResult,
  CarryforwardSource,
  ClosingProjectionInput,
  ClosingProjectionResult,
  ComparisonMetric,
  ConfidenceInput,
  ConfidenceLevel,
  ConfidenceResult,
  PeriodState,
  PpmInput,
  PpmResult,
  PpmSource,
  PreventiveReserveInput,
  PreventiveReserveResult,
  ReserveCoverageInput,
  ReserveCoverageResult,
  ReserveStatus,
  SalesGoalInput,
  SalesGoalResult,
  TaxEstimateInput,
  TaxProjectionInput,
  TaxProjectionResult,
  VatCreditResult,
  VatDebitResult,
  VatPositionInput,
  VatPositionResult,
  WithholdingsSource,
} from "@/types/engine";
import type {
  ComparacionMensual,
  DocumentoTributario,
  MetaComercial,
  NivelConfiabilidad,
  PeriodoData,
  Proyeccion,
  ResumenCompras,
  ResumenMensual,
  ResumenVentas,
  VentasAgregadasResumen,
  ComprasAgregadasResumen,

} from "@/types/tax";

/* ------------------------------------------------------------------ */
/* Constantes centrales                                                */
/* ------------------------------------------------------------------ */

export const TASA_IVA = 0.19;
export const VAT_RATE = TASA_IVA;

/** Factores del rango de proyección. Centralizados para no repetirlos. */
export const PROJECTION_FACTORS = {
  conservative: 0.95,
  probable: 1,
  high: 1.06,
} as const;

/** Límites permitidos para el margen preventivo. */
export const MARGIN_LIMITS = { min: 0, max: 50 } as const;

/** Cantidad de compras pendientes a partir de la cual la confiabilidad baja. */
export const PENDING_PURCHASES_THRESHOLD = 3;
export const MANY_PENDING_PURCHASES_THRESHOLD = 8;
/** Antigüedad de datos, en días, que reduce la confiabilidad. */
export const STALE_DATA_DAYS = 7;

const seguro = (n: number): number => (Number.isFinite(n) ? n : 0);
const redondear = (n: number): number => Math.round(seguro(n));

/* ------------------------------------------------------------------ */
/* Efecto tributario del documento                                     */
/* ------------------------------------------------------------------ */

/**
 * Tipos de documento cuyo efecto tributario es negativo: rebajan la base y el
 * impuesto del periodo (DTE 60, 61 y 112 del SII).
 */
export const TIPOS_EFECTO_NEGATIVO = new Set(["notaCredito", "60", "61", "112"]);

/**
 * Efecto tributario del documento: +1 suma, −1 resta.
 * El signo es una propiedad del TIPO de documento, no del monto almacenado.
 * Por eso todos los cálculos usan `efecto × |monto|`: así el resultado es el
 * mismo tanto si el origen guarda los montos en positivo (datos
 * demostrativos) como ya firmados (importación real del RCV).
 */
export function efectoTributario(tipoDocumento: string): 1 | -1 {
  return TIPOS_EFECTO_NEGATIVO.has(tipoDocumento) ? -1 : 1;
}

/** Monto con el efecto tributario aplicado sobre el valor absoluto. */
export function montoFirmado(monto: number, efecto: 1 | -1): number {
  return efecto * Math.abs(seguro(monto));
}

/* ------------------------------------------------------------------ */
/* IVA débito                                                          */
/* ------------------------------------------------------------------ */

const VENTA_CONSIDERADA = new Set(["factura", "boleta", "notaDebito", "notaCredito"]);

function ventaVigente(d: DocumentoTributario): boolean {
  return d.estado !== "anulado";
}

/**
 * IVA débito a partir de los documentos de venta válidos.
 * Prioriza el IVA informado en el documento; solo lo infiere desde el neto
 * cuando el documento no lo trae (datos demostrativos antiguos).
 * Los montos exentos nunca generan IVA y las notas de crédito lo reducen.
 */
export function calculateVatDebit(documents: DocumentoTributario[]): VatDebitResult {
  let vatDebit = 0;
  let inferredDocuments = 0;
  let exemptSales = 0;

  for (const d of documents) {
    if (!ventaVigente(d)) continue;
    const tipo = d.tipoDocumento as string;
    if (!VENTA_CONSIDERADA.has(tipo)) continue;
    const efecto = efectoTributario(tipo);

    let iva = Math.abs(seguro(d.iva));
    if (iva === 0) {
      const afecto = Math.abs(seguro(d.neto));
      if (afecto > 0) {
        iva = Math.round(afecto * VAT_RATE);
        inferredDocuments += 1;
      }
    }
    vatDebit += efecto * iva;
    exemptSales += montoFirmado(d.exento, efecto);
  }

  return {
    vatDebit: Math.max(0, redondear(vatDebit)),
    inferred: inferredDocuments > 0,
    inferredDocuments,
    exemptSales: Math.max(0, redondear(exemptSales)),
  };

}

/* ------------------------------------------------------------------ */
/* IVA crédito                                                         */
/* ------------------------------------------------------------------ */

/** Estados de compra que sí se consideran crédito utilizable en esta etapa. */
const CREDITO_UTILIZABLE = new Set(["registrada", "aceptada"]);
/** Estados que podrían incorporarse más adelante. */
const CREDITO_POTENCIAL = new Set(["pendiente"]);

export function calculateVatCredit(documents: DocumentoTributario[]): VatCreditResult {
  let vatCreditUsable = 0;
  let vatCreditPotential = 0;
  let usableDocuments = 0;
  let pendingDocuments = 0;
  let claimedDocuments = 0;
  let excludedDocuments = 0;

  for (const d of documents) {
    const estado = d.estado as string;
    const iva = montoFirmado(d.iva, efectoTributario(d.tipoDocumento as string));
    if (CREDITO_UTILIZABLE.has(estado)) {
      vatCreditUsable += iva;
      usableDocuments += 1;
    } else if (CREDITO_POTENCIAL.has(estado)) {
      vatCreditPotential += iva;
      pendingDocuments += 1;
    } else if (estado === "reclamada") {
      claimedDocuments += 1;
    } else {
      excludedDocuments += 1;
    }
  }

  return {
    vatCreditUsable: redondear(vatCreditUsable),
    vatCreditPotential: redondear(vatCreditPotential),
    usableDocuments,
    pendingDocuments,
    claimedDocuments,
    excludedDocuments,
  };
}

/* ------------------------------------------------------------------ */
/* Posición de IVA                                                     */
/* ------------------------------------------------------------------ */

/**
 * posición IVA = IVA débito − IVA crédito utilizable − remanente anterior.
 * Nunca devuelve un IVA por pagar negativo.
 */
export function calculateVatPosition(input: VatPositionInput): VatPositionResult {
  const vatPosition = redondear(
    seguro(input.vatDebit) -
      seguro(input.vatCreditUsable) -
      seguro(input.previousCarryforward),
  );
  if (vatPosition > 0)
    return { vatPosition, estimatedVatPayable: vatPosition, estimatedNewCarryforward: 0 };
  return {
    vatPosition,
    estimatedVatPayable: 0,
    estimatedNewCarryforward: Math.abs(vatPosition),
  };
}

/** Compatibilidad con la API anterior del motor. */
export function calcularIva(
  ivaDebito: number,
  ivaCredito: number,
  remanenteAnterior: number,
): { ivaEstimado: number; nuevoRemanente: number } {
  const r = calculateVatPosition({
    vatDebit: ivaDebito,
    vatCreditUsable: ivaCredito,
    previousCarryforward: remanenteAnterior,
  });
  return { ivaEstimado: r.estimatedVatPayable, nuevoRemanente: r.estimatedNewCarryforward };
}

/* ------------------------------------------------------------------ */
/* PPM                                                                 */
/* ------------------------------------------------------------------ */

/** PPM aproximado = base tributable × tasa. Nunca inventa una tasa. */
export function calculatePpm(input: PpmInput): PpmResult {
  const base = Math.max(0, redondear(input.ppmTaxBase));
  const rate = input.ppmRate;
  const sinTasa = rate == null || !Number.isFinite(rate) || rate <= 0;
  if (sinTasa || input.ppmSource === "unknown") {
    return {
      ppmTaxBase: base,
      ppmRate: sinTasa ? null : rate,
      ppmSource: "unknown",
      estimatedPpm: 0,
      pending: true,
    };
  }
  return {
    ppmTaxBase: base,
    ppmRate: rate,
    ppmSource: input.ppmSource,
    estimatedPpm: redondear(base * rate),
    pending: false,
  };
}

/* ------------------------------------------------------------------ */
/* Total tributario, margen y reserva                                  */
/* ------------------------------------------------------------------ */

/** Total tributario = IVA por pagar + PPM + retenciones (nunca se restan). */
export function calculateTaxEstimate(input: TaxEstimateInput): number {
  return redondear(
    Math.max(0, seguro(input.estimatedVatPayable)) +
      Math.max(0, seguro(input.estimatedPpm)) +
      Math.max(0, seguro(input.estimatedWithholdings)),
  );
}

export function calcularTotalTributario(
  ivaEstimado: number,
  ppm: number,
  retenciones: number,
): number {
  return calculateTaxEstimate({
    estimatedVatPayable: ivaEstimado,
    estimatedPpm: ppm,
    estimatedWithholdings: retenciones,
  });
}

/** Normaliza el margen preventivo al rango permitido (0 a 50). */
export function normalizePreventiveMargin(percent: number): number {
  if (!Number.isFinite(percent)) return MARGIN_LIMITS.min;
  return Math.min(MARGIN_LIMITS.max, Math.max(MARGIN_LIMITS.min, percent));
}

export function calculatePreventiveReserve(
  input: PreventiveReserveInput,
): PreventiveReserveResult {
  const percent = normalizePreventiveMargin(input.preventiveMarginPercent);
  const total = Math.max(0, redondear(input.estimatedTaxTotal));
  const marginAmount = redondear(total * (percent / 100));
  return {
    preventiveMarginPercent: percent,
    preventiveMarginAmount: marginAmount,
    recommendedReserve: total + marginAmount,
  };
}

export function calcularMargenPreventivo(
  totalTributario: number,
  porcentaje: number,
): number {
  return calculatePreventiveReserve({
    estimatedTaxTotal: totalTributario,
    preventiveMarginPercent: porcentaje,
  }).preventiveMarginAmount;
}

export function calcularReservaRecomendada(
  totalTributario: number,
  margen: number,
): number {
  return redondear(Math.max(0, totalTributario) + Math.max(0, margen));
}

/* ------------------------------------------------------------------ */
/* Cobertura y semáforo                                                */
/* ------------------------------------------------------------------ */

export const MENSAJE_SEMAFORO: Record<ReserveStatus, string> = {
  verde: "Tu reserva cubre la estimación actual.",
  ambar: "Estás cerca, pero todavía falta una parte.",
  rojo: "Conviene reservar dinero adicional para evitar sorpresas al cierre.",
  neutral:
    "Por ahora no existe una obligación estimada que requiera reserva adicional.",
};

export type SemaforoReserva = ReserveStatus;

export function calculateReserveCoverage(
  input: ReserveCoverageInput,
): ReserveCoverageResult {
  const recommended = Math.max(0, redondear(input.recommendedReserve));
  const reserved = Math.max(0, redondear(input.reservedAmount));

  if (recommended === 0) {
    return {
      coveragePercent: 100,
      reserveGap: 0,
      reserveSurplus: reserved,
      status: "neutral",
      message: MENSAJE_SEMAFORO.neutral,
    };
  }

  const coveragePercent =
    Math.round(((reserved / recommended) * 100 + Number.EPSILON) * 100) / 100;
  const status: ReserveStatus =
    coveragePercent >= 100 ? "verde" : coveragePercent >= 70 ? "ambar" : "rojo";

  return {
    coveragePercent,
    reserveGap: Math.max(0, recommended - reserved),
    reserveSurplus: Math.max(0, reserved - recommended),
    status,
    message: MENSAJE_SEMAFORO[status],
  };
}

/** Compatibilidad con la API anterior. */
export function evaluarReserva(
  reservaRecomendada: number,
  dineroReservado: number,
): { estado: ReserveStatus; faltante: number; cobertura: number } {
  const r = calculateReserveCoverage({
    recommendedReserve: reservaRecomendada,
    reservedAmount: dineroReservado,
  });
  return {
    estado: r.status,
    faltante: r.reserveGap,
    cobertura: Math.min(100, r.coveragePercent),
  };
}

/* ------------------------------------------------------------------ */
/* Meta de ventas                                                      */
/* ------------------------------------------------------------------ */

export function calculateSalesGoal(input: SalesGoalInput): SalesGoalResult {
  const totalDays = Math.max(1, Math.round(seguro(input.totalDays)));
  const elapsedDays =
    input.periodState === "future"
      ? 0
      : Math.min(totalDays, Math.max(0, Math.round(seguro(input.elapsedDays))));
  const remainingDays =
    input.periodState === "closed" ? 0 : Math.max(0, totalDays - elapsedDays);

  const salesTotal = Math.max(0, redondear(input.salesTotal));
  const goal = Math.max(0, redondear(input.monthlySalesGoal));

  const goalRemaining = Math.max(0, goal - salesTotal);
  const goalExceededAmount = goal > 0 ? Math.max(0, salesTotal - goal) : 0;

  return {
    monthlySalesGoal: goal,
    salesTotal,
    goalProgressPercent:
      goal > 0 ? Math.round((salesTotal / goal) * 1000) / 10 : 0,
    goalRemaining,
    goalExceededAmount,
    goalExceeded: goal > 0 && salesTotal >= goal,
    averageDailySales: elapsedDays > 0 ? Math.round(salesTotal / elapsedDays) : 0,
    requiredDailySales:
      remainingDays > 0 && goalRemaining > 0
        ? Math.round(goalRemaining / remainingDays)
        : 0,
    elapsedDays,
    remainingDays,
    totalDays,
  };
}

/* ------------------------------------------------------------------ */
/* Proyección al cierre                                                */
/* ------------------------------------------------------------------ */

export function calculateClosingProjection(
  input: ClosingProjectionInput,
): ClosingProjectionResult {
  const totalDays = Math.max(1, Math.round(seguro(input.totalDays)));
  const salesTotal = Math.max(0, redondear(input.salesTotal));

  if (input.periodState === "future" || (input.periodState === "open" && salesTotal === 0)) {
    return {
      available: false,
      averageDailySales: 0,
      conservativeProjection: 0,
      probableProjection: 0,
      highProjection: 0,
    };
  }

  if (input.periodState === "closed") {
    return {
      available: true,
      averageDailySales: Math.round(salesTotal / totalDays),
      conservativeProjection: salesTotal,
      probableProjection: salesTotal,
      highProjection: salesTotal,
    };
  }

  const elapsedDays = Math.min(totalDays, Math.max(1, Math.round(seguro(input.elapsedDays))));
  const averageDailySales = Math.round(salesTotal / elapsedDays);
  const probable = Math.round(averageDailySales * totalDays);

  return {
    available: true,
    averageDailySales,
    conservativeProjection: Math.round(probable * PROJECTION_FACTORS.conservative),
    probableProjection: probable,
    highProjection: Math.round(probable * PROJECTION_FACTORS.high),
  };
}

/**
 * Proyección tributaria prudente: proyecta el débito según el ritmo de ventas,
 * mantiene el crédito y el remanente conocidos y no inventa compras futuras.
 */
export function calculateTaxProjection(input: TaxProjectionInput): TaxProjectionResult {
  const vacio: TaxProjectionResult = {
    available: false,
    projectedVatDebit: 0,
    projectedNetSales: 0,
    projectedPpm: 0,
    knownVatCredit: Math.max(0, redondear(input.vatCreditUsable)),
    knownWithholdings: Math.max(0, redondear(input.estimatedWithholdings)),
    projectedTaxMin: 0,
    projectedTaxMax: 0,
  };
  if (!input.projection.available || input.salesTotal <= 0) return vacio;

  const factorMin =
    input.projection.conservativeProjection / Math.max(1, input.salesTotal);
  const factorMax = input.projection.highProjection / Math.max(1, input.salesTotal);

  const construir = (factor: number) => {
    const vatDebit = redondear(input.vatDebit * factor);
    const netSales = redondear(input.netSales * factor);
    const posicion = calculateVatPosition({
      vatDebit,
      vatCreditUsable: input.vatCreditUsable,
      previousCarryforward: input.previousCarryforward,
    });
    const ppm = calculatePpm({
      ppmTaxBase: netSales,
      ppmRate: input.ppmRate,
      ppmSource: input.ppmRate ? "configured" : "unknown",
    });
    const total = calculateTaxEstimate({
      estimatedVatPayable: posicion.estimatedVatPayable,
      estimatedPpm: ppm.estimatedPpm,
      estimatedWithholdings: input.estimatedWithholdings,
    });
    const reserva = calculatePreventiveReserve({
      estimatedTaxTotal: total,
      preventiveMarginPercent: input.preventiveMarginPercent,
    });
    return { vatDebit, netSales, ppm: ppm.estimatedPpm, total: reserva.recommendedReserve };
  };

  const min = construir(factorMin);
  const max = construir(factorMax);
  const probable = construir(
    input.projection.probableProjection / Math.max(1, input.salesTotal),
  );

  return {
    available: true,
    projectedVatDebit: probable.vatDebit,
    projectedNetSales: probable.netSales,
    projectedPpm: probable.ppm,
    knownVatCredit: vacio.knownVatCredit,
    knownWithholdings: vacio.knownWithholdings,
    projectedTaxMin: Math.min(min.total, max.total),
    projectedTaxMax: Math.max(min.total, max.total),
  };
}

/* ------------------------------------------------------------------ */
/* Simulador de venta adicional                                        */
/* ------------------------------------------------------------------ */

export function simulateAdditionalSale(input: AdditionalSaleInput): AdditionalSaleResult {
  const gross = Math.max(0, redondear(input.grossSaleAmount));
  const vatRate = Number.isFinite(input.vatRate) ? input.vatRate : VAT_RATE;
  const netAmount = redondear(gross / (1 + vatRate));
  const vatAmount = gross - netAmount;
  const ppmRate = input.ppmRate && input.ppmRate > 0 ? input.ppmRate : 0;
  const additionalPpm = redondear(netAmount * ppmRate);
  const additionalTaxReserve = vatAmount + additionalPpm;

  const costRate =
    input.estimatedCostRate != null && input.estimatedCostRate > 0
      ? Math.min(1, input.estimatedCostRate)
      : null;
  const estimatedCost = costRate == null ? null : redondear(netAmount * costRate);

  return {
    grossSaleAmount: gross,
    netAmount,
    vatAmount,
    additionalPpm,
    additionalTaxReserve,
    amountBeforeCosts: gross - additionalTaxReserve,
    estimatedCost,
    estimatedResultBeforeFixedExpenses:
      estimatedCost == null ? null : netAmount - estimatedCost - additionalPpm,
  };
}

export interface ResultadoSimulacion {
  ventaAdicional: number;
  ivaIncluido: number;
  neto: number;
  ppmAdicional: number;
  reservaAdicional: number;
  restanteAntesDeCostos: number;
}

/** Compatibilidad: aplica además el margen preventivo sobre la reserva sugerida. */
export function simularVentaAdicional(
  monto: number,
  tasaPpm: number,
  margenPorcentaje: number,
): ResultadoSimulacion {
  const r = simulateAdditionalSale({
    grossSaleAmount: monto,
    vatRate: VAT_RATE,
    ppmRate: tasaPpm,
  });
  const margen = normalizePreventiveMargin(margenPorcentaje);
  const reservaAdicional = redondear(r.additionalTaxReserve * (1 + margen / 100));
  return {
    ventaAdicional: r.grossSaleAmount,
    ivaIncluido: r.vatAmount,
    neto: r.netAmount,
    ppmAdicional: r.additionalPpm,
    reservaAdicional,
    restanteAntesDeCostos: r.grossSaleAmount - reservaAdicional,
  };
}

/* ------------------------------------------------------------------ */
/* Comparación mensual                                                 */
/* ------------------------------------------------------------------ */

export function calculateVariation(
  current: number,
  previous: number,
  hasPrevious: boolean,
): { variationPercent: number | null; noBaseline: boolean } {
  if (!hasPrevious || !Number.isFinite(previous) || previous === 0)
    return { variationPercent: null, noBaseline: true };
  const variation = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(variation)) return { variationPercent: null, noBaseline: true };
  return { variationPercent: Math.round(variation * 10) / 10, noBaseline: false };
}

export function calculateMonthlyComparison(
  actual: { resumen: ResumenMensual; ventas: ResumenVentas },
  anterior: { resumen: ResumenMensual; ventas: ResumenVentas } | null,
): ComparisonMetric[] {
  const hay = anterior != null;
  const pares: [string, string, number, number][] = [
    ["ventas", "Ventas", actual.resumen.ventasTotales, anterior?.resumen.ventasTotales ?? 0],
    ["facturado", "Facturado", actual.resumen.ventasFacturas, anterior?.resumen.ventasFacturas ?? 0],
    ["boletas", "Boletas", actual.resumen.ventasBoletas, anterior?.resumen.ventasBoletas ?? 0],
    ["compras", "Compras", actual.resumen.comprasTotales, anterior?.resumen.comprasTotales ?? 0],
    ["ivaDebito", "IVA débito", actual.resumen.ivaDebito, anterior?.resumen.ivaDebito ?? 0],
    ["ivaCredito", "IVA crédito", actual.resumen.ivaCredito, anterior?.resumen.ivaCredito ?? 0],
    ["ivaEstimado", "IVA estimado", actual.resumen.ivaEstimado, anterior?.resumen.ivaEstimado ?? 0],
    [
      "reserva",
      "Reserva recomendada",
      actual.resumen.reservaRecomendada,
      anterior?.resumen.reservaRecomendada ?? 0,
    ],
    [
      "documentos",
      "Cantidad de documentos",
      actual.ventas.cantidadDocumentos,
      anterior?.ventas.cantidadDocumentos ?? 0,
    ],
    [
      "ticket",
      "Ticket promedio",
      actual.ventas.ticketPromedio,
      anterior?.ventas.ticketPromedio ?? 0,
    ],
  ];

  return pares.map(([key, label, current, previous]) => {
    const v = calculateVariation(current, previous, hay);
    return { key, label, current, previous, ...v };
  });
}

export const ETIQUETA_SIN_BASE = "Sin base comparable";

/* ------------------------------------------------------------------ */
/* Nivel de confiabilidad                                              */
/* ------------------------------------------------------------------ */

export function calculateConfidenceLevel(input: ConfidenceInput): ConfidenceResult {
  const reasons: string[] = [];

  if (!input.hasSales && !input.hasPurchases) {
    return {
      level: "unknown",
      reasons: ["No hay antecedentes suficientes para estimar este periodo."],
    };
  }

  let bajo = false;
  let medio = false;

  if (!input.hasSales) {
    reasons.push("No hay ventas registradas en el periodo.");
    bajo = true;
  }
  if (!input.hasPurchases) {
    reasons.push("No hay compras registradas en el periodo.");
    bajo = true;
  }
  if (input.syncError) {
    reasons.push("La última actualización de datos terminó con error.");
    bajo = true;
  }
  if (input.carryforwardSource === "unknown") {
    reasons.push("El remanente anterior no está confirmado.");
    bajo = true;
  }
  if (input.ppmSource === "unknown") {
    reasons.push("La tasa de PPM todavía no está confirmada.");
    bajo = true;
  }
  if (!input.hasPreviousPeriod) {
    reasons.push("Falta información del periodo anterior.");
    bajo = true;
  }
  if (input.pendingPurchaseDocuments >= MANY_PENDING_PURCHASES_THRESHOLD) {
    reasons.push(`Existen ${input.pendingPurchaseDocuments} compras pendientes.`);
    bajo = true;
  } else if (input.pendingPurchaseDocuments > 0) {
    reasons.push(
      input.pendingPurchaseDocuments === 1
        ? "Existe 1 compra pendiente."
        : `Existen ${input.pendingPurchaseDocuments} compras pendientes.`,
    );
    medio = true;
  }
  if (input.daysSinceLastSync != null && input.daysSinceLastSync > STALE_DATA_DAYS) {
    reasons.push(`La información tiene más de ${STALE_DATA_DAYS} días.`);
    medio = true;
  }
  if (input.manuallyConfigured) {
    reasons.push("Algunos valores fueron configurados manualmente.");
    medio = true;
  }
  if (
    input.withholdingsSource === "unknown" ||
    input.withholdingsSource === "mock" ||
    input.withholdingsSource === "configured"
  ) {
    reasons.push("Las retenciones no están completamente confirmadas.");
    medio = true;
  }
  if (
    input.carryforwardSource === "mock" ||
    input.ppmSource === "mock"
  ) {
    reasons.push("Parte de la información proviene de datos demostrativos.");
    medio = true;
  }

  const level: ConfidenceLevel = bajo ? "low" : medio ? "medium" : "high";
  if (level === "high" && reasons.length === 0)
    reasons.push("Los antecedentes del periodo están completos y actualizados.");
  return { level, reasons };
}

export function nivelAEspanol(level: ConfidenceLevel): NivelConfiabilidad {
  if (level === "high") return "alta";
  if (level === "medium") return "media";
  if (level === "low") return "baja";
  return "desconocida";
}

export function nivelDesdeEspanol(nivel: NivelConfiabilidad): ConfidenceLevel {
  if (nivel === "alta") return "high";
  if (nivel === "media") return "medium";
  if (nivel === "baja") return "low";
  return "unknown";
}

/* ------------------------------------------------------------------ */
/* Estado del periodo                                                  */
/* ------------------------------------------------------------------ */

export function estadoDelPeriodo(periodo: string, hoy = new Date()): PeriodState {
  const [anio, mes] = periodo.split("-").map(Number);
  if (!anio || !mes) return "open";
  const actualAnio = hoy.getFullYear();
  const actualMes = hoy.getMonth() + 1;
  if (anio > actualAnio || (anio === actualAnio && mes > actualMes)) return "future";
  if (anio === actualAnio && mes === actualMes) return "open";
  return "closed";
}

/* ------------------------------------------------------------------ */
/* Resúmenes de ventas y compras                                       */
/* ------------------------------------------------------------------ */

export function construirResumenVentas(
  docs: DocumentoTributario[],
  /**
   * Boletas y comprobantes de pago electrónico que el SII informa solo como
   * total del mes. Se suman a las ventas del periodo porque son cifras
   * oficiales del resumen del RCV, sin crear documentos individuales.
   */
  agregadas?: VentasAgregadasResumen | null,
): ResumenVentas {
  const vigentes = docs.filter(ventaVigente);
  const facturas = vigentes.filter((d) => d.tipoDocumento === "factura");
  const boletas = vigentes.filter((d) => d.tipoDocumento === "boleta");
  const notas = vigentes.filter((d) => efectoTributario(d.tipoDocumento as string) === -1);

  // Los montos se toman en valor absoluto: el signo lo aporta el efecto
  // tributario del tipo de documento, no el dato almacenado.
  const suma = (arr: DocumentoTributario[]) =>
    arr.reduce((a, d) => a + Math.abs(seguro(d.total)), 0);
  const agregadoTotal = Math.max(0, redondear(agregadas?.total ?? 0));
  const agregadoNeto = redondear(agregadas?.neto ?? 0);
  const agregadoExento = redondear(agregadas?.exento ?? 0);
  const agregadoCantidad = Math.max(0, Math.round(agregadas?.cantidadDocumentos ?? 0));
  /**
   * Facturas y notas de crédito informadas solo por el resumen oficial. Solo
   * llegan cuando el periodo no tiene detalle documento por documento: si hay
   * documentos guardados, estos bloques vienen vacíos y nada cambia.
   */
  const aggFacturas = agregadas?.facturas;
  const aggNotas = agregadas?.notasCredito;
  const facturasAgregadasTotal = Math.max(0, redondear(aggFacturas?.total ?? 0));
  const facturasAgregadasCantidad = Math.max(0, Math.round(aggFacturas?.cantidad ?? 0));
  const notasAgregadasTotal = Math.max(0, redondear(aggNotas?.total ?? 0));
  const notasAgregadasCantidad = Math.max(0, Math.round(aggNotas?.cantidad ?? 0));

  const ventasFacturas = suma(facturas) + facturasAgregadasTotal;
  const ventasBoletas = suma(boletas) + agregadoTotal;
  const notasCredito = suma(notas) + notasAgregadasTotal;
  const ventasExentas =
    vigentes.reduce(
      (a, d) => a + montoFirmado(d.exento, efectoTributario(d.tipoDocumento as string)),
      0,
    ) +
    agregadoExento +
    redondear(aggFacturas?.exento ?? 0) -
    redondear(aggNotas?.exento ?? 0);
  const ventasTotales = ventasFacturas + ventasBoletas - notasCredito;
  const ventasNetas =
    vigentes.reduce(
      (a, d) => a + montoFirmado(d.neto, efectoTributario(d.tipoDocumento as string)),
      0,
    ) +
    agregadoNeto +
    redondear(aggFacturas?.neto ?? 0) -
    redondear(aggNotas?.neto ?? 0);

  const porDia = new Map<string, number>();
  for (const d of [...facturas, ...boletas]) {
    porDia.set(d.fecha, (porDia.get(d.fecha) ?? 0) + Math.abs(seguro(d.total)));
  }
  const serieDiaria = [...porDia.entries()]
    .map(([fecha, monto]) => ({ fecha, monto }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const cantidadFacturas = facturas.length + facturasAgregadasCantidad;
  const cantidadBoletas = boletas.length + agregadoCantidad;
  const cantidadNotasCredito = notas.length + notasAgregadasCantidad;
  const cantidadDocumentos = cantidadFacturas + cantidadBoletas;

  return {
    ventasTotales,
    ventasNetas: redondear(ventasNetas),
    ventasFacturas,
    ventasBoletas,
    ventasExentas: redondear(ventasExentas),
    notasCredito,
    cantidadDocumentos,
    cantidadNotasCredito,
    cantidadDocumentosInformados: cantidadDocumentos + cantidadNotasCredito,
    cantidadFacturas,
    cantidadBoletas,
    ticketPromedio: cantidadDocumentos
      ? Math.round((ventasFacturas + ventasBoletas) / cantidadDocumentos)
      : 0,
    serieDiaria,
  };
}


export function construirResumenCompras(
  docs: DocumentoTributario[],
  /**
   * Compras informadas solo por el resumen oficial del RCV (estado REGISTRO),
   * cuando el periodo no tiene detalle documento por documento.
   */
  agregadas?: ComprasAgregadasResumen | null,
): ResumenCompras {
  const credito = calculateVatCredit(docs);
  const consideradas = docs.filter((d) => CREDITO_UTILIZABLE.has(d.estado as string));
  const firmado = (d: DocumentoTributario, campo: "total" | "neto" | "exento") =>
    montoFirmado(d[campo], efectoTributario(d.tipoDocumento as string));
  const aggFacturas = agregadas?.facturas;
  const aggNotas = agregadas?.notasCredito;
  const agregado = (campo: "neto" | "iva" | "total") =>
    redondear((aggFacturas?.[campo] ?? 0) - (aggNotas?.[campo] ?? 0));

  const comprasTotales =
    consideradas.reduce((a, d) => a + firmado(d, "total"), 0) + agregado("total");
  const comprasNetas =
    consideradas.reduce((a, d) => a + firmado(d, "neto"), 0) + agregado("neto");


  // IVA que quedó fuera del crédito del mes, con su desglose informativo.
  const ivaAbsoluto = (d: DocumentoTributario) => Math.abs(seguro(d.iva));
  const sumaIva = (filtro: (d: DocumentoTributario) => boolean) =>
    redondear(docs.filter(filtro).reduce((a, d) => a + ivaAbsoluto(d), 0));

  const reclamadas = sumaIva((d) => (d.estado as string) === "reclamada");
  const noIncluidas = sumaIva((d) => (d.estado as string) === "noIncluir");
  const notasCreditoProveedores = redondear(
    consideradas
      .filter((d) => efectoTributario(d.tipoDocumento as string) === -1)
      .reduce((a, d) => a + ivaAbsoluto(d), 0) + Math.abs(seguro(aggNotas?.iva ?? 0)),
  );
  const comprasSinIva = redondear(
    consideradas.reduce((a, d) => a + Math.abs(seguro(d.exento)), 0),
  );

  const porProveedor = new Map<string, { monto: number; documentos: number }>();
  for (const d of consideradas) {
    const prev = porProveedor.get(d.contraparte) ?? { monto: 0, documentos: 0 };
    porProveedor.set(d.contraparte, {
      monto: prev.monto + firmado(d, "total"),
      documentos: prev.documentos + 1,
    });
  }

  return {
    comprasTotales,
    comprasNetas,
    ivaCredito: redondear(credito.vatCreditUsable + agregado("iva")),
    ivaCreditoPotencial: credito.vatCreditPotential,
    ivaNoRecuperable: redondear(reclamadas + noIncluidas + notasCreditoProveedores),
    ivaNoRecuperableDetalle: {
      reclamadas,
      noIncluidas,
      notasCreditoProveedores,
      comprasSinIva,
    },
    documentosRegistrados:
      credito.usableDocuments +
      Math.max(0, Math.round(aggFacturas?.cantidad ?? 0)) +
      Math.max(0, Math.round(aggNotas?.cantidad ?? 0)),
    documentosPendientes: credito.pendingDocuments,
    documentosReclamados: credito.claimedDocuments,
    documentosNoIncluir: docs.filter((d) => (d.estado as string) === "noIncluir").length,
    proveedoresPrincipales: [...porProveedor.entries()]
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 5),
  };
}

/* ------------------------------------------------------------------ */
/* Resumen mensual (usa exclusivamente las funciones anteriores)       */
/* ------------------------------------------------------------------ */

export function construirResumenMensual(
  data: PeriodoData,
  opciones: { margenPorcentaje: number; dineroReservado: number },
): ResumenMensual {
  const ventas = construirResumenVentas(data.documentosVenta, data.ventasAgregadasResumen);
  const compras = construirResumenCompras(
    data.documentosCompra,
    data.comprasAgregadasResumen,
  );

  const debitoDocumentos = calculateVatDebit(data.documentosVenta);
  /**
   * IVA de las ventas informadas solo por el resumen oficial: boletas y
   * comprobantes siempre, y además facturas y notas de crédito cuando el
   * periodo no tiene detalle documento por documento.
   */
  const ivaAgregado =
    Math.max(0, redondear(data.ventasAgregadasResumen?.iva ?? 0)) +
    redondear(data.ventasAgregadasResumen?.facturas?.iva ?? 0) -
    redondear(data.ventasAgregadasResumen?.notasCredito?.iva ?? 0);
  /**
   * En la factura de compra electrónica (DTE 46) el IVA lo retiene y entera el
   * comprador, así que no es débito fiscal del vendedor aunque el neto sí sea
   * venta suya. Sumarlo inflaba la estimación mes a mes.
   */
  const ivaRetenidoPorComprador = Math.max(
    0,
    redondear(data.ivaRetenidoPorComprador ?? 0),
  );
  const debito = {
    ...debitoDocumentos,
    vatDebit: Math.max(
      0,
      debitoDocumentos.vatDebit + ivaAgregado - ivaRetenidoPorComprador,
    ),
  };

  const otrosDebitos = Math.max(
    0,
    redondear((data.otrosDebitosIva ?? 0) + (data.debitosEspeciales ?? 0)),
  );
  const otrosCreditos = Math.max(
    0,
    redondear((data.otrosCreditosIva ?? 0) + (data.creditosEspeciales ?? 0)),
  );
  const posicion = calculateVatPosition({
    vatDebit: debito.vatDebit + otrosDebitos,
    vatCreditUsable: compras.ivaCredito + otrosCreditos,
    previousCarryforward: data.remanenteAnterior,
  });

  // Anticipo de IVA por cambio de sujeto: se imputa al IVA ya determinado.
  const anticipo = aplicarAnticipoIva(
    posicion.estimatedVatPayable,
    data.anticipoIvaDisponible ?? 0,
  );


  const fuenteRemanente: CarryforwardSource = data.fuenteRemanente ?? "unknown";
  const fuentePpm: PpmSource = data.fuentePpm ?? (data.tasaPpm ? "configured" : "unknown");
  const fuenteRetenciones: WithholdingsSource = data.fuenteRetenciones ?? "unknown";

  /**
   * Base del PPM: la base confirmada en el F29 tiene prioridad. Si no existe,
   * se usa el neto de ventas con el efecto tributario ya aplicado (las notas
   * de crédito rebajan la base) más las ventas exentas.
   */
  const basePpm =
    data.basePpmConfirmada != null && data.basePpmConfirmada > 0
      ? Math.max(0, redondear(data.basePpmConfirmada))
      : Math.max(0, redondear(ventas.ventasNetas + ventas.ventasExentas));

  const ppm = calculatePpm({
    ppmTaxBase: basePpm,
    ppmRate: data.tasaPpm ?? null,
    ppmSource: fuentePpm,
  });

  const retenciones = Math.max(0, redondear(data.retencionesEstimadas));
  const totalTributarioEstimado = calculateTaxEstimate({
    estimatedVatPayable: anticipo.ivaPorPagar,
    estimatedPpm: ppm.estimatedPpm,
    estimatedWithholdings: retenciones,
  });

  const reserva = calculatePreventiveReserve({
    estimatedTaxTotal: totalTributarioEstimado,
    preventiveMarginPercent: opciones.margenPorcentaje,
  });

  return {
    periodo: data.periodo,
    ventasTotales: ventas.ventasTotales,
    ventasFacturas: ventas.ventasFacturas,
    ventasBoletas: ventas.ventasBoletas,
    ventasExentas: ventas.ventasExentas,
    notasCreditoVentas: ventas.notasCredito,
    comprasTotales: compras.comprasTotales,
    comprasNetas: compras.comprasNetas,
    comprasExentas: data.documentosCompra
      .filter((d) => CREDITO_UTILIZABLE.has(d.estado as string))
      .reduce(
        (a, d) => a + montoFirmado(d.exento, efectoTributario(d.tipoDocumento as string)),
        0,
      ),

    ivaDebito: debito.vatDebit,
    ivaDebitoInferido: debito.inferred,
    ivaCredito: compras.ivaCredito,
    ivaCreditoPotencial: compras.ivaCreditoPotencial,
    remanenteAnterior: Math.max(0, redondear(data.remanenteAnterior)),
    fuenteRemanente,
    ivaEstimado: anticipo.ivaPorPagar,
    nuevoRemanente: posicion.estimatedNewCarryforward,
    ivaRetenidoPorComprador,
    anticipoIvaDisponible: anticipo.disponible,
    anticipoIvaAplicado: anticipo.aplicado,
    anticipoIvaRemanente: anticipo.remanenteSiguiente,
    ivaEstimadoConPendientes: Math.max(
      0,
      calculateVatPosition({
        vatDebit: debito.vatDebit,
        vatCreditUsable: compras.ivaCredito + compras.ivaCreditoPotencial,
        previousCarryforward: data.remanenteAnterior,
      }).estimatedVatPayable - anticipo.disponible,
    ),

    ppmEstimado: ppm.estimatedPpm,
    basePpm: ppm.ppmTaxBase,
    tasaPpm: ppm.ppmRate,
    fuentePpm: ppm.ppmSource,
    ppmPendiente: ppm.pending,
    retencionesEstimadas: retenciones,
    fuenteRetenciones,
    totalTributarioEstimado,
    margenPorcentaje: reserva.preventiveMarginPercent,
    margenPreventivo: reserva.preventiveMarginAmount,
    reservaRecomendada: reserva.recommendedReserve,
    dineroReservado: Math.max(0, redondear(opciones.dineroReservado)),
  };
}

/* ------------------------------------------------------------------ */
/* Meta y proyección en el formato de la aplicación                    */
/* ------------------------------------------------------------------ */

export function construirMeta(
  data: PeriodoData,
  ventasAcumuladas: number,
  metaMensual: number,
): MetaComercial {
  const estado = data.estadoPeriodo ?? estadoDelPeriodo(data.periodo);
  const goal = calculateSalesGoal({
    salesTotal: ventasAcumuladas,
    monthlySalesGoal: metaMensual,
    elapsedDays: data.diasTranscurridos,
    totalDays: data.diasTotales,
    periodState: estado,
  });
  const proyeccion = calculateClosingProjection({
    salesTotal: ventasAcumuladas,
    elapsedDays: data.diasTranscurridos,
    totalDays: data.diasTotales,
    periodState: estado,
  });

  return {
    metaMensual: goal.monthlySalesGoal,
    ventasAcumuladas: goal.salesTotal,
    porcentajeCumplimiento: goal.goalProgressPercent,
    montoFaltante: goal.goalRemaining,
    montoExcedido: goal.goalExceededAmount,
    metaSuperada: goal.goalExceeded,
    diasRestantes: goal.remainingDays,
    diasTranscurridos: goal.elapsedDays,
    diasTotales: goal.totalDays,
    promedioDiarioNecesario: goal.requiredDailySales,
    promedioDiarioActual: goal.averageDailySales,
    proyeccionCierre: proyeccion.probableProjection,
  };
}

export type EstadoMeta =
  | "buenDesempeno"
  | "ritmoAdecuado"
  | "necesitaImpulso"
  | "metaSuperada"
  | "sinDatos";

export function evaluarMeta(meta: MetaComercial): {
  estado: EstadoMeta;
  titulo: string;
  mensaje: string;
} {
  if (meta.metaMensual <= 0)
    return {
      estado: "sinDatos",
      titulo: "Sin meta definida",
      mensaje: "Define una meta mensual para seguir tu avance.",
    };
  if (meta.metaSuperada) {
    return {
      estado: "metaSuperada",
      titulo: "Meta superada",
      mensaje: `Superaste tu meta en ${formatearMonto(meta.montoExcedido)}.`,
    };
  }
  if (meta.ventasAcumuladas === 0)
    return {
      estado: "sinDatos",
      titulo: "Todavía sin ventas",
      mensaje: "Cuando registres ventas verás aquí tu avance del periodo.",
    };
  if (meta.proyeccionCierre >= meta.metaMensual * 1.05) {
    return {
      estado: "buenDesempeno",
      titulo: "Buen desempeño",
      mensaje: "Vas por delante del ritmo necesario para alcanzar tu meta.",
    };
  }
  if (meta.proyeccionCierre >= meta.metaMensual * 0.95) {
    return {
      estado: "ritmoAdecuado",
      titulo: "Ritmo adecuado",
      mensaje: "Manteniendo tu promedio actual podrías alcanzar la meta.",
    };
  }
  if (meta.diasRestantes === 0)
    return {
      estado: "necesitaImpulso",
      titulo: "Periodo cerrado",
      mensaje: "El periodo terminó sin alcanzar la meta definida.",
    };
  return {
    estado: "necesitaImpulso",
    titulo: "Necesita impulso",
    mensaje: `Necesitas vender aproximadamente ${formatearMonto(
      meta.promedioDiarioNecesario,
    )} diarios durante los próximos ${meta.diasRestantes} días.`,
  };
}

function formatearMonto(valor: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  })
    .format(seguro(valor))
    .replace(/\s/g, "");
}

export function construirProyeccion(
  resumen: ResumenMensual,
  meta: MetaComercial,
  opciones: { estadoPeriodo: PeriodState; ventasNetas?: number },
): Proyeccion {
  const cierre = calculateClosingProjection({
    salesTotal: resumen.ventasTotales,
    elapsedDays: meta.diasTranscurridos,
    totalDays: meta.diasTotales,
    periodState: opciones.estadoPeriodo,
  });

  const impuestos = calculateTaxProjection({
    vatDebit: resumen.ivaDebito,
    vatCreditUsable: resumen.ivaCredito,
    previousCarryforward: resumen.remanenteAnterior,
    netSales: opciones.ventasNetas ?? resumen.basePpm,
    ppmRate: resumen.tasaPpm,
    estimatedWithholdings: resumen.retencionesEstimadas,
    preventiveMarginPercent: resumen.margenPorcentaje,
    projection: cierre,
    salesTotal: resumen.ventasTotales,
  });

  return {
    disponible: cierre.available,
    estadoPeriodo: opciones.estadoPeriodo,
    ventasActuales: resumen.ventasTotales,
    promedioDiario: cierre.averageDailySales,
    conservadora: cierre.conservativeProjection,
    probable: cierre.probableProjection,
    alta: cierre.highProjection,
    ivaDebitoProyectado: impuestos.projectedVatDebit,
    ventasNetasProyectadas: impuestos.projectedNetSales,
    ppmProyectado: impuestos.projectedPpm,
    impuestosMin: impuestos.projectedTaxMin,
    impuestosMax: impuestos.projectedTaxMax,
  };
}

export function construirComparacion(
  periodoActual: string,
  actual: { resumen: ResumenMensual; ventas: ResumenVentas },
  anterior: { resumen: ResumenMensual; ventas: ResumenVentas } | null,
  periodoAnterior: string | null,
): ComparacionMensual {
  const metricas = calculateMonthlyComparison(actual, anterior);
  const buscar = (key: string) => metricas.find((m) => m.key === key) ?? null;

  const porSemana = new Map<string, number>();
  for (const d of actual.ventas.serieDiaria) {
    const dia = Number(d.fecha.slice(8, 10)) || new Date(d.fecha).getUTCDate();
    const semana = Math.ceil(dia / 7);
    const key = `Semana ${semana}`;
    porSemana.set(key, (porSemana.get(key) ?? 0) + d.monto);
  }
  const mejorSemanaEntry = [...porSemana.entries()].sort((a, b) => b[1] - a[1])[0];
  const mejorDiaEntry = [...actual.ventas.serieDiaria].sort((a, b) => b.monto - a.monto)[0];

  return {
    periodoActual,
    periodoAnterior,
    metricas,
    ventasActuales: actual.resumen.ventasTotales,
    ventasAnteriores: anterior?.resumen.ventasTotales ?? 0,
    variacionVentas: buscar("ventas")?.variationPercent ?? null,
    comprasActuales: actual.resumen.comprasTotales,
    comprasAnteriores: anterior?.resumen.comprasTotales ?? 0,
    variacionCompras: buscar("compras")?.variationPercent ?? null,
    ivaActual: actual.resumen.ivaEstimado,
    ivaAnterior: anterior?.resumen.ivaEstimado ?? 0,
    variacionIva: buscar("ivaEstimado")?.variationPercent ?? null,
    ticketPromedio: actual.ventas.ticketPromedio,
    ticketPromedioAnterior: anterior?.ventas.ticketPromedio ?? 0,
    cantidadFacturas: actual.ventas.cantidadFacturas,
    cantidadBoletas: actual.ventas.cantidadBoletas,
    mejorDia: mejorDiaEntry ?? null,
    mejorSemana: mejorSemanaEntry
      ? { etiqueta: mejorSemanaEntry[0], monto: mejorSemanaEntry[1] }
      : null,
  };
}
