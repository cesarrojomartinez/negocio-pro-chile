import { supabaseAdmin } from "@/integrations/supabase/client.server";

import {
  calculateTaxPeriod,
  type EntradaCalculoPeriodo,
  type ResultadoCalculoPeriodo,
} from "./calculationOrchestrator";
import { conceptosOficiales, entradaUnificadaPeriodo } from "./server";
import type { ContextoProductivoNoTributario, ProductiveTaxSummary } from "./productiveSummary";
import {
  registrarRollbackAModoSombra,
  resolverModoUnificadoDetallado,
  type UnifiedEngineMode,
} from "./unifiedEngineMode";
import type { EvaluacionPromocion } from "./promotion";

/**
 * Configuración y persistencia del núcleo unificado por empresa
 * (Etapa 6.8.1).
 *
 * El modo vive en `tax_engine_settings` y solo puede cambiarlo el servidor.
 * Cualquier valor inválido o ausente resuelve al modo seguro (`shadow`).
 */

/** Lee el modo configurado. Nunca lanza: ante error devuelve el modo seguro. */
export async function leerModoMotorEmpresa(
  companyId: string,
): Promise<{ modo: UnifiedEngineMode; configurado: string | null; error: string | null }> {
  const { data } = await supabaseAdmin
    .from("tax_engine_settings")
    .select("unified_engine_mode")
    .eq("company_id", companyId)
    .maybeSingle<{ unified_engine_mode: string | null }>();
  const resolucion = resolverModoUnificadoDetallado(data?.unified_engine_mode ?? null);
  return {
    modo: resolucion.modo,
    configurado: resolucion.configurado,
    error: resolucion.error,
  };
}

/** Cambia el modo de una empresa. Solo se invoca desde el servidor. */
export async function fijarModoMotorEmpresa(entrada: {
  companyId: string;
  modo: UnifiedEngineMode;
  changedBy?: string | null;
}): Promise<void> {
  await supabaseAdmin.from("tax_engine_settings").upsert(
    {
      company_id: entrada.companyId,
      unified_engine_mode: entrada.modo,
      changed_by: entrada.changedBy ?? null,
      changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rollback_reason: null,
      rolled_back_at: null,
    },
    { onConflict: "company_id" },
  );
}

/**
 * Rollback inmediato al modo sombra. No borra cálculos, no revierte
 * migraciones y no altera periodos guardados.
 */
export async function volverAModoSombra(entrada: {
  companyId: string;
  reason: string;
  actor?: string | null;
}): Promise<void> {
  const registro = registrarRollbackAModoSombra({
    companyId: entrada.companyId,
    reason: entrada.reason,
    actor: entrada.actor ?? null,
  });
  await supabaseAdmin.from("tax_engine_settings").upsert(
    {
      company_id: entrada.companyId,
      unified_engine_mode: registro.modo,
      changed_by: entrada.actor ?? null,
      changed_at: registro.rolledBackAt,
      rollback_reason: registro.rollbackReason,
      rolled_back_at: registro.rolledBackAt,
      updated_at: registro.rolledBackAt,
    },
    { onConflict: "company_id" },
  );
}

/** Deja constancia de la evaluación de promoción a `compatibility`. */
export async function registrarPromocionMotor(
  evaluacion: EvaluacionPromocion,
  extras: {
    fromMode: UnifiedEngineMode;
    approvedBy?: string | null;
    goldenCasesPassed?: number;
    goldenCasesTotal?: number;
    visualSnapshotsApproved?: boolean;
  },
): Promise<void> {
  if (!evaluacion.companyId) return;
  await supabaseAdmin.from("tax_engine_promotions").insert({
    company_id: evaluacion.companyId,
    promotion_status: evaluacion.promotionStatus,
    from_mode: extras.fromMode,
    to_mode: "compatibility",
    periods_validated: evaluacion.periodsValidated,
    differences_found: evaluacion.differencesFound,
    golden_cases_passed: extras.goldenCasesPassed ?? 0,
    golden_cases_total: extras.goldenCasesTotal ?? 0,
    visual_snapshots_approved: extras.visualSnapshotsApproved ?? false,
    blocking_reasons: evaluacion.blockingReasons,
    approved_by: extras.approvedBy ?? null,
    approved_at: evaluacion.approvedAt ?? null,
  });
}

export interface ResultadoPeriodoProductivo extends ResultadoCalculoPeriodo {
  taxPeriodId: string;
}

/**
 * Punto de entrada del servidor: reúne antecedentes, resuelve el modo y
 * ejecuta el orquestador único. Devuelve `null` si el periodo no existe.
 */
export async function calcularPeriodoProductivo(entrada: {
  companyId: string;
  period: string;
  productiveContext: ContextoProductivoNoTributario;
  legacyProductive?: ProductiveTaxSummary | null;
  previousProductive?: ProductiveTaxSummary | null;
  existingRun?: EntradaCalculoPeriodo["existingRun"];
  calculatedAt?: string;
}): Promise<ResultadoPeriodoProductivo | null> {
  const antecedentes = await entradaUnificadaPeriodo(entrada.companyId, entrada.period);
  if (!antecedentes) return null;

  const { modo } = await leerModoMotorEmpresa(entrada.companyId);
  const oficial = conceptosOficiales(antecedentes.official);

  const resultado = calculateTaxPeriod({
    companyId: entrada.companyId,
    period: entrada.period,
    configuredMode: modo,
    unifiedInput: antecedentes.unifiedInput,
    productiveContext: entrada.productiveContext,
    legacyProductive: entrada.legacyProductive ?? null,
    previousProductive: entrada.previousProductive ?? null,
    official: oficial.official,
    officialTotal: oficial.officialTotal,
    existingRun: entrada.existingRun ?? null,
    calculatedAt: entrada.calculatedAt,
  });

  return { ...resultado, taxPeriodId: antecedentes.taxPeriodId };
}

/** Metadatos que acompañan a cada resumen mensual persistido. */
export function metadatosCalculo(resultado: ResultadoCalculoPeriodo) {
  return {
    calculation_engine: resultado.calculationEngine,
    unified_engine_mode: resultado.mode,
    unified_engine_version: resultado.engineVersion,
    compatibility_projection_version: resultado.compatibilityProjectionVersion,
    calculation_input_hash: resultado.calculationInputHash,
    calculation_run_status: resultado.runStatus,
    parity_exact: resultado.parity ? resultado.parity.exactParity : null,
    parity_differences_count: resultado.parity?.differences.length ?? 0,
  };
}
