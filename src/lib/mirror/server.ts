import { supabaseAdmin } from "@/integrations/supabase/client.server";

import {
  evaluarCertezaPeriodo,
  valoresTributarios,
  type PeriodCalculationCertainty,
  type TaxComponentValue,
} from "./certainty";
import { compararMotores, type ComparacionMotores } from "./comparison";
import { ejecutarMotorEspejo, montoDe } from "./engine";
import { resolverModoMotorEspejo } from "./flags";
import { deduplicarHechos, hashOrigen, normalizarResumenRcv } from "./normalize";
import { construirContextoOficial, leerCodigo, CODIGO } from "./officialContext";
import { auditarCeros } from "./zeroPolicy";
import type { MirrorEngineResult, NormalizedTaxFact } from "./types";
import type { HistoricalOfficialContext } from "./types";

/**
 * Ejecución del Motor Espejo en **modo sombra**.
 *
 * Este módulo nunca escribe en las tablas que alimentan la interfaz
 * (`tax_monthly_summaries`, `tax_periods`, `tax_f29_history`). Solo escribe en
 * las tablas espejo, que no se leen desde ninguna pantalla.
 */

interface FilaPeriodo {
  id: string;
  period: string;
  rcv_summary: unknown;
}

interface FilaF29 {
  declaration_status: string | null;
  source: string | null;
  raw_data: { codigos?: Record<string, number>; folio?: string } | null;
}

function codigosDe(fila: FilaF29 | null | undefined): Record<string, number> | null {
  const codigos = fila?.raw_data?.codigos;
  return codigos && Object.keys(codigos).length > 0 ? codigos : null;
}

function contextoOficialDe(
  period: string,
  fila: FilaF29 | null | undefined,
): HistoricalOfficialContext | null {
  const codigos = codigosDe(fila);
  if (!codigos) return null;
  const cantidad = Object.keys(codigos).length;
  return construirContextoOficial({
    period,
    codes: codigos,
    folio: fila?.raw_data?.folio ?? null,
    declarationStatus: fila?.declaration_status ?? null,
    extractionStatus: cantidad >= 10 ? "valid" : "partial",
    confidence: cantidad >= 10 ? "medium" : "low",
    source: fila?.source ?? null,
  });
}

function hechosDelPeriodo(period: string, fila: FilaPeriodo): NormalizedTaxFact[] {
  const resumen = (fila.rcv_summary ?? null) as {
    ventas?: unknown;
    compras?: unknown;
  } | null;
  if (!resumen) return [];
  const meta = { period, source: "rcv" as const, sourceReference: fila.id };
  return deduplicarHechos([
    ...normalizarResumenRcv(resumen.ventas as never, "sales", meta),
    ...normalizarResumenRcv(resumen.compras as never, "purchases_registry", meta),
  ]);
}

async function guardarHechos(
  companyId: string,
  taxPeriodId: string,
  hechos: NormalizedTaxFact[],
): Promise<void> {
  if (hechos.length === 0) return;
  await supabaseAdmin.from("tax_normalized_facts").upsert(
    hechos.map((h) => ({
      company_id: companyId,
      tax_period_id: taxPeriodId,
      period: h.period,
      ledger: h.ledger,
      scope: h.granularity,
      document_type_code: h.documentType,
      document_count: h.documentCount,
      net_amount: h.taxableNet,
      vat_amount: h.vatAmount,
      exempt_amount: h.exemptAmount,
      vat_common_use: h.vatCommonUse,
      vat_non_recoverable: h.vatNonRecoverable,
      total_amount: h.totalAmount,
      tax_effect: h.taxEffect,
      source: h.source,
      source_reference: h.snapshotId,
      observed_at: new Date().toISOString(),
      raw_hash: h.rawHash,
      normalization_version: h.normalizationVersion,
      
    })),
    { onConflict: "company_id,period,ledger,scope,document_type_code,raw_hash", ignoreDuplicates: true },
  );
}

async function guardarCorrida(
  companyId: string,
  taxPeriodId: string,
  resultado: MirrorEngineResult,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("tax_mirror_calculation_runs")
    .insert({
      company_id: companyId,
      tax_period_id: taxPeriodId,
      period: resultado.period,
      engine_version: resultado.engineVersion,
      rules_version: resultado.engineVersion,
      normalization_version: resultado.normalizationVersion,
      mode: "shadow_only",
      completeness:
        resultado.missingComponentCount === 0 ? "complete" : "incomplete",
      missing_inputs: Array.from(
        new Set(resultado.components.flatMap((c) => c.missingInputs ?? [])),
      ),
      total_before_surcharges: montoDe(resultado, "tax_total_before_surcharges"),
      official_declared_total: montoDe(resultado, "official_declared_total"),
      confirmed_paid_total: montoDe(resultado, "confirmed_paid_total"),
      input_hash: hashOrigen({ period: resultado.period, components: resultado.components.length }),
      calculated_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  const runId = data?.id ?? null;
  if (!runId) return null;

  await supabaseAdmin.from("tax_component_calculations").insert(
    resultado.components.map((c) => ({
      run_id: runId,
      company_id: companyId,
      period: resultado.period,
      concept: c.concept,
      amount: c.amount,
      status: c.status,
      rule_id: c.ruleId,
      rule_version: c.ruleVersion,
      sources: c.sources,
      input_values: c.inputValues,
      missing_inputs: c.missingInputs ?? [],
      warnings: c.warnings ?? [],
      confidence: c.confidence,
      calculation_description: c.calculationDescription,
    })),
  );
  return runId;
}

/** Guarda la certeza del periodo. Tabla espejo: no la lee ninguna pantalla. */
async function guardarCerteza(
  companyId: string,
  taxPeriodId: string,
  runId: string | null,
  resultado: MirrorEngineResult,
  certeza: PeriodCalculationCertainty,
  valores: TaxComponentValue[],
): Promise<void> {
  await supabaseAdmin.from("tax_period_calculation_certainty").upsert(
    {
      company_id: companyId,
      tax_period_id: taxPeriodId,
      period: resultado.period,
      run_id: runId,
      engine_version: resultado.engineVersion,
      completeness: certeza.completeness,
      confidence: certeza.confidence,
      can_present_total: certeza.canPresentTotal,
      reason: certeza.reason,
      blocking_concepts: certeza.blockingConcepts,
      estimated_concepts: certeza.estimatedConcepts,
      conflicting_concepts: certeza.conflictingConcepts,
      unsupported_concepts: certeza.unsupportedConcepts,
      not_applicable_concepts: certeza.notApplicableConcepts,
      missing_inputs: certeza.missingInputs,
      zero_audit: JSON.parse(JSON.stringify(auditarCeros(valores))),
      component_values: JSON.parse(JSON.stringify(valores)),
      calculated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,period,engine_version" },
  );
}

export interface ResultadoSombraPeriodo {
  period: string;
  runId: string | null;
  resultado: MirrorEngineResult;
  comparacion: ComparacionMotores;
  certeza: PeriodCalculationCertainty;
}

/**
 * Recalcula un periodo con el Motor Espejo y guarda hechos, componentes y la
 * comparación con el motor actual. No modifica ninguna cifra visible.
 */
export async function ejecutarSombraPeriodo(
  companyId: string,
  period: string,
  opciones: { persistir?: boolean } = {},
): Promise<ResultadoSombraPeriodo | null> {
  const modo = resolverModoMotorEspejo({ isProduction: false });
  const persistir = (opciones.persistir ?? true) && modo.habilitado;

  const { data: periodoRow } = await supabaseAdmin
    .from("tax_periods")
    .select("id, period, rcv_summary")
    .eq("company_id", companyId)
    .eq("period", period)
    .maybeSingle<FilaPeriodo>();
  if (!periodoRow) return null;

  const [{ data: f29Row }, { data: resumenRow }] = await Promise.all([
    supabaseAdmin
      .from("tax_f29_history")
      .select("declaration_status, source, raw_data")
      .eq("company_id", companyId)
      .eq("tax_period_id", periodoRow.id)
      .maybeSingle<FilaF29>(),
    supabaseAdmin
      .from("tax_monthly_summaries")
      .select("estimated_tax_total, pre_f29_tax_total, estimated_vat_payable, estimated_ppm, estimated_withholdings")
      .eq("company_id", companyId)
      .eq("tax_period_id", periodoRow.id)
      .maybeSingle<{
        estimated_tax_total: number | null;
        pre_f29_tax_total: number | null;
        estimated_vat_payable: number | null;
        estimated_ppm: number | null;
        estimated_withholdings: number | null;
      }>(),
  ]);

  const { data: previoRow } = await supabaseAdmin
    .from("tax_f29_history")
    .select("declaration_status, source, raw_data, tax_periods!inner(period)")
    .eq("company_id", companyId)
    .lt("tax_periods.period", period)
    .order("tax_periods(period)", { ascending: false })
    .limit(1)
    .maybeSingle<FilaF29 & { tax_periods: { period: string } }>();

  const official = contextoOficialDe(period, f29Row);
  const previousOfficial = previoRow
    ? contextoOficialDe(previoRow.tax_periods.period, previoRow)
    : null;

  const hechos = hechosDelPeriodo(period, periodoRow);
  const resultado = ejecutarMotorEspejo({
    period,
    facts: hechos,
    official,
    previousOfficial,
    calculatedAt: new Date().toISOString(),
  });

  const comparacion = compararMotores({
    period,
    mirror: resultado,
    currentEngine: {
      vat_determined: resumenRow?.estimated_vat_payable ?? null,
      ppm_amount: resumenRow?.estimated_ppm ?? null,
      withholdings: resumenRow?.estimated_withholdings ?? null,
    },
    official: official
      ? {
          vat_determined: leerCodigo(official, CODIGO.ivaDeterminado),
          vat_advance_change_of_subject: leerCodigo(official, CODIGO.anticipoImputado),
          ppm_amount: leerCodigo(official, CODIGO.ppm),
          withholdings: leerCodigo(official, CODIGO.retenciones),
          tax_total_before_surcharges: leerCodigo(official, CODIGO.subtotalDeterminado),
        }
      : {},
    currentEngineTotal: resumenRow?.pre_f29_tax_total ?? resumenRow?.estimated_tax_total ?? null,
    officialTotal: official ? leerCodigo(official, CODIGO.totalAPagar) : null,
  });

  if (!persistir) return { period, runId: null, resultado, comparacion };

  await guardarHechos(companyId, periodoRow.id, hechos);
  const runId = await guardarCorrida(companyId, periodoRow.id, resultado);

  await supabaseAdmin.from("tax_engine_comparisons").upsert(
    {
      company_id: companyId,
      tax_period_id: periodoRow.id,
      period,
      run_id: runId,
      current_engine_total: comparacion.currentEngineTotal,
      mirror_engine_total: comparacion.mirrorEngineTotal,
      official_total: comparacion.officialTotal,
      current_vs_official_difference: comparacion.currentVsOfficialDifference,
      mirror_vs_official_difference: comparacion.mirrorVsOfficialDifference,
      comparison_status: comparacion.comparisonStatus,
      component_differences: JSON.parse(JSON.stringify(comparacion.componentDifferences)),
      explained_difference: comparacion.currentVsMirrorDifference,
      unexplained_difference: comparacion.mirrorVsOfficialDifference,
    },
    { onConflict: "company_id,period,run_id" },
  );

  return { period, runId, resultado, comparacion };
}

/** Ejecuta el modo sombra sobre varios periodos, en orden cronológico. */
export async function ejecutarSombraHistorial(
  companyId: string,
  periodos: string[],
  opciones: { persistir?: boolean } = {},
): Promise<ResultadoSombraPeriodo[]> {
  const salida: ResultadoSombraPeriodo[] = [];
  for (const period of [...periodos].sort()) {
    const r = await ejecutarSombraPeriodo(companyId, period, opciones);
    if (r) salida.push(r);
  }
  return salida;
}

/** Hash de entrada reutilizable para auditar reproducibilidad. */
export const hashEntradaSombra = hashOrigen;
