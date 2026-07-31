import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ErrorNegocio, exigirRol, registrarActividad } from "@/lib/companies.server";
import { construirDashboard } from "@/lib/dashboardBuilder";
import {
  aplicarAntecedenteF29,
  interpretarAntecedenteF29,
  resolverRemanenteAnterior,
  resolverTasaPpm,
} from "@/lib/f29Antecedent";

import {
  conciliarRemanente,
  hayHistorialDeVigencias,
  seleccionarParametroVigente,
  type FilaParametroVigencia,
} from "@/lib/vigenciaParametros";
import { diasDePeriodo, estadoDesdeRcv, periodoAnterior } from "@/lib/taxMappers";
import { estadoDelPeriodo, nivelDesdeEspanol } from "@/utils/taxCalculations";
import type { CarryforwardSource, PpmSource, WithholdingsSource } from "@/types/engine";
import type { DocumentoTributario, PeriodoData } from "@/types/tax";
import {
  agregadosComprasDeResumen,
  agregadosVentasDeResumen,
} from "@/integrations/sii/rcvSummary";

import type { Empresa } from "@/types/company";

interface FilaDocumento {
  id: string;
  document_direction: string;
  document_type: string;
  folio: number;
  document_date: string;
  counterparty_name: string;
  counterparty_rut: string | null;
  net_amount: number;
  vat_amount: number;
  exempt_amount: number;
  total_amount: number;
  rcv_status: string;
}

function mapear(fila: FilaDocumento): DocumentoTributario {
  const direccion = fila.document_direction as "sale" | "purchase";
  return {
    id: fila.id,
    fecha: fila.document_date,
    tipoDocumento: fila.document_type as DocumentoTributario["tipoDocumento"],
    folio: Number(fila.folio),
    contraparte: fila.counterparty_name,
    rutContraparte: fila.counterparty_rut ?? "",
    neto: Number(fila.net_amount),
    iva: Number(fila.vat_amount),
    exento: Number(fila.exempt_amount),
    total: Number(fila.total_amount),
    estado: estadoDesdeRcv(direccion, fila.rcv_status) as DocumentoTributario["estado"],
    periodo: fila.document_date.slice(0, 7),
  };
}

async function periodoId(companyId: string, periodo: string) {
  const { data } = await supabaseAdmin
    .from("tax_periods")
    .select("id, status, rcv_summary")
    .eq("company_id", companyId)
    .eq("period", periodo)
    .maybeSingle();
  return data ?? null;
}


async function documentos(companyId: string, taxPeriodId: string) {
  const { data } = await supabaseAdmin
    .from("tax_documents")
    .select(
      "id, document_direction, document_type, folio, document_date, counterparty_name, counterparty_rut, net_amount, vat_amount, exempt_amount, total_amount, rcv_status",
    )
    .eq("company_id", companyId)
    .eq("tax_period_id", taxPeriodId)
    .order("document_date", { ascending: true });
  const filas = (data ?? []) as FilaDocumento[];
  return {
    venta: filas.filter((f) => f.document_direction === "sale").map(mapear),
    compra: filas.filter((f) => f.document_direction === "purchase").map(mapear),
  };
}

/**
 * Antecedentes del periodo anterior: nuevo remanente calculado y si sus
 * cifras fueron confirmadas por el contador. Un F29 simulado con ceros nunca
 * se interpreta como remanente confirmado.
 */
async function contextoPeriodoPrevio(
  companyId: string,
  periodoPrevioId: string | null,
): Promise<{ remanente: number | null; confirmado: boolean }> {
  if (!periodoPrevioId) return { remanente: null, confirmado: false };

  const { data: f29 } = await supabaseAdmin
    .from("tax_f29_history")
    .select(
      "declaration_status, declared_vat, declared_ppm, declared_withholdings, declared_total, vat_carryforward, source, raw_data",
    )
    .eq("company_id", companyId)
    .eq("tax_period_id", periodoPrevioId)
    .maybeSingle();
  const confirmado = !!interpretarAntecedenteF29(f29)?.confirmado;

  const { data: resumen } = await supabaseAdmin
    .from("tax_monthly_summaries")
    .select("estimated_new_carryforward")
    .eq("company_id", companyId)
    .eq("tax_period_id", periodoPrevioId)
    .maybeSingle();

  return {
    remanente:
      resumen?.estimated_new_carryforward == null
        ? null
        : Number(resumen.estimated_new_carryforward),
    confirmado,
  };
}

/**
 * Parámetro tributario de la empresa vigente al inicio del periodo.
 * Devuelve además si la empresa tiene historial de vigencias, porque en ese
 * caso una tasa global sin fecha ya no puede aplicarse a periodos antiguos.
 */
async function parametroVigente(
  companyId: string,
  tipo: "ppm_rate" | "usual_withholdings" | "preventive_margin" | "taxpayer_regime",
  periodo: string,
): Promise<{ valor: number | null; hayHistorial: boolean }> {
  const { data } = await supabaseAdmin
    .from("tax_company_tax_parameters")
    .select("value, effective_from, effective_to, confirmed, source, confirmed_at")
    .eq("company_id", companyId)
    .eq("parameter_type", tipo)
    .eq("confirmed", true)
    .order("effective_from", { ascending: false });

  const filas = (data ?? []) as FilaParametroVigencia[];
  const vigente = seleccionarParametroVigente(filas, periodo);
  return { valor: vigente?.valor ?? null, hayHistorial: hayHistorialDeVigencias(filas) };
}


/** Última tasa de PPM confirmada por el contador en periodos anteriores. */
async function tasaPpmConfirmadaPrevia(companyId: string, periodo: string) {
  const { data: periodos } = await supabaseAdmin
    .from("tax_periods")
    .select("id, period")
    .eq("company_id", companyId)
    .lt("period", periodo)
    .order("period", { ascending: false })
    .limit(12);
  const lista = periodos ?? [];
  if (lista.length === 0) return null;

  const { data: filas } = await supabaseAdmin
    .from("tax_f29_history")
    .select(
      "tax_period_id, declaration_status, declared_vat, declared_ppm, declared_withholdings, declared_total, vat_carryforward, source, raw_data",
    )
    .eq("company_id", companyId)
    .in(
      "tax_period_id",
      lista.map((p) => p.id),
    );

  for (const p of lista) {
    const fila = (filas ?? []).find((f) => f.tax_period_id === p.id);
    if (!fila) continue;
    const antecedente = interpretarAntecedenteF29(fila);
    if (antecedente?.confirmado && antecedente.tasaPpm && antecedente.tasaPpm > 0)
      return antecedente.tasaPpm;
  }
  return null;
}



export interface ResultadoRecalculo {
  periodo: string;
  ivaDebito: number;
  ivaCredito: number;
  ivaCreditoPotencial: number;
  remanenteAnterior: number;
  fuenteRemanente: CarryforwardSource;
  ivaEstimado: number;
  nuevoRemanente: number;
  ppmEstimado: number;
  tasaPpm: number | null;
  fuentePpm: PpmSource;
  retencionesEstimadas: number;
  fuenteRetenciones: WithholdingsSource;
  totalTributarioEstimado: number;
  margenPreventivo: number;
  reservaRecomendada: number;
  proyeccionVentas: number;
  confiabilidad: string;
  razones: string[];
  calculadoEn: string;
}

/**
 * Recalcula un periodo desde los datos persistidos y guarda el resumen.
 * Nunca acepta montos calculados en el navegador.
 */
export async function recalculateTaxPeriod(
  userId: string,
  entrada: { companyId: string; periodo: string },
): Promise<ResultadoRecalculo> {
  await exigirRol(userId, entrada.companyId, ["owner", "business_user", "accountant"]);

  const { data: empresaRow } = await supabaseAdmin
    .from("tax_companies")
    .select(
      "id, rut, business_name, fantasy_name, business_activity, connection_status, last_sync_at, is_demo",
    )
    .eq("id", entrada.companyId)
    .maybeSingle();
  if (!empresaRow) throw new ErrorNegocio("No pudimos cargar la empresa.");

  const periodoRow = await periodoId(entrada.companyId, entrada.periodo);
  if (!periodoRow) throw new ErrorNegocio("El periodo indicado no existe en tu empresa.");

  const previoNombre = periodoAnterior(entrada.periodo);
  const previoRow = await periodoId(entrada.companyId, previoNombre);

  const docs = await documentos(entrada.companyId, periodoRow.id);
  const docsPrevios = previoRow
    ? await documentos(entrada.companyId, previoRow.id)
    : { venta: [], compra: [] };

  const { data: settings } = await supabaseAdmin
    .from("tax_company_settings")
    .select(
      "monthly_sales_goal, reserved_amount, preventive_margin_percent, estimated_ppm_rate, ppm_rate_confirmed",
    )

    .eq("company_id", entrada.companyId)
    .maybeSingle();

  const { data: metaRow } = await supabaseAdmin
    .from("tax_sales_goals")
    .select("goal_amount")
    .eq("company_id", entrada.companyId)
    .eq("tax_period_id", periodoRow.id)
    .maybeSingle();

  const { data: resumenActual } = await supabaseAdmin
    .from("tax_monthly_summaries")
    .select("estimated_withholdings, withholdings_source")
    .eq("company_id", entrada.companyId)
    .eq("tax_period_id", periodoRow.id)
    .maybeSingle();

  const { data: syncRow } = await supabaseAdmin
    .from("tax_sync_runs")
    .select("status, completed_at")
    .eq("company_id", entrada.companyId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const esDemo = !!empresaRow.is_demo;

  const tasaPpmCruda = settings?.estimated_ppm_rate;
  const tasaPpmConfigurada =
    tasaPpmCruda == null || Number(tasaPpmCruda) <= 0 ? null : Number(tasaPpmCruda);

  // Antecedente del F29 del propio periodo confirmado por el contador.
  const { data: f29Periodo } = await supabaseAdmin
    .from("tax_f29_history")
    .select(
      "declaration_status, declared_vat, declared_ppm, declared_withholdings, declared_total, vat_carryforward, source, raw_data",
    )
    .eq("company_id", entrada.companyId)
    .eq("tax_period_id", periodoRow.id)
    .maybeSingle();
  const antecedente = interpretarAntecedenteF29(f29Periodo);
  const confirmado = !!antecedente?.confirmado;

  const previo = await contextoPeriodoPrevio(entrada.companyId, previoRow?.id ?? null);
  const remanente = resolverRemanenteAnterior({
    esDemo,
    antecedentePeriodo: antecedente,
    remanenteCalculadoPrevio: previo.remanente,
    periodoAnteriorConfirmado: previo.confirmado,
  });

  const tasaPrevia = esDemo
    ? null
    : await tasaPpmConfirmadaPrevia(entrada.companyId, entrada.periodo);
  const paramPpm = esDemo
    ? { valor: null, hayHistorial: false }
    : await parametroVigente(entrada.companyId, "ppm_rate", entrada.periodo);
  const tasaResuelta = resolverTasaPpm({
    esDemo,
    antecedentePeriodo: antecedente,
    tasaParametroVigente: paramPpm.valor,
    hayHistorialVigencias: paramPpm.hayHistorial,
    tasaConfigurada: tasaPpmConfigurada,
    configuracionConfirmada: !!settings?.ppm_rate_confirmed,
    tasaConfirmadaPrevia: tasaPrevia,
  });

  const paramRetenciones = esDemo
    ? { valor: null, hayHistorial: false }
    : await parametroVigente(entrada.companyId, "usual_withholdings", entrada.periodo);
  const retencionesParametro = paramRetenciones.valor;
  const retencionesBase =
    retencionesParametro ?? Number(resumenActual?.estimated_withholdings ?? 0);
  const parametros = aplicarAntecedenteF29(
    {
      remanenteAnterior: remanente.remanenteAnterior,
      fuenteRemanente: remanente.fuenteRemanente,
      tasaPpm: tasaResuelta.tasaPpm,
      fuentePpm: tasaResuelta.fuentePpm,
      retenciones: retencionesBase,
      fuenteRetenciones: (retencionesBase > 0
        ? retencionesParametro != null
          ? "configured"
          : ((resumenActual?.withholdings_source as WithholdingsSource) ??
            (esDemo ? "mock" : "configured"))
        : "unknown") as WithholdingsSource,
    },
    antecedente,
  );


  const tasaPpm = parametros.tasaPpm;
  const fuentePpm = parametros.fuentePpm;
  const retenciones = parametros.retenciones;
  const fuenteRetenciones = parametros.fuenteRetenciones;

  const dias = diasDePeriodo(entrada.periodo);
  const diasPrev = diasDePeriodo(previoNombre);
  const margen = Number(settings?.preventive_margin_percent ?? 10);
  const reservado = Number(settings?.reserved_amount ?? 0);
  const metaMensual = Number(metaRow?.goal_amount ?? settings?.monthly_sales_goal ?? 0);

  /**
   * Cuando el periodo tiene documentos guardados, el resumen oficial solo
   * aporta las boletas (comportamiento de siempre). Cuando no hay detalle
   * documento por documento —actualización económica—, el resumen oficial
   * aporta también facturas y notas de crédito, para que los totales sean
   * exactamente los mismos que se obtenían descargando el detalle.
   */
  const periodoData: PeriodoData = {
    periodo: entrada.periodo,
    documentosVenta: docs.venta,
    ventasAgregadasResumen: agregadosVentasDeResumen(
      periodoRow.rcv_summary,
      docs.venta.length > 0,
    ),
    documentosCompra: docs.compra,
    comprasAgregadasResumen: agregadosComprasDeResumen(
      periodoRow.rcv_summary,
      docs.compra.length > 0,
    ),

    remanenteAnterior: parametros.remanenteAnterior,
    fuenteRemanente: parametros.fuenteRemanente,
    remanenteConocido:
      remanente.conocido || parametros.fuenteRemanente !== remanente.fuenteRemanente,
    tasaPpm,
    fuentePpm,
    basePpmConfirmada: confirmado ? antecedente?.basePpmDeclarada : null,
    retencionesEstimadas: retenciones,
    fuenteRetenciones,
    ivaDeclarado: confirmado ? antecedente?.ivaDeclarado : null,
    ppmDeclarado: confirmado ? antecedente?.ppmDeclarado : null,
    retencionesDeclaradas: confirmado ? antecedente?.retenciones : null,
    totalDeclarado: confirmado ? antecedente?.totalDeclarado : null,
      ivaDebitoDeclarado: confirmado ? antecedente?.ivaDebitoDeclarado : null,
      ivaCreditoDeclarado: confirmado ? antecedente?.ivaCreditoDeclarado : null,
      nuevoRemanenteDeclarado: confirmado ? antecedente?.nuevoRemanenteDeclarado : null,
    metaMensual,
    dineroReservado: reservado,
    diasTranscurridos: dias.diasTranscurridos,
    diasTotales: dias.diasTotales,
    estadoPeriodo: estadoDelPeriodo(entrada.periodo),
    confiabilidad: "media",
  };

  const empresa: Empresa = {
    id: empresaRow.id,
    rut: empresaRow.rut,
    razonSocial: empresaRow.business_name,
    nombreFantasia: empresaRow.fantasy_name ?? empresaRow.business_name,
    actividad: empresaRow.business_activity ?? "Sin actividad registrada",
    estadoConexionSii: empresaRow.connection_status as Empresa["estadoConexionSii"],
    ultimaSincronizacion: empresaRow.last_sync_at,
    periodoActivo: entrada.periodo,
  };

  const diasDesdeSync = empresaRow.last_sync_at
    ? Math.floor(
        (Date.now() - new Date(empresaRow.last_sync_at).getTime()) / 86400000,
      )
    : null;

  const dashboard = construirDashboard({
    empresa,
    periodo: periodoData,
    periodoAnterior:
      docsPrevios.venta.length ||
      docsPrevios.compra.length ||
      agregadosVentasDeResumen(previoRow?.rcv_summary, false)
        ? {
            ...periodoData,
            periodo: previoNombre,
            documentosVenta: docsPrevios.venta,
            documentosCompra: docsPrevios.compra,
            ventasAgregadasResumen: previoRow
              ? agregadosVentasDeResumen(
                  previoRow.rcv_summary,
                  docsPrevios.venta.length > 0,
                )
              : null,
            comprasAgregadasResumen: previoRow
              ? agregadosComprasDeResumen(
                  previoRow.rcv_summary,
                  docsPrevios.compra.length > 0,
                )
              : null,
            remanenteAnterior: 0,
            fuenteRemanente: "unknown",
            diasTranscurridos: diasPrev.diasTranscurridos,
            diasTotales: diasPrev.diasTotales,
            estadoPeriodo: estadoDelPeriodo(previoNombre),
          }
        : null,

    idPeriodoAnterior: previoNombre,
    margenPorcentaje: margen,
    dineroReservado: reservado,
    metaMensual,
    diasDesdeSincronizacion: diasDesdeSync,
    errorSincronizacion: syncRow?.status === "failed",
    configuradoManualmente: !esDemo,
    esDemo,
    f29Confirmado: !!antecedente?.confirmado,
  });

  const r = dashboard.resumen;
  const estimacionPrevia = dashboard.resumenPreF29;
  const ctx = dashboard.contexto;
  const calculadoEn = new Date().toISOString();
  const nivel = nivelDesdeEspanol(dashboard.confiabilidad);

  /**
   * Precisión: se conserva la estimación previa a la conciliación para poder
   * medir después cuánto se desvió del F29 real. Sin F29 no hay medición.
   */
  const hayOficial = dashboard.conciliacionF29.hayOficial;
  const desviacion = hayOficial
    ? calcularDesviacionF29(
        estimacionPrevia.totalTributarioEstimado,
        r.totalTributarioEstimado,
      )
    : null;

  const { error } = await supabaseAdmin.from("tax_monthly_summaries").upsert(
    {
      company_id: entrada.companyId,
      tax_period_id: periodoRow.id,
      sales_source: ctx.sources.sales_source,
      vat_debit_source: ctx.sources.vat_debit_source,
      vat_credit_source: ctx.sources.vat_credit_source,
      ppm_base_source: ctx.sources.ppm_base_source,
      special_adjustments_source: ctx.sources.special_adjustments_source,
      carryforward_known: ctx.carryforward_known,
      other_vat_debits: ctx.other_vat_debits,
      other_vat_credits: ctx.other_vat_credits,
      special_debits: ctx.special_debits,
      special_credits: ctx.special_credits,
      total_vat_credits: ctx.total_vat_credits,
      gross_vat_position: ctx.gross_vat_position,
      declared_tax_total: ctx.declared_tax_total,
      calculation_status: ctx.calculation_status,
      missing_components: ctx.missing_components.map((c) => ({ ...c })),
      sales_total: r.ventasTotales,
      invoice_sales: r.ventasFacturas,
      receipt_sales: r.ventasBoletas,
      exempt_sales: r.ventasExentas,
      sales_credit_notes: r.notasCreditoVentas,
      purchases_total: r.comprasTotales,
      net_purchases: r.comprasNetas,
      exempt_purchases: r.comprasExentas,
      vat_debit: r.ivaDebito,
      vat_credit: r.ivaCredito,
      vat_credit_potential: r.ivaCreditoPotencial,
      previous_vat_carryforward: r.remanenteAnterior,
      carryforward_source: r.fuenteRemanente,
      estimated_vat_payable: r.ivaEstimado,
      estimated_new_carryforward: r.nuevoRemanente,
      estimated_ppm: r.ppmEstimado,
      ppm_rate: r.tasaPpm,
      ppm_tax_base: r.basePpm,
      ppm_source: r.fuentePpm,
      estimated_withholdings: r.retencionesEstimadas,
      withholdings_source: r.fuenteRetenciones,
      estimated_tax_total: r.totalTributarioEstimado,
      preventive_margin_percent: r.margenPorcentaje,
      preventive_margin_amount: r.margenPreventivo,
      recommended_reserve: r.reservaRecomendada,
      reserved_amount_snapshot: r.dineroReservado,
      projected_sales: dashboard.proyeccion.probable,
      projected_vat_debit: dashboard.proyeccion.ivaDebitoProyectado,
      projected_tax_min: dashboard.proyeccion.impuestosMin,
      projected_tax_max: dashboard.proyeccion.impuestosMax,
      confidence_level: nivel,
      confidence_reasons: dashboard.razonesConfiabilidad,
      calculated_at: calculadoEn,
      source: esDemo ? ("mock" as const) : ("manual" as const),
    },
    { onConflict: "company_id,tax_period_id" },
  );
  if (error) throw new ErrorNegocio("No pudimos guardar el resultado del cálculo.");

  await supabaseAdmin
    .from("tax_periods")
    .update({ last_calculated_at: calculadoEn, confidence_level: nivel })
    .eq("id", periodoRow.id);

  // Conciliación del encadenamiento de remanentes. Nunca se corrige un valor
  // automáticamente: la diferencia queda registrada para el contador.
  const conciliacion = conciliarRemanente(
    previo.remanente,
    confirmado ? (antecedente?.remanenteAnterior ?? null) : null,
  );
  if (conciliacion) {
    await supabaseAdmin.from("tax_carryforward_reconciliations").upsert(
      {
        company_id: entrada.companyId,
        tax_period_id: periodoRow.id,
        previous_period: previoNombre,
        calculated_previous_carryforward: conciliacion.remanenteCalculadoPrevio,
        declared_previous_carryforward: conciliacion.remanenteDeclarado,
        difference: conciliacion.diferencia,
        status: "pending",
        notes: `El periodo ${previoNombre} dejó un remanente calculado distinto del declarado en el F29 de ${entrada.periodo}.`,
        updated_at: calculadoEn,
      },
      { onConflict: "company_id,tax_period_id" },
    );
  } else {
    await supabaseAdmin
      .from("tax_carryforward_reconciliations")
      .delete()
      .eq("company_id", entrada.companyId)
      .eq("tax_period_id", periodoRow.id);
  }


  await registrarActividad(
    entrada.companyId,
    userId,
    "calculation.recalculated",
    "tax_monthly_summaries",
    { periodo: entrada.periodo, confiabilidad: nivel },
  );

  return {
    periodo: entrada.periodo,
    ivaDebito: r.ivaDebito,
    ivaCredito: r.ivaCredito,
    ivaCreditoPotencial: r.ivaCreditoPotencial,
    remanenteAnterior: r.remanenteAnterior,
    fuenteRemanente: r.fuenteRemanente,
    ivaEstimado: r.ivaEstimado,
    nuevoRemanente: r.nuevoRemanente,
    ppmEstimado: r.ppmEstimado,
    tasaPpm: r.tasaPpm,
    fuentePpm: r.fuentePpm,
    retencionesEstimadas: r.retencionesEstimadas,
    fuenteRetenciones: r.fuenteRetenciones,
    totalTributarioEstimado: r.totalTributarioEstimado,
    margenPreventivo: r.margenPreventivo,
    reservaRecomendada: r.reservaRecomendada,
    proyeccionVentas: dashboard.proyeccion.probable,
    confiabilidad: nivel,
    razones: dashboard.razonesConfiabilidad,
    calculadoEn,
  };
}
