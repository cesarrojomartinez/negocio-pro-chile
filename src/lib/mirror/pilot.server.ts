/**
 * Validación dual piloto ejecutada en el servidor (Etapa 6.8.2).
 *
 * Reglas duras:
 *  - Solo lee información ya almacenada. Nunca llama al proveedor, nunca
 *    inicia sesión en el SII y nunca descarga documentos ni F29.
 *  - `provider_calls` y `credits_used` quedan siempre en cero.
 *  - Ninguna cifra productiva se modifica: la validación solo compara y deja
 *    constancia.
 *  - El cliente no puede invocar nada de este módulo.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import {
  calcularPeriodoProductivo,
  fijarModoMotorEmpresa,
  leerModoMotorEmpresa,
  registrarPromocionMotor,
  volverAModoSombra,
} from "./engineConfig.server";
import { esAliasPiloto, type AliasPiloto } from "./pilot";
import {
  construirInformeValidacionPiloto,
  validarPeriodoPiloto,
  type InformeValidacionPiloto,
  type ResultadoValidacionPiloto,
} from "./pilotValidation";
import { aprobarPromocionCompatibility } from "./pilotPromotion";
import type { ProductiveTaxSummary } from "./productiveSummary";

/** Campos que el contrato antiguo nunca guardó en `tax_monthly_summaries`. */
const CAMPOS_SIN_REGISTRO_LEGADO = ["vatAdvanceApplied"];

/** Resuelve el identificador real de una empresa piloto. Solo en servidor. */
export async function resolverEmpresaPiloto(alias: AliasPiloto): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("tax_pilot_companies")
    .select("company_id")
    .eq("alias", alias)
    .maybeSingle<{ company_id: string }>();
  return data?.company_id ?? null;
}

/** Registra (o actualiza) el alias técnico de una empresa piloto. */
export async function registrarEmpresaPiloto(entrada: {
  alias: AliasPiloto;
  companyId: string;
  notes?: string | null;
}): Promise<void> {
  if (!esAliasPiloto(entrada.alias)) throw new Error("alias_piloto_invalido");
  await supabaseAdmin.from("tax_pilot_companies").upsert(
    {
      alias: entrada.alias,
      company_id: entrada.companyId,
      notes: entrada.notes ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "alias" },
  );
}

interface FilaResumen {
  period: string;
  row: Record<string, unknown>;
}

/** Lee los resúmenes ya guardados. Cero consultas externas. */
async function resumenesAlmacenados(companyId: string): Promise<FilaResumen[]> {
  const { data: periodos } = await supabaseAdmin
    .from("tax_periods")
    .select("id, period")
    .eq("company_id", companyId)
    .order("period", { ascending: true });
  if (!periodos?.length) return [];

  const { data: resumenes } = await supabaseAdmin
    .from("tax_monthly_summaries")
    .select("*")
    .eq("company_id", companyId);

  const porPeriodo = new Map<string, Record<string, unknown>>();
  for (const r of resumenes ?? []) {
    const periodo = periodos.find((p) => p.id === (r as { tax_period_id: string }).tax_period_id);
    if (periodo) porPeriodo.set(periodo.period, r as Record<string, unknown>);
  }

  return periodos
    .filter((p) => porPeriodo.has(p.period))
    .map((p) => ({ period: p.period, row: porPeriodo.get(p.period)! }));
}

function numero(valor: unknown): number {
  // TAX_ZERO_JUSTIFIED: conversión de contadores de auditoría ya persistidos.
  return typeof valor === "number" && Number.isFinite(valor) ? valor : Number(valor ?? 0);
}


/** Reconstruye la cifra visible antigua a partir de lo ya persistido. */
function legadoDesdeResumen(period: string, row: Record<string, unknown>): ProductiveTaxSummary {
  return {
    period,
    salesTotal: numero(row["sales_total"]),
    exemptSales: numero(row["exempt_sales"]),
    purchasesTotal: numero(row["purchases_total"]),
    vatDebit: numero(row["vat_debit"]),
    vatCredit: numero(row["vat_credit"]),
    previousVatCarryforward: numero(row["previous_vat_carryforward"]),
    estimatedVatPayable: numero(row["estimated_vat_payable"]),
    estimatedNewCarryforward: numero(row["estimated_new_carryforward"]),
    ppmTaxBase: numero(row["ppm_tax_base"]),
    ppmRate: (row["ppm_rate"] as number | null) ?? null,
    estimatedPpm: numero(row["estimated_ppm"]),
    estimatedWithholdings: numero(row["estimated_withholdings"]),
    vatAdvanceApplied: null as unknown as number,
    estimatedTaxTotal: numero(row["estimated_tax_total"]),
    preventiveMarginPercent: numero(row["preventive_margin_percent"]),
    preventiveMarginAmount: numero(row["preventive_margin_amount"]),
    recommendedReserve: numero(row["recommended_reserve"]),
    reservedAmount: numero(row["reserved_amount_snapshot"]),
    declaredTaxTotal: (row["declared_tax_total"] as number | null) ?? null,
    carryforwardSource: String(row["carryforward_source"] ?? "unknown"),
    ppmSource: String(row["ppm_source"] ?? "unknown"),
    withholdingsSource: String(row["withholdings_source"] ?? "unknown"),
    periodState: String(row["calculation_status"] ?? "unknown"),
  };
}

export interface OpcionesValidacionPiloto {
  alias: AliasPiloto;
  periodFrom?: string;
  periodTo?: string;
  expectedPeriods?: string[];
  /** Persistencia de snapshots, filas de paridad e informe. */
  persistir?: boolean;
}

export interface SalidaValidacionPiloto {
  alias: AliasPiloto;
  companyId: string;
  informe: InformeValidacionPiloto;
  resultados: ResultadoValidacionPiloto[];
  validationReportId: string | null;
}

/**
 * Ejecuta la validación dual completa de una empresa piloto sobre los
 * antecedentes ya almacenados.
 */
export async function ejecutarValidacionDualPiloto(
  opciones: OpcionesValidacionPiloto,
): Promise<SalidaValidacionPiloto> {
  const companyId = await resolverEmpresaPiloto(opciones.alias);
  if (!companyId) throw new Error("empresa_piloto_no_registrada");

  const inicio = Date.now();
  const filas = (await resumenesAlmacenados(companyId)).filter(
    (f) =>
      (!opciones.periodFrom || f.period >= opciones.periodFrom) &&
      (!opciones.periodTo || f.period <= opciones.periodTo),
  );

  const resultados: ResultadoValidacionPiloto[] = [];
  for (const fila of filas) {
    const legacy = legadoDesdeResumen(fila.period, fila.row);
    const calculo = await calcularPeriodoProductivo({
      companyId,
      period: fila.period,
      productiveContext: {
        salesTotal: legacy.salesTotal,
        exemptSales: legacy.exemptSales,
        purchasesTotal: legacy.purchasesTotal,
        preventiveMarginPercent: legacy.preventiveMarginPercent,
        reservedAmount: legacy.reservedAmount,
        carryforwardSource: legacy.carryforwardSource,
        ppmSource: legacy.ppmSource,
        withholdingsSource: legacy.withholdingsSource,
        periodState: legacy.periodState,
      },
      legacyProductive: legacy,
      previousProductive: legacy,
    });
    if (!calculo) continue;

    resultados.push(
      validarPeriodoPiloto({
        companyAlias: opciones.alias,
        period: fila.period,
        resultado: calculo,
        legacy,
        compatibility: calculo.compatibility ?? calculo.productive,

        camposSinRegistroLegado: CAMPOS_SIN_REGISTRO_LEGADO,
        visible: {
          hasOfficialF29: legacy.declaredTaxTotal != null,
          periodSource: String(fila.row["source"] ?? "stored"),
          legacyPeriodSource: String(fila.row["source"] ?? "stored"),
        },
      }),
    );
  }

  const informe = construirInformeValidacionPiloto({
    companyAlias: opciones.alias,
    expectedPeriods: opciones.expectedPeriods,
    resultados,
    calculationMs: Date.now() - inicio,
  });

  let validationReportId: string | null = null;
  if (opciones.persistir !== false) {
    validationReportId = await persistirValidacionPiloto(companyId, informe, resultados);
  }

  return { alias: opciones.alias, companyId, informe, resultados, validationReportId };
}

/** Guarda snapshots sanitizados, filas de paridad e informe. Idempotente. */
export async function persistirValidacionPiloto(
  companyId: string,
  informe: InformeValidacionPiloto,
  resultados: ResultadoValidacionPiloto[],
): Promise<string | null> {
  for (const resultado of resultados) {
    const s = resultado.snapshot;
    await supabaseAdmin.from("tax_parity_snapshots").upsert(
      {
        company_id: companyId,
        company_alias: s.companyAlias,
        period: s.period,
        calculation_input_hash: s.calculationInputHash,
        engine_version: s.engineVersion,
        rules_version: s.rulesVersion,
        projection_version: s.projectionVersion,
        visible_values: s.visibleValues,
        visible_sources: s.visibleSources,
        visible_states: s.visibleStates,
        main_labels: s.mainLabels,
        has_official_f29: s.hasOfficialF29,
        official_reference_hash: s.officialReferenceHash,
        period_state: s.periodState,
        provider_called: false,
        // TAX_ZERO_JUSTIFIED: contador de créditos, no es un monto tributario.
        credits_used: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,period,calculation_input_hash" },
    );

    if (resultado.rows.length > 0) {
      await supabaseAdmin.from("tax_parity_results").upsert(
        resultado.rows.map((r) => ({
          company_id: companyId,
          company_alias: r.companyAlias,
          period: r.period,
          field: r.field,
          legacy_value: r.legacyValue,
          unified_raw_value: r.unifiedRawValue,
          compatibility_value: r.compatibilityValue,
          official_value: r.officialValue,
          legacy_vs_compatibility_difference: r.legacyVsCompatibilityDifference,
          unified_vs_official_difference: r.unifiedVsOfficialDifference,
          difference_category: r.differenceCategory,
          explanation: r.explanation,
          blocking: r.blocking,
          calculation_input_hash: r.calculationInputHash,
          validated_at: r.validatedAt,
        })),
        { onConflict: "company_id,period,field,calculation_input_hash" },
      );
    }
  }

  const { data } = await supabaseAdmin
    .from("tax_pilot_validation_reports")
    .insert({
      company_id: companyId,
      company_alias: informe.companyAlias,
      period_from: informe.periodFrom,
      period_to: informe.periodTo,
      periods_found: informe.periodsFound,
      periods_validated: informe.periodsValidated,
      periods_exact: informe.periodsExact,
      compatibility_differences: informe.compatibilityDifferences,
      official_differences: informe.officialDifferences,
      compatibility_fallbacks: informe.compatibilityFallbacks,
      unknown_components: informe.unknownComponents,
      unsupported_components: informe.unsupportedComponents,
      runs_reused: informe.runsReused,
      calculation_ms: informe.calculationMs,
      // TAX_ZERO_JUSTIFIED: la validación jamás llama al proveedor.
      provider_calls: 0,
      credits_used: 0,
      blocking_reasons: informe.blockingReasons,
      promotion_ready: informe.promotionReady,
      engine_version: informe.engineVersion,
      projection_version: informe.projectionVersion,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  return data?.id ?? null;
}

/** Cambia una empresa piloto a `dual_validation`. Solo desde el servidor. */
export async function activarValidacionDualPiloto(entrada: {
  alias: AliasPiloto;
  actor?: string | null;
}): Promise<{ companyId: string }> {
  const companyId = await resolverEmpresaPiloto(entrada.alias);
  if (!companyId) throw new Error("empresa_piloto_no_registrada");
  await fijarModoMotorEmpresa({
    companyId,
    modo: "dual_validation",
    changedBy: entrada.actor ?? null,
  });
  return { companyId };
}

export interface EntradaPromocionPiloto {
  alias: AliasPiloto;
  approvedBy: string;
  approvalReason: string;
  validationReportId: string;
  expectedPeriods?: string[];
  goldenCasesPassed: number;
  goldenCasesTotal: number;
  visualSnapshotsApproved: boolean;
}

/**
 * Promoción explícita a `compatibility`. Nunca automática: exige informe sin
 * bloqueos, aprobador y razón.
 */
export async function aprobarPromocionPiloto(entrada: EntradaPromocionPiloto) {
  const companyId = await resolverEmpresaPiloto(entrada.alias);
  if (!companyId) throw new Error("empresa_piloto_no_registrada");

  const { data: reporte } = await supabaseAdmin
    .from("tax_pilot_validation_reports")
    .select("*")
    .eq("id", entrada.validationReportId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!reporte) throw new Error("informe_de_validacion_no_encontrado");

  const fila = reporte as Record<string, unknown>;
  const informe: InformeValidacionPiloto = {
    companyAlias: entrada.alias,
    periodFrom: (fila["period_from"] as string | null) ?? null,
    periodTo: (fila["period_to"] as string | null) ?? null,
    periodsFound: numero(fila["periods_found"]),
    periodsValidated: numero(fila["periods_validated"]),
    periodsExact: numero(fila["periods_exact"]),
    compatibilityDifferences: numero(fila["compatibility_differences"]),
    officialDifferences: numero(fila["official_differences"]),
    compatibilityFallbacks: numero(fila["compatibility_fallbacks"]),
    unknownComponents: numero(fila["unknown_components"]),
    unsupportedComponents: numero(fila["unsupported_components"]),
    runsReused: numero(fila["runs_reused"]),
    calculationMs: numero(fila["calculation_ms"]),
    providerCalls: 0,
    creditsUsed: 0,
    blockingReasons: (fila["blocking_reasons"] as string[]) ?? [],
    promotionReady: Boolean(fila["promotion_ready"]),
    engineVersion: String(fila["engine_version"] ?? ""),
    projectionVersion: String(fila["projection_version"] ?? ""),
    blockedCode: null,
  };

  const modoActual = await leerModoMotorEmpresa(companyId);
  const decision = aprobarPromocionCompatibility({
    companyId,
    companyAlias: entrada.alias,
    informe,
    expectedPeriods: entrada.expectedPeriods,
    goldenCasesPassed: entrada.goldenCasesPassed,
    goldenCasesTotal: entrada.goldenCasesTotal,
    visualSnapshotsApproved: entrada.visualSnapshotsApproved,
    approvedBy: entrada.approvedBy,
    approvalReason: entrada.approvalReason,
    validationReportId: entrada.validationReportId,
  });

  await registrarPromocionMotor(decision.evaluation, {
    fromMode: modoActual.modo,
    approvedBy: decision.approvedBy,
    goldenCasesPassed: entrada.goldenCasesPassed,
    goldenCasesTotal: entrada.goldenCasesTotal,
    visualSnapshotsApproved: entrada.visualSnapshotsApproved,
  });

  if (decision.approved) {
    await fijarModoMotorEmpresa({
      companyId,
      modo: "compatibility",
      changedBy: entrada.approvedBy,
    });
  }

  return decision;
}

/** Rollback real: vuelve a `shadow` sin borrar cálculos ni comparaciones. */
export async function ejecutarRollbackPiloto(entrada: {
  alias: AliasPiloto;
  reason: string;
  actor?: string | null;
}): Promise<{ companyId: string }> {
  const companyId = await resolverEmpresaPiloto(entrada.alias);
  if (!companyId) throw new Error("empresa_piloto_no_registrada");
  await volverAModoSombra({
    companyId,
    reason: entrada.reason,
    actor: entrada.actor ?? null,
  });
  return { companyId };
}
