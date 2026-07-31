import { supabase } from "@/integrations/supabase/client";
import {
  actualizarConfiguracionFn,
  cambiarConexionDemoFn,
  recalcularPeriodoFn,
  registrarSincronizacionFn,
} from "@/lib/companies.functions";
import {
  confianzaDesdeDb,
  diasDePeriodo,
  estadoDesdeRcv,
  periodoAnterior,
} from "@/lib/taxMappers";
import { construirDashboard } from "@/lib/dashboardBuilder";
import { ventasAgregadasDeResumenGuardado } from "@/integrations/sii/rcvSummary";
import {
  aplicarAntecedenteF29,
  interpretarAntecedenteF29,
  resolverRemanenteAnterior,
  resolverTasaPpm,
} from "@/lib/f29Antecedent";
import type { AntecedenteF29 } from "@/lib/f29Antecedent";

import {
  hayHistorialDeVigencias,
  seleccionarParametroVigente,
  type FilaParametroVigencia,
} from "@/lib/vigenciaParametros";

import { estadoDelPeriodo, simulateAdditionalSale } from "@/utils/taxCalculations";
import type { ConsultaDashboard, TaxDataService } from "./taxDataService";
import type { Empresa, EstadoConexionSii } from "@/types/company";
import type { DashboardData, DocumentoTributario, PeriodoData } from "@/types/tax";

export class ErrorDatosCloud extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorDatosCloud";
  }
}

export interface EmpresaCloud {
  id: string;
  rut: string;
  razonSocial: string;
  nombreFantasia: string | null;
  actividad: string | null;
  estadoConexion: EstadoConexionSii;
  ultimaSincronizacion: string | null;
  esDemo: boolean;
  rol: "owner" | "business_user" | "accountant" | "viewer";
}

export interface PeriodoCloud {
  id: string;
  periodo: string;
  etiqueta: string;
  estado: "open" | "estimated" | "reviewed" | "closed";
  confiabilidad: string;
}

export interface ConfiguracionCloud {
  metaMensual: number | null;
  dineroReservado: number;
  margenPorcentaje: number;
  tasaPpm: number;
  /** La tasa de PPM guardada fue confirmada (no es el valor por omisión). */
  tasaPpmConfirmada: boolean;
  alertasActivas: boolean;
}


function mapDocumento(fila: {
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
}): DocumentoTributario {
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

/**
 * Identificador del periodo. Los IDs no cambian, así que se memorizan para no
 * repetir la misma consulta en cada bloque del panel.
 */
const cachePeriodos = new Map<string, string>();

async function periodoIdDe(companyId: string, periodo: string) {
  const clave = `${companyId}|${periodo}`;
  const memo = cachePeriodos.get(clave);
  if (memo) return memo;
  const { data } = await supabase
    .from("tax_periods")
    .select("id")
    .eq("company_id", companyId)
    .eq("period", periodo)
    .maybeSingle();
  if (!data?.id) return null;
  cachePeriodos.set(clave, data.id);
  return data.id;
}

async function documentosDe(companyId: string, periodo: string) {
  const periodId = await periodoIdDe(companyId, periodo);
  if (!periodId) return { venta: [], compra: [] };


  const { data, error } = await supabase
    .from("tax_documents")
    .select(
      "id, document_direction, document_type, folio, document_date, counterparty_name, counterparty_rut, net_amount, vat_amount, exempt_amount, total_amount, rcv_status",
    )
    .eq("company_id", companyId)
    .eq("tax_period_id", periodId)
    .order("document_date", { ascending: true });
  if (error) throw new ErrorDatosCloud("No pudimos cargar los documentos del periodo.");

  const filas = data ?? [];
  return {
    venta: filas.filter((f) => f.document_direction === "sale").map(mapDocumento),
    compra: filas.filter((f) => f.document_direction === "purchase").map(mapDocumento),
  };
}

async function resumenGuardado(companyId: string, periodo: string) {
  const periodId = await periodoIdDe(companyId, periodo);
  if (!periodId) return null;
  const { data } = await supabase
    .from("tax_monthly_summaries")
    .select("estimated_new_carryforward, estimated_withholdings")
    .eq("company_id", companyId)
    .eq("tax_period_id", periodId)
    .maybeSingle();
  return data;
}

/**
 * Señales de que el periodo sí tiene información real persistida, aunque el
 * F29 no esté confirmado: origen del periodo, resumen guardado o snapshots.
 */
async function hayInformacionRealDe(companyId: string, periodo: string) {
  const { data: periodRow } = await supabase
    .from("tax_periods")
    .select("id, data_source, last_calculated_at")
    .eq("company_id", companyId)
    .eq("period", periodo)
    .maybeSingle();
  if (!periodRow) return false;
  if (periodRow.data_source === "api_gateway") return true;
  const { count } = await supabase
    .from("tax_provider_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("provider", "api_gateway")
    .eq("tax_period_id", periodRow.id);
  return (count ?? 0) > 0;
}


/** Antecedente del F29 del periodo, cuando el contador ya lo confirmó. */
async function antecedenteF29De(companyId: string, periodo: string) {
  const periodId = await periodoIdDe(companyId, periodo);
  if (!periodId) return null;
  const { data } = await supabase
    .from("tax_f29_history")
    .select(
      "declaration_status, declared_vat, declared_ppm, declared_withholdings, declared_total, vat_carryforward, source, raw_data",
    )
    .eq("company_id", companyId)
    .eq("tax_period_id", periodId)
    .maybeSingle();
  return interpretarAntecedenteF29(data);
}

/**
 * Última tasa de PPM confirmada por el contador en un periodo anterior.
 * Evita que una empresa real herede la tasa demostrativa por omisión.
 */
async function tasaPpmConfirmadaPreviaDe(companyId: string, periodo: string) {
  const { data: periodos } = await supabase
    .from("tax_periods")
    .select("id, period")
    .eq("company_id", companyId)
    .lt("period", periodo)
    .order("period", { ascending: false })
    .limit(12);
  const lista = periodos ?? [];
  if (lista.length === 0) return null;

  const { data: filas } = await supabase
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

/**
 * Parámetro tributario de la empresa vigente al inicio del periodo, con la
 * indicación de si existe historial de vigencias para ese parámetro.
 */
async function parametroVigenteDe(
  companyId: string,
  tipo: "ppm_rate" | "usual_withholdings" | "preventive_margin" | "taxpayer_regime",
  periodo: string,
): Promise<{ valor: number | null; hayHistorial: boolean }> {
  const { data } = await supabase
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





/** Diferencia registrada entre el remanente calculado y el declarado. */
export interface ConciliacionRemanenteCloud {
  periodoAnterior: string;
  remanenteCalculadoPrevio: number;
  remanenteDeclarado: number;
  diferencia: number;
  estado: string;
}

export const cloudTaxDataService: TaxDataService & {
  getCompanies(): Promise<EmpresaCloud[]>;
  getPeriods(companyId: string): Promise<PeriodoCloud[]>;
  getSettings(companyId: string): Promise<ConfiguracionCloud | null>;
  getGoals(companyId: string, periodo: string): Promise<number | null>;
  getAlerts(companyId: string): Promise<
    {
      id: string;
      alert_type: string;
      severity: string;
      title: string;
      message: string;
      is_read: boolean;
    }[]
  >;
  marcarAlertaLeida(id: string): Promise<void>;
  updateGoal(companyId: string, periodo: string, monto: number): Promise<void>;
  updateReservedAmount(companyId: string, monto: number): Promise<void>;
  updatePreventiveMargin(companyId: string, porcentaje: number): Promise<void>;
  connectDemo(companyId: string): Promise<string | null>;
  disconnectDemo(companyId: string): Promise<void>;
  getConnectionStatus(companyId: string): Promise<EstadoConexionSii>;
  getConciliacionRemanente(
    companyId: string,
    periodo: string,
  ): Promise<ConciliacionRemanenteCloud | null>;
  /** Antecedente del F29 guardado del periodo (contador o lectura del PDF). */
  getAntecedenteF29(
    companyId: string,
    periodo: string,
  ): Promise<{ antecedente: AntecedenteF29; folio: string | null } | null>;
} = {
  esDemo: false,

  async getAntecedenteF29(companyId, periodo) {
    const periodId = await periodoIdDe(companyId, periodo);
    if (!periodId) return null;
    const { data } = await supabase
      .from("tax_f29_history")
      .select(
        "declaration_status, declared_vat, declared_ppm, declared_withholdings, declared_total, vat_carryforward, source, raw_data",
      )
      .eq("company_id", companyId)
      .eq("tax_period_id", periodId)
      .maybeSingle();
    const antecedente = interpretarAntecedenteF29(data);
    if (!antecedente?.confirmado) return null;
    const bruto = (data?.raw_data ?? {}) as Record<string, unknown>;
    const folio = typeof bruto.folio === "string" ? bruto.folio : null;
    return { antecedente, folio };
  },


  async getConciliacionRemanente(companyId, periodo) {
    const periodId = await periodoIdDe(companyId, periodo);
    if (!periodId) return null;
    const { data } = await supabase
      .from("tax_carryforward_reconciliations")
      .select(
        "previous_period, calculated_previous_carryforward, declared_previous_carryforward, difference, status",
      )
      .eq("company_id", companyId)
      .eq("tax_period_id", periodId)
      .maybeSingle();
    if (!data) return null;
    return {
      periodoAnterior: data.previous_period,
      remanenteCalculadoPrevio: Number(data.calculated_previous_carryforward),
      remanenteDeclarado: Number(data.declared_previous_carryforward),
      diferencia: Number(data.difference),
      estado: data.status,
    };
  },


  async getCompanies() {
    const { data, error } = await supabase
      .from("tax_company_members")
      .select(
        "role, tax_companies(id, rut, business_name, fantasy_name, business_activity, connection_status, last_sync_at, is_demo)",
      )
      .eq("status", "active");
    if (error) throw new ErrorDatosCloud("No pudimos cargar la información de tu empresa.");
    return (data ?? [])
      .filter((f) => f.tax_companies)
      .map((f) => {
        const c = f.tax_companies as NonNullable<typeof f.tax_companies>;
        return {
          id: c.id,
          rut: c.rut,
          razonSocial: c.business_name,
          nombreFantasia: c.fantasy_name,
          actividad: c.business_activity,
          estadoConexion: c.connection_status as EstadoConexionSii,
          ultimaSincronizacion: c.last_sync_at,
          esDemo: c.is_demo,
          rol: f.role as EmpresaCloud["rol"],
        };
      })
      .sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));
  },

  async getPeriods(companyId) {
    const { data, error } = await supabase
      .from("tax_periods")
      .select("id, period, status, confidence_level")
      .eq("company_id", companyId)
      .order("period", { ascending: false });
    if (error) throw new ErrorDatosCloud("No pudimos cargar los periodos.");
    const nombres = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];
    return (data ?? []).map((p) => {
      const [anio, mes] = p.period.split("-").map(Number);
      return {
        id: p.id,
        periodo: p.period,
        etiqueta: `${nombres[mes - 1]} ${anio}`,
        estado: p.status as PeriodoCloud["estado"],
        confiabilidad: p.confidence_level,
      };
    });
  },

  async getSettings(companyId) {
    const { data, error } = await supabase
      .from("tax_company_settings")
      .select(
        "monthly_sales_goal, reserved_amount, preventive_margin_percent, estimated_ppm_rate, ppm_rate_confirmed, alerts_enabled",
      )
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new ErrorDatosCloud("No pudimos cargar la configuración.");
    if (!data) return null;
    return {
      metaMensual: data.monthly_sales_goal == null ? null : Number(data.monthly_sales_goal),
      dineroReservado: Number(data.reserved_amount),
      margenPorcentaje: Number(data.preventive_margin_percent),
      tasaPpm: Number(data.estimated_ppm_rate),
      tasaPpmConfirmada: !!data.ppm_rate_confirmed,
      alertasActivas: data.alerts_enabled,
    };
  },


  async getGoals(companyId, periodo) {
    const periodId = await periodoIdDe(companyId, periodo);
    if (!periodId) return null;
    const { data } = await supabase
      .from("tax_sales_goals")
      .select("goal_amount")
      .eq("company_id", companyId)
      .eq("tax_period_id", periodId)
      .maybeSingle();
    return data ? Number(data.goal_amount) : null;
  },

  async getAlerts(companyId) {
    const { data } = await supabase
      .from("tax_alerts")
      .select("id, alert_type, severity, title, message, is_read")
      .eq("company_id", companyId)
      .eq("is_read", false)
      .order("generated_at", { ascending: false })
      .limit(3);
    return data ?? [];
  },

  async marcarAlertaLeida(id) {
    await supabase
      .from("tax_alerts")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id);
  },

  async updateGoal(companyId, periodo, monto) {
    const r = await actualizarConfiguracionFn({
      data: { companyId, periodo, metaMensual: monto },
    });
    if (!r.ok) throw new ErrorDatosCloud(r.error);
  },

  async updateReservedAmount(companyId, monto) {
    const r = await actualizarConfiguracionFn({
      data: { companyId, dineroReservado: monto },
    });
    if (!r.ok) throw new ErrorDatosCloud(r.error);
  },

  async updatePreventiveMargin(companyId, porcentaje) {
    const r = await actualizarConfiguracionFn({
      data: { companyId, margenPorcentaje: porcentaje },
    });
    if (!r.ok) throw new ErrorDatosCloud(r.error);
  },

  async connectDemo(companyId) {
    const r = await cambiarConexionDemoFn({ data: { companyId, conectar: true } });
    if (!r.ok) throw new ErrorDatosCloud(r.error);
    return r.data.ultimaSincronizacion;
  },

  async disconnectDemo(companyId) {
    const r = await cambiarConexionDemoFn({ data: { companyId, conectar: false } });
    if (!r.ok) throw new ErrorDatosCloud(r.error);
  },

  async getConnectionStatus(companyId) {
    const { data } = await supabase
      .from("tax_companies")
      .select("connection_status")
      .eq("id", companyId)
      .maybeSingle();
    return (data?.connection_status ?? "disconnected") as EstadoConexionSii;
  },

  async sincronizar(companyId, periodoId) {
    if (!companyId) return new Date().toISOString();
    const r = await registrarSincronizacionFn({
      data: { companyId, periodo: periodoId ?? null },
    });
    if (!r.ok) throw new ErrorDatosCloud(r.error);
    if (periodoId) {
      await recalcularPeriodoFn({ data: { companyId, periodo: periodoId } });
    }
    return r.data.ultimaSincronizacion;
  },

  async obtenerDashboard(consulta: ConsultaDashboard): Promise<DashboardData> {
    const companyId = consulta.companyId;
    if (!companyId) throw new ErrorDatosCloud("Selecciona una empresa para continuar.");

    const { data: empresaRow, error: errorEmpresa } = await supabase
      .from("tax_companies")
      .select(
        "id, rut, business_name, fantasy_name, business_activity, connection_status, last_sync_at, is_demo",
      )
      .eq("id", companyId)
      .maybeSingle();
    if (errorEmpresa || !empresaRow)
      throw new ErrorDatosCloud("No pudimos cargar la información de tu empresa.");

    const anteriorId = periodoAnterior(consulta.periodoId);
    const esDemoEmpresa = !!empresaRow.is_demo;

    // Todas estas lecturas son independientes entre sí: se piden en paralelo
    // para que el panel aparezca de una sola vez y no en cascada.
    const [
      settings,
      metaGuardada,
      docs,
      resumenAnteriorGuardado,
      docsAnterior,
      resumenActualGuardado,
      informacionReal,
      periodRowResult,
      antecedenteF29,
      antecedenteAnterior,
      tasaPrevia,
      paramPpm,
    ] = await Promise.all([
      this.getSettings(companyId),
      this.getGoals(companyId, consulta.periodoId),
      documentosDe(companyId, consulta.periodoId),
      resumenGuardado(companyId, anteriorId),
      documentosDe(companyId, anteriorId),
      resumenGuardado(companyId, consulta.periodoId),
      hayInformacionRealDe(companyId, consulta.periodoId),
      supabase
        .from("tax_periods")
        .select("period, confidence_level, rcv_summary")
        .eq("company_id", companyId)
        .in("period", [consulta.periodoId, anteriorId]),
      antecedenteF29De(companyId, consulta.periodoId),
      antecedenteF29De(companyId, anteriorId),
      esDemoEmpresa
        ? Promise.resolve(null)
        : tasaPpmConfirmadaPreviaDe(companyId, consulta.periodoId),
      esDemoEmpresa
        ? Promise.resolve({ valor: null, hayHistorial: false })
        : parametroVigenteDe(companyId, "ppm_rate", consulta.periodoId),
    ]);
    const filasPeriodo = periodRowResult.data ?? [];
    const periodRow = filasPeriodo.find((f) => f.period === consulta.periodoId) ?? null;
    const periodRowAnterior = filasPeriodo.find((f) => f.period === anteriorId) ?? null;

    const dias = diasDePeriodo(consulta.periodoId);
    const metaMensual =
      consulta.metaMensual ?? metaGuardada ?? settings?.metaMensual ?? 0;
    const dineroReservado = consulta.dineroReservado ?? settings?.dineroReservado ?? 0;
    const margenPorcentaje = consulta.margenPorcentaje;

    const confirmado = !!antecedenteF29?.confirmado;

    const { tasaPpm, fuentePpm } = resolverTasaPpm({
      esDemo: esDemoEmpresa,
      antecedentePeriodo: antecedenteF29,
      tasaParametroVigente: paramPpm.valor,
      hayHistorialVigencias: paramPpm.hayHistorial,
      tasaConfigurada: settings?.tasaPpm ?? null,
      configuracionConfirmada: !!settings?.tasaPpmConfirmada,
      tasaConfirmadaPrevia: tasaPrevia,
    });

    const remanente = resolverRemanenteAnterior({
      esDemo: esDemoEmpresa,
      antecedentePeriodo: antecedenteF29,
      remanenteCalculadoPrevio:
        resumenAnteriorGuardado?.estimated_new_carryforward == null
          ? null
          : Number(resumenAnteriorGuardado.estimated_new_carryforward),
      periodoAnteriorConfirmado: !!antecedenteAnterior?.confirmado,
    });
    const retencionesGuardadas = Number(
      resumenActualGuardado?.estimated_withholdings ?? 0,
    );
    const parametros = aplicarAntecedenteF29(
      {
        remanenteAnterior: remanente.remanenteAnterior,
        fuenteRemanente: remanente.fuenteRemanente,
        tasaPpm,
        fuentePpm,
        retenciones: retencionesGuardadas,
        fuenteRetenciones: retencionesGuardadas > 0 ? "configured" : "unknown",
      },
      antecedenteF29,
    );

    const periodoData: PeriodoData = {
      periodo: consulta.periodoId,
      documentosVenta: docs.venta,
      documentosCompra: docs.compra,
      // Boletas y comprobantes que el SII solo informa como total del mes.
      ventasAgregadasResumen: ventasAgregadasDeResumenGuardado(periodRow?.rcv_summary),
      remanenteAnterior: parametros.remanenteAnterior,
      fuenteRemanente: parametros.fuenteRemanente,
      remanenteConocido: remanente.conocido || confirmado,
      tasaPpm: parametros.tasaPpm,
      fuentePpm: parametros.fuentePpm,
      basePpmConfirmada: confirmado ? antecedenteF29?.basePpmDeclarada : null,
      retencionesEstimadas: parametros.retenciones,
      fuenteRetenciones: parametros.fuenteRetenciones,
      ivaDeclarado: confirmado ? antecedenteF29?.ivaDeclarado : null,
      ppmDeclarado: confirmado ? antecedenteF29?.ppmDeclarado : null,
      retencionesDeclaradas: confirmado ? antecedenteF29?.retenciones : null,
      totalDeclarado: confirmado ? antecedenteF29?.totalDeclarado : null,
      ivaDebitoDeclarado: confirmado ? antecedenteF29?.ivaDebitoDeclarado : null,
      ivaCreditoDeclarado: confirmado ? antecedenteF29?.ivaCreditoDeclarado : null,
      nuevoRemanenteDeclarado: confirmado ? antecedenteF29?.nuevoRemanenteDeclarado : null,
      metaMensual,
      dineroReservado,
      diasTranscurridos: dias.diasTranscurridos,
      diasTotales: dias.diasTotales,
      estadoPeriodo: estadoDelPeriodo(consulta.periodoId),
      confiabilidad: confianzaDesdeDb(periodRow?.confidence_level ?? null),
    };

    const diasAnt = diasDePeriodo(anteriorId);
    const periodoDataAnterior: PeriodoData | null =
      docsAnterior.venta.length || docsAnterior.compra.length
        ? {
            ...periodoData,
            periodo: anteriorId,
            documentosVenta: docsAnterior.venta,
            documentosCompra: docsAnterior.compra,
            ventasAgregadasResumen: ventasAgregadasDeResumenGuardado(
              periodRowAnterior?.rcv_summary,
            ),
            remanenteAnterior: 0,
            fuenteRemanente: "unknown",
            retencionesEstimadas: Number(
              resumenAnteriorGuardado?.estimated_withholdings ?? 0,
            ),
            diasTranscurridos: diasAnt.diasTranscurridos,
            diasTotales: diasAnt.diasTotales,
            estadoPeriodo: estadoDelPeriodo(anteriorId),
          }
        : null;

    const empresa: Empresa = {
      id: empresaRow.id,
      rut: empresaRow.rut,
      razonSocial: empresaRow.business_name,
      nombreFantasia: empresaRow.fantasy_name ?? empresaRow.business_name,
      actividad: empresaRow.business_activity ?? "Sin actividad registrada",
      estadoConexionSii: empresaRow.connection_status as EstadoConexionSii,
      ultimaSincronizacion: empresaRow.last_sync_at,
      periodoActivo: consulta.periodoId,
    };

    const diasDesdeSincronizacion = empresaRow.last_sync_at
      ? Math.floor((Date.now() - new Date(empresaRow.last_sync_at).getTime()) / 86400000)
      : null;

    return construirDashboard({
      empresa,
      periodo: periodoData,
      periodoAnterior: periodoDataAnterior,
      idPeriodoAnterior: anteriorId,
      margenPorcentaje,
      dineroReservado,
      metaMensual,
      diasDesdeSincronizacion,
      errorSincronizacion: empresaRow.connection_status === "error",
      configuradoManualmente: settings != null,
      esDemo: !!empresaRow.is_demo,
      f29Confirmado: !!antecedenteF29?.confirmado,
      sincronizacionReal:
        !empresaRow.is_demo &&
        (informacionReal || resumenActualGuardado != null),
    });
  },

  /** Simulación puntual: no persiste nada. */
  simulateAdditionalSale(entrada) {
    return simulateAdditionalSale(entrada);
  },
};
