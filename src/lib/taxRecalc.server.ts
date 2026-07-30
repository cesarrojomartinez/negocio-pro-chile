import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ErrorNegocio, exigirRol, registrarActividad } from "@/lib/companies.server";
import { construirDashboard } from "@/lib/dashboardBuilder";
import {
  aplicarAntecedenteF29,
  interpretarAntecedenteF29,
} from "@/lib/f29Antecedent";
import { diasDePeriodo, estadoDesdeRcv, periodoAnterior } from "@/lib/taxMappers";
import { estadoDelPeriodo, nivelDesdeEspanol } from "@/utils/taxCalculations";
import type { CarryforwardSource, PpmSource, WithholdingsSource } from "@/types/engine";
import type { DocumentoTributario, PeriodoData } from "@/types/tax";
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
    .select("id, status")
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
 * Determina el remanente anterior por prioridad:
 * F29 persistido → resumen del periodo anterior → configuración demostrativa → cero.
 */
async function remanenteAnterior(
  companyId: string,
  periodoPrevioId: string | null,
  esDemo: boolean,
): Promise<{ monto: number; fuente: CarryforwardSource }> {
  if (periodoPrevioId) {
    const { data: f29 } = await supabaseAdmin
      .from("tax_f29_history")
      .select("vat_carryforward, declaration_status")
      .eq("company_id", companyId)
      .eq("tax_period_id", periodoPrevioId)
      .maybeSingle();
    if (f29 && f29.declaration_status === "filed" && f29.vat_carryforward != null)
      return { monto: Number(f29.vat_carryforward), fuente: "f29" };

    const { data: resumen } = await supabaseAdmin
      .from("tax_monthly_summaries")
      .select("estimated_new_carryforward")
      .eq("company_id", companyId)
      .eq("tax_period_id", periodoPrevioId)
      .maybeSingle();
    if (resumen && resumen.estimated_new_carryforward != null)
      return {
        monto: Number(resumen.estimated_new_carryforward),
        fuente: esDemo ? "mock" : "previous_period",
      };
  }
  return { monto: 0, fuente: "unknown" };
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
  const remanente = await remanenteAnterior(entrada.companyId, previoRow?.id ?? null, esDemo);

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

  const tasaPrevia = esDemo
    ? null
    : await tasaPpmConfirmadaPrevia(entrada.companyId, entrada.periodo);
  const tasaResuelta = resolverTasaPpm({
    esDemo,
    antecedentePeriodo: antecedente,
    tasaConfigurada: tasaPpmConfigurada,
    configuracionConfirmada: !!settings?.ppm_rate_confirmed,
    tasaConfirmadaPrevia: tasaPrevia,
  });

  const retencionesBase = Number(resumenActual?.estimated_withholdings ?? 0);
  const parametros = aplicarAntecedenteF29(
    {
      remanenteAnterior: remanente.monto,
      fuenteRemanente: remanente.fuente,
      tasaPpm: tasaResuelta.tasaPpm,
      fuentePpm: tasaResuelta.fuentePpm,
      retenciones: retencionesBase,
      fuenteRetenciones: (retencionesBase > 0
        ? ((resumenActual?.withholdings_source as WithholdingsSource) ??
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

  const periodoData: PeriodoData = {
    periodo: entrada.periodo,
    documentosVenta: docs.venta,
    documentosCompra: docs.compra,
    remanenteAnterior: parametros.remanenteAnterior,
    fuenteRemanente: parametros.fuenteRemanente,
    tasaPpm,
    fuentePpm,
    retencionesEstimadas: retenciones,
    fuenteRetenciones,
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
      docsPrevios.venta.length || docsPrevios.compra.length
        ? {
            ...periodoData,
            periodo: previoNombre,
            documentosVenta: docsPrevios.venta,
            documentosCompra: docsPrevios.compra,
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
  const calculadoEn = new Date().toISOString();
  const nivel = nivelDesdeEspanol(dashboard.confiabilidad);

  const { error } = await supabaseAdmin.from("tax_monthly_summaries").upsert(
    {
      company_id: entrada.companyId,
      tax_period_id: periodoRow.id,
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
