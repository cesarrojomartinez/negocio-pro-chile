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

const RE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `changed_by` y `approved_by` son columnas `uuid`. Un actor operativo que no
 * es un usuario (por ejemplo un script de cierre) se guarda como `null` en vez
 * de romper silenciosamente la escritura.
 */
function actorUuid(valor?: string | null): string | null {
  return valor && RE_UUID.test(valor) ? valor : null;
}

/** Cambia el modo de una empresa. Solo se invoca desde el servidor. */
export async function fijarModoMotorEmpresa(entrada: {
  companyId: string;
  modo: UnifiedEngineMode;
  changedBy?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("tax_engine_settings").upsert(
    {
      company_id: entrada.companyId,
      unified_engine_mode: entrada.modo,
      changed_by: actorUuid(entrada.changedBy),
      changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rollback_reason: null,
      rolled_back_at: null,
    },
    { onConflict: "company_id" },
  );
  // Sin fallo silencioso: un modo que no se guarda deja la empresa en shadow.
  if (error) throw new Error(`no_se_pudo_fijar_modo_motor: ${error.message}`);
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
  const { error } = await supabaseAdmin.from("tax_engine_settings").upsert(
    {
      company_id: entrada.companyId,
      unified_engine_mode: registro.modo,
      changed_by: actorUuid(entrada.actor),
      changed_at: registro.rolledBackAt,
      rollback_reason: registro.rollbackReason,
      rolled_back_at: registro.rolledBackAt,
      updated_at: registro.rolledBackAt,
    },
    { onConflict: "company_id" },
  );
  if (error) throw new Error(`no_se_pudo_volver_a_shadow: ${error.message}`);
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
  const { error } = await supabaseAdmin.from("tax_engine_promotions").insert({
    company_id: evaluacion.companyId,
    promotion_status: evaluacion.promotionStatus,
    from_mode: extras.fromMode,
    to_mode: "compatibility",
    periods_validated: evaluacion.periodsValidated,
    differences_found: evaluacion.differencesFound,
    // TAX_ZERO_JUSTIFIED: metadatos de auditoría, no montos tributarios.
    golden_cases_passed: extras.goldenCasesPassed ?? 0,
    golden_cases_total: extras.goldenCasesTotal ?? 0,
    visual_snapshots_approved: extras.visualSnapshotsApproved ?? false,
    blocking_reasons: evaluacion.blockingReasons,
    approved_by: actorUuid(extras.approvedBy),
    approved_at: evaluacion.approvedAt ?? null,
  });
  if (error) throw new Error(`no_se_pudo_registrar_promocion: ${error.message}`);
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
    configFingerprint: {
      optionalConfig: antecedentes.optionalConfig,
    },
    calculatedAt: entrada.calculatedAt,
  });

  return { ...resultado, taxPeriodId: antecedentes.taxPeriodId };
}

/**
 * Registra la corrida productiva del núcleo unificado. Idempotente: si ya
 * existe una corrida con el mismo `calculation_input_hash` se reutiliza su id.
 * Solo se invoca cuando el periodo se calculó realmente en `compatibility`.
 */
export async function persistirCorridaProductiva(
  resultado: ResultadoPeriodoProductivo,
): Promise<string | null> {
  if (resultado.mode !== "compatibility" || resultado.runStatus !== "completed") return null;
  if (!resultado.unified || !resultado.projection || !resultado.companyId) return null;

  const { data: existente } = await supabaseAdmin
    .from("tax_mirror_calculation_runs")
    .select("id")
    .eq("company_id", resultado.companyId)
    .eq("period", resultado.period)
    .eq("mode", "compatibility")
    .eq("input_hash", resultado.calculationInputHash)
    .maybeSingle<{ id: string }>();
  if (existente?.id) return existente.id;

  const { data, error } = await supabaseAdmin
    .from("tax_mirror_calculation_runs")
    .insert({
      company_id: resultado.companyId,
      tax_period_id: resultado.taxPeriodId,
      period: resultado.period,
      engine_version: resultado.engineVersion,
      rules_version: resultado.engineVersion,
      normalization_version: resultado.unified.normalizationVersion,
      mode: "compatibility",
      completeness: resultado.unified.certainty.completeness,
      missing_inputs: resultado.unified.certainty.missingInputs,
      total_before_surcharges: resultado.projection.values.totalTributarioEstimado,
      official_declared_total: resultado.projection.officialDeclaredTotal,
      confirmed_paid_total: null,
      input_hash: resultado.calculationInputHash,
      calculated_at: resultado.calculatedAt,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(`no_se_pudo_registrar_corrida: ${error.message}`);
  return data?.id ?? null;
}

/** Metadatos que acompañan a cada resumen mensual persistido. */
export function metadatosCalculo(
  resultado: ResultadoCalculoPeriodo,
  calculationRunId?: string | null,
) {
  return {
    calculation_engine: resultado.calculationEngine,
    unified_engine_mode: resultado.mode,
    unified_engine_version: resultado.engineVersion,
    compatibility_projection_version: resultado.compatibilityProjectionVersion,
    calculation_input_hash: resultado.calculationInputHash,
    calculation_run_status: resultado.runStatus,
    calculation_run_id: calculationRunId ?? resultado.calculationRunId ?? null,
    certainty_status: resultado.unified?.certainty.completeness ?? null,
    legacy_fallback_count: resultado.projection ? resultado.legacyFallbackCount : null,
    parity_exact: resultado.parity ? resultado.parity.exactParity : null,
    // TAX_ZERO_JUSTIFIED: conteo de diferencias, no es un monto tributario.
    parity_differences_count: resultado.parity?.differences.length ?? 0,
  };
}
