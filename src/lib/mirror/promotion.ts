/**
 * Promoción controlada de una empresa a modo `compatibility` (Etapa 6.8.1).
 *
 * Ninguna empresa real se promueve automáticamente: se exige una acción
 * administrativa explícita además de la paridad exacta.
 *
 * Módulo puro.
 */
import type { ReporteParidad } from "./parity";

export type PromotionStatus =
  | "approved"
  | "blocked"
  | "requires_manual_approval";

export interface EvaluacionPromocion {
  companyId: string;
  validationPeriodFrom: string | null;
  validationPeriodTo: string | null;
  periodsValidated: number;
  differencesFound: number;
  promotionStatus: PromotionStatus;
  blockingReasons: string[];
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface EntradaPromocion {
  companyId: string;
  /** Reportes de paridad de todos los periodos seleccionados. */
  parityReports: ReporteParidad[];
  /** Periodos que debían procesarse. */
  expectedPeriods: string[];
  goldenCasesPassed: number;
  goldenCasesTotal: number;
  visualSnapshotsApproved: boolean;
  unclassifiedErrors?: number;
  productiveFiguresChanged?: boolean;
  unifiedCalculationPersisted?: boolean;
  rollbackAvailable?: boolean;
  /** Acción administrativa explícita. Sin ella nunca se aprueba. */
  approvedBy?: string | null;
  approvedAt?: string;
}

export function evaluarPromocionCompatibility(
  entrada: EntradaPromocion,
): EvaluacionPromocion {
  const periodos = entrada.parityReports.map((r) => r.period).sort();
  const procesados = new Set(periodos);
  const faltantes = entrada.expectedPeriods.filter((p) => !procesados.has(p));
  const differencesFound = entrada.parityReports.reduce(
    (acc, r) => acc + r.blockingDifferences.length,
    0,
  );

  const blockingReasons: string[] = [];
  if (faltantes.length > 0) {
    blockingReasons.push(`periodos_sin_procesar:${faltantes.join(",")}`);
  }
  if (differencesFound > 0) {
    blockingReasons.push(`diferencias_productivas:${differencesFound}`);
  }
  if ((entrada.unclassifiedErrors ?? 0) > 0) {
    blockingReasons.push(`errores_sin_clasificar:${entrada.unclassifiedErrors}`);
  }
  if (entrada.goldenCasesPassed < entrada.goldenCasesTotal) {
    blockingReasons.push(
      `casos_dorados:${entrada.goldenCasesPassed}/${entrada.goldenCasesTotal}`,
    );
  }
  if (!entrada.visualSnapshotsApproved) blockingReasons.push("snapshots_no_aprobados");
  if (entrada.productiveFiguresChanged) blockingReasons.push("cifras_productivas_alteradas");
  if (entrada.unifiedCalculationPersisted === false) {
    blockingReasons.push("calculo_unificado_no_persistido");
  }
  if (entrada.rollbackAvailable === false) blockingReasons.push("rollback_no_disponible");

  let promotionStatus: PromotionStatus;
  if (blockingReasons.length > 0) promotionStatus = "blocked";
  else if (!entrada.approvedBy) promotionStatus = "requires_manual_approval";
  else promotionStatus = "approved";

  return {
    companyId: entrada.companyId,
    validationPeriodFrom: periodos[0] ?? null,
    validationPeriodTo: periodos[periodos.length - 1] ?? null,
    periodsValidated: periodos.length,
    differencesFound,
    promotionStatus,
    blockingReasons,
    approvedBy: promotionStatus === "approved" ? (entrada.approvedBy ?? null) : null,
    approvedAt:
      promotionStatus === "approved"
        ? (entrada.approvedAt ?? new Date().toISOString())
        : null,
  };
}
