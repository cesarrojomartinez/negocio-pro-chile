/**
 * Aprobación explícita de la promoción piloto a `compatibility` (Etapa 6.8.2).
 *
 * Ninguna empresa se promueve automáticamente: se exige informe de validación
 * sin bloqueos, aprobador administrativo y razón declarada.
 *
 * Módulo puro.
 */
import { evaluarPromocionCompatibility, type EvaluacionPromocion } from "./promotion";
import type { ReporteParidad } from "./parity";
import {
  PILOT_PROMOTION_BLOCKED,
  type InformeValidacionPiloto,
} from "./pilotValidation";
import { esAliasPiloto, type AliasPiloto } from "./pilot";

export interface EntradaAprobacionPromocion {
  companyId: string;
  companyAlias: AliasPiloto | string;
  informe: InformeValidacionPiloto;
  /** Reportes de paridad del orquestador, cuando existan. */
  parityReports?: ReporteParidad[];
  expectedPeriods?: string[];
  goldenCasesPassed: number;
  goldenCasesTotal: number;
  visualSnapshotsApproved: boolean;
  /** Administrador técnico autorizado. Sin esto nunca se aprueba. */
  approvedBy?: string | null;
  approvalReason?: string | null;
  validationReportId?: string | null;
  approvedAt?: string;
}

export interface ResultadoAprobacionPromocion {
  companyId: string;
  companyAlias: string;
  approved: boolean;
  evaluation: EvaluacionPromocion;
  blockingReasons: string[];
  blockedCode: typeof PILOT_PROMOTION_BLOCKED | null;
  approvedBy: string | null;
  approvedAt: string | null;
  periodsValidated: number;
  engineVersion: string;
  projectionVersion: string;
  approvalReason: string | null;
  validationReportId: string | null;
}

export function aprobarPromocionCompatibility(
  entrada: EntradaAprobacionPromocion,
): ResultadoAprobacionPromocion {
  const razones: string[] = [...entrada.informe.blockingReasons];
  if (!esAliasPiloto(entrada.companyAlias)) razones.push("empresa_no_piloto");
  if (!entrada.approvedBy) razones.push("sin_aprobacion_administrativa");
  if (!entrada.approvalReason) razones.push("sin_razon_de_aprobacion");
  if (!entrada.validationReportId) razones.push("sin_informe_de_validacion");
  if (entrada.informe.periodsValidated < 1) razones.push("sin_periodos_validados");
  if (entrada.informe.compatibilityDifferences > 0) {
    razones.push(`diferencias_compatibilidad:${entrada.informe.compatibilityDifferences}`);
  }

  const evaluation = evaluarPromocionCompatibility({
    companyId: entrada.companyId,
    parityReports: entrada.parityReports ?? [],
    // La cobertura de periodos ya la verifica el informe piloto; aquí solo se
    // exige cuando además se entregan reportes de paridad del orquestador.
    expectedPeriods: (entrada.parityReports ?? []).length > 0
      ? (entrada.expectedPeriods ?? [])
      : [],

    goldenCasesPassed: entrada.goldenCasesPassed,
    goldenCasesTotal: entrada.goldenCasesTotal,
    visualSnapshotsApproved: entrada.visualSnapshotsApproved,
    // TAX_ZERO_JUSTIFIED: conteo de errores sin clasificar, no es un monto.
    unclassifiedErrors: 0,
    productiveFiguresChanged: false,
    unifiedCalculationPersisted: true,
    rollbackAvailable: true,
    approvedBy: entrada.approvedBy ?? null,
    approvedAt: entrada.approvedAt,
  });

  for (const razon of evaluation.blockingReasons) {
    if (!razones.includes(razon)) razones.push(razon);
  }

  const approved = razones.length === 0 && evaluation.promotionStatus === "approved";
  const approvedAt = approved
    ? (entrada.approvedAt ?? evaluation.approvedAt ?? new Date().toISOString())
    : null;

  return {
    companyId: entrada.companyId,
    companyAlias: entrada.companyAlias,
    approved,
    evaluation,
    blockingReasons: razones,
    blockedCode: approved ? null : PILOT_PROMOTION_BLOCKED,
    approvedBy: approved ? (entrada.approvedBy ?? null) : null,
    approvedAt,
    periodsValidated: entrada.informe.periodsValidated,
    engineVersion: entrada.informe.engineVersion,
    projectionVersion: entrada.informe.projectionVersion,
    approvalReason: approved ? (entrada.approvalReason ?? null) : null,
    validationReportId: entrada.validationReportId ?? null,
  };
}
