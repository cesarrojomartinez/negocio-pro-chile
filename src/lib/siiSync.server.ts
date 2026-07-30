/**
 * Orquestación de la conexión y sincronización simulada con el SII.
 *
 * Todo ocurre en el servidor: el navegador nunca conversa con el proveedor ni
 * envía montos. La aplicación solo pide "sincroniza este periodo".
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ErrorNegocio, exigirRol, registrarActividad } from "@/lib/companies.server";
import { recalculateTaxPeriod } from "@/lib/taxRecalc.server";
import {
  decidirSincronizacion,
  modulosAConsultar,
  proximoReintento,
  type TipoActivacion,
} from "@/lib/syncPolicy";
import {
  normalizarCompras,
  normalizarF29,
  normalizarRetenciones,
  normalizarVentas,
  type FilaDocumentoNormalizada,
} from "@/integrations/sii/normalizeProviderData";
import {
  MODULOS_SINCRONIZACION,
  SiiProviderError,
  type SiiModule,
  type SiiProviderAdapter,
  type SiiProviderId,
} from "@/integrations/sii/contracts";
import { mockSiiProviderAdapter } from "@/integrations/sii/mockSiiProviderAdapter";
import { apiGatewaySiiProviderAdapter } from "@/integrations/sii/apiGatewaySiiProviderAdapter";

const VERSION_CONSENTIMIENTO = "demo-2026-07";
const MESES_F29 = 6;

/** Errores que invalidan la sesión: no tiene sentido seguir pidiendo módulos. */
const ERRORES_DE_SESION = ["AUTH_EXPIRED", "INVALID_CREDENTIALS", "NOT_AUTHORIZED"];

/**
 * Opciones internas del servidor. No se exponen en las server functions:
 * existen para pruebas controladas (reloj y proveedor inyectables) y para la
 * prueba real con API Gateway.
 */
export interface OpcionesInternas {
  ahora?: Date;
  proveedor?: SiiProviderAdapter;
  /** Proveedor con el que se trabaja la conexión y la fuente de los datos. */
  proveedorId?: SiiProviderId;
  /** Acumulador de consumo real (consultas, créditos, proxy). */
  registro?: RegistroConsumo;
  /** Omite la política de caché: la prueba real la controla su propio límite. */
  omitirPoliticaCache?: boolean;
}

/** Selecciona el proveedor activo. */
export function resolverProveedor(id: SiiProviderId = "mock"): SiiProviderAdapter {
  return id === "api_gateway" ? apiGatewaySiiProviderAdapter : mockSiiProviderAdapter;
}

/** Fuente de datos que corresponde a cada proveedor. */
function fuenteDe(id: SiiProviderId): "mock_gateway" | "api_gateway" {
  return id === "api_gateway" ? "api_gateway" : "mock_gateway";
}



export interface ConexionSii {
  id: string;
  proveedor: SiiProviderId;
  simulado: boolean;
  estado: "disconnected" | "connecting" | "connected" | "stale" | "error";
  rutAutorizado: string | null;
  conectadaEn: string | null;
  expiraEn: string | null;
  ultimaSincronizacionExitosa: string | null;
  ultimoIntento: string | null;
  ultimoErrorCodigo: string | null;
  ultimoErrorMensaje: string | null;
}

function mapConexion(fila: Record<string, unknown>): ConexionSii {
  return {
    id: String(fila.id),
    proveedor: fila.provider as SiiProviderId,
    simulado: fila.provider !== "api_gateway",
    estado: fila.status as ConexionSii["estado"],
    rutAutorizado: (fila.authorized_rut as string) ?? null,
    conectadaEn: (fila.connected_at as string) ?? null,
    expiraEn: (fila.session_expires_at as string) ?? null,
    ultimaSincronizacionExitosa: (fila.last_successful_sync_at as string) ?? null,
    ultimoIntento: (fila.last_attempt_at as string) ?? null,
    ultimoErrorCodigo: (fila.last_error_code as string) ?? null,
    ultimoErrorMensaje: (fila.last_error_message as string) ?? null,
  };
}

async function empresaDe(companyId: string) {
  const { data } = await supabaseAdmin
    .from("tax_companies")
    .select("id, rut, business_name, connection_status, last_sync_at, active_period")
    .eq("id", companyId)
    .maybeSingle();
  if (!data) throw new ErrorNegocio("No pudimos cargar la empresa.");
  return data;
}

async function conexionDe(companyId: string) {
  const { data } = await supabaseAdmin
    .from("tax_sii_connections")
    .select("*")
    .eq("company_id", companyId)
    .eq("provider", "mock")
    .maybeSingle();
  return data ?? null;
}

/** Asegura la existencia del periodo y devuelve su id. */
async function asegurarPeriodo(companyId: string, periodo: string) {
  const { data } = await supabaseAdmin
    .from("tax_periods")
    .select("id, status")
    .eq("company_id", companyId)
    .eq("period", periodo)
    .maybeSingle();
  if (data) return data;

  const [year, month] = periodo.split("-").map(Number);
  if (!year || !month) throw new ErrorNegocio("El periodo indicado no es válido.");
  const { data: creado, error } = await supabaseAdmin
    .from("tax_periods")
    .insert({
      company_id: companyId,
      period: periodo,
      year,
      month,
      status: "open",
      data_source: "mock_gateway",
      confidence_level: "unknown",
    })
    .select("id, status")
    .single();
  if (error || !creado) throw new ErrorNegocio("No pudimos preparar el periodo.");
  return creado;
}

function periodoYaCerrado(periodo: string, ahora: Date): boolean {
  const [anio, mes] = periodo.split("-").map(Number);
  const finMes = Date.UTC(anio, mes, 1);
  return ahora.getTime() >= finMes;
}

// ---------------------------------------------------------------------------
// Conexión / desconexión
// ---------------------------------------------------------------------------

export async function obtenerConexionSii(
  userId: string,
  companyId: string,
): Promise<ConexionSii | null> {
  await exigirRol(userId, companyId, [
    "owner",
    "business_user",
    "accountant",
    "viewer",
  ]);
  const fila = await conexionDe(companyId);
  return fila ? mapConexion(fila) : null;
}

/**
 * Activa la conexión demostrativa. Solo el dueño de la empresa puede
 * autorizarla: es un consentimiento sobre la información de la empresa.
 */
export async function conectarSiiSimulado(
  userId: string,
  entrada: { companyId: string; consentimiento: boolean },
  opciones: OpcionesInternas = {},
): Promise<ConexionSii> {
  await exigirRol(userId, entrada.companyId, ["owner"]);
  if (!entrada.consentimiento)
    throw new ErrorNegocio(
      "Necesitamos que aceptes la autorización demostrativa para continuar.",
    );

  const empresa = await empresaDe(entrada.companyId);
  const proveedor = opciones.proveedor ?? resolverProveedor("mock");
  const ahora = (opciones.ahora ?? new Date()).toISOString();

  try {
    const conexion = await proveedor.connectCompany({
      rut: empresa.rut,
      authMethod: "demo",
    });

    const { data, error } = await supabaseAdmin
      .from("tax_sii_connections")
      .upsert(
        {
          company_id: entrada.companyId,
          provider: "mock",
          provider_connection_ref: conexion.providerConnectionRef,
          auth_method: "demo",
          status: "connected",
          authorized_rut: conexion.authorizedRut,
          connected_at: conexion.connectedAt,
          session_expires_at: conexion.sessionExpiresAt,
          last_attempt_at: ahora,
          last_error_code: null,
          last_error_message: null,
          consent_accepted_at: ahora,
          consent_version: VERSION_CONSENTIMIENTO,
          disconnected_at: null,
          created_by: userId,
        },
        { onConflict: "company_id,provider" },
      )
      .select("*")
      .single();
    if (error || !data) throw new ErrorNegocio("No pudimos guardar la conexión.");

    await supabaseAdmin
      .from("tax_companies")
      .update({ connection_status: "connected" })
      .eq("id", entrada.companyId);

    await registrarActividad(
      entrada.companyId,
      userId,
      "sii.connected_demo",
      "tax_sii_connections",
      { proveedor: "mock", version_consentimiento: VERSION_CONSENTIMIENTO },
    );
    return mapConexion(data);
  } catch (error) {
    if (error instanceof SiiProviderError) {
      await supabaseAdmin.from("tax_sii_connections").upsert(
        {
          company_id: entrada.companyId,
          provider: "mock",
          status: "error",
          last_attempt_at: ahora,
          last_error_code: error.code,
          last_error_message: error.message,
        },
        { onConflict: "company_id,provider" },
      );
      throw new ErrorNegocio(error.message);
    }
    throw error;
  }
}

/** Desconectar también es una decisión del dueño de la empresa. */
export async function desconectarSii(
  userId: string,
  entrada: { companyId: string },
  opciones: OpcionesInternas = {},
): Promise<ConexionSii | null> {
  await exigirRol(userId, entrada.companyId, ["owner"]);
  const fila = await conexionDe(entrada.companyId);
  if (!fila) return null;

  const proveedor = opciones.proveedor ?? resolverProveedor(fila.provider as SiiProviderId);

  try {
    await proveedor.disconnectCompany({
      providerConnectionRef: fila.provider_connection_ref ?? "",
    });
  } catch {
    // La desconexión local debe completarse aunque el proveedor falle.
  }

  const ahora = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from("tax_sii_connections")
    .update({
      status: "disconnected",
      disconnected_at: ahora,
      session_expires_at: null,
      provider_connection_ref: null,
    })
    .eq("id", fila.id)
    .select("*")
    .single();

  await supabaseAdmin
    .from("tax_companies")
    .update({ connection_status: "disconnected" })
    .eq("id", entrada.companyId);

  await registrarActividad(
    entrada.companyId,
    userId,
    "sii.disconnected_demo",
    "tax_sii_connections",
  );
  return data ? mapConexion(data) : null;
}

// ---------------------------------------------------------------------------
// Sincronización
// ---------------------------------------------------------------------------

export interface ResultadoSincronizacion {
  ejecutada: boolean;
  motivo: string;
  estado: "success" | "partial" | "failed" | "skipped";
  periodo: string;
  syncRunId: string | null;
  modulosCompletados: SiiModule[];
  modulosFallidos: SiiModule[];
  /** Módulos que no se volvieron a consultar porque seguían vigentes. */
  modulosDesdeCache: SiiModule[];

  documentosRecibidos: number;
  documentosCreados: number;
  documentosActualizados: number;
  documentosDescartados: number;
  consultasProveedor: number;
  datosHasta: string | null;
  ultimaSincronizacion: string | null;
  proximaActualizacion: string | null;
  errorCodigo: string | null;
  mensaje: string;
  simulado: boolean;
}

async function guardarSnapshot(entrada: {
  companyId: string;
  periodId: string | null;
  syncRunId: string | null;
  modulo: SiiModule;
  payload: unknown;
}) {
  await supabaseAdmin.from("tax_provider_snapshots").insert({
    company_id: entrada.companyId,
    tax_period_id: entrada.periodId,
    sync_run_id: entrada.syncRunId,
    provider: "mock",
    module: entrada.modulo,
    payload: entrada.payload as never,
    received_at: new Date().toISOString(),
    normalized_at: new Date().toISOString(),
  });
}

async function upsertDocumentos(
  companyId: string,
  periodId: string,
  filas: FilaDocumentoNormalizada[],
) {
  if (!filas.length) return { creados: 0, actualizados: 0 };

  const { data: existentes } = await supabaseAdmin
    .from("tax_documents")
    .select("external_id")
    .eq("company_id", companyId)
    .eq("source", "mock_gateway")
    .in(
      "external_id",
      filas.map((f) => f.external_id),
    );
  const yaEstaban = new Set((existentes ?? []).map((e) => e.external_id));

  const { error } = await supabaseAdmin.from("tax_documents").upsert(
    filas.map((f) => ({
      company_id: companyId,
      tax_period_id: periodId,
      source: "mock_gateway" as const,
      ...f,
    })),
    { onConflict: "company_id,source,external_id" },
  );
  if (error) throw new ErrorNegocio("No pudimos guardar los documentos recibidos.");

  const actualizados = filas.filter((f) => yaEstaban.has(f.external_id)).length;
  return { creados: filas.length - actualizados, actualizados };
}

/**
 * Sincroniza un periodo completo contra el proveedor simulado:
 * consulta, guarda el respaldo crudo, normaliza, deduplica, recalcula y
 * deja registro del uso.
 */
export async function syncSiiCompanyPeriod(
  userId: string,
  entrada: {
    companyId: string;
    periodo: string;
    triggerType?: TipoActivacion;
    idempotencyKey?: string | null;
  },
  opciones: OpcionesInternas = {},
): Promise<ResultadoSincronizacion> {
  await exigirRol(userId, entrada.companyId, ["owner", "business_user", "accountant"]);

  const tipo: TipoActivacion = entrada.triggerType ?? "manual";
  const empresa = await empresaDe(entrada.companyId);
  const conexionFila = await conexionDe(entrada.companyId);


  if (!conexionFila || !["connected", "stale"].includes(String(conexionFila.status)))
    throw new ErrorNegocio(
      "Primero necesitas activar la conexión demostrativa de esta empresa.",
    );

  // Idempotencia: la misma clave nunca ejecuta dos veces.
  if (entrada.idempotencyKey) {
    const { data: previo } = await supabaseAdmin
      .from("tax_sync_runs")
      .select("id, status, completed_at, modules_completed, modules_failed, modules_from_cache")
      .eq("company_id", entrada.companyId)
      .eq("idempotency_key", entrada.idempotencyKey)
      .maybeSingle();
    if (previo)
      return {
        ejecutada: false,
        motivo: "solicitud_repetida",
        estado: previo.status === "success" ? "success" : "skipped",
        periodo: entrada.periodo,
        syncRunId: previo.id,
        modulosCompletados: (previo.modules_completed ?? []) as SiiModule[],
        modulosFallidos: (previo.modules_failed ?? []) as SiiModule[],
        modulosDesdeCache: (previo.modules_from_cache ?? []) as SiiModule[],
        documentosRecibidos: 0,
        documentosCreados: 0,
        documentosActualizados: 0,
        documentosDescartados: 0,
        consultasProveedor: 0,
        datosHasta: null,
        ultimaSincronizacion: previo.completed_at,
        proximaActualizacion: null,
        errorCodigo: null,
        mensaje: "Esta actualización ya se había procesado.",
        simulado: true,
      };
  }

  const ahora = opciones.ahora ?? new Date();
  const periodoRow = await asegurarPeriodo(entrada.companyId, entrada.periodo);
  const decision = decidirSincronizacion({
    ahora,
    ultimaSincronizacionExitosa: conexionFila.last_successful_sync_at,
    tipo,
    periodoCerrado: periodoYaCerrado(entrada.periodo, ahora),
  });

  if (!decision.debeConsultar) {
    const { data: omitido } = await supabaseAdmin
      .from("tax_sync_runs")
      .insert({
        company_id: entrada.companyId,
        tax_period_id: periodoRow.id,
        sync_type: tipo === "manual" ? "manual" : "scheduled",
        trigger_type: tipo,
        status: "skipped",
        source: "mock_gateway",
        cache_hit: true,
        completed_at: ahora.toISOString(),
        modules_requested: MODULOS_SINCRONIZACION,
        triggered_by: userId,
        duration_ms: 0,
      })
      .select("id")
      .single();

    return {
      ejecutada: false,
      motivo: decision.motivo,
      estado: "skipped",
      periodo: entrada.periodo,
      syncRunId: omitido?.id ?? null,
      modulosCompletados: [],
      modulosFallidos: [],
      modulosDesdeCache: MODULOS_SINCRONIZACION.slice(),
      documentosRecibidos: 0,
      documentosCreados: 0,
      documentosActualizados: 0,
      documentosDescartados: 0,
      consultasProveedor: 0,
      datosHasta: null,
      ultimaSincronizacion: conexionFila.last_successful_sync_at,
      proximaActualizacion: decision.proximaActualizacion,
      errorCodigo: null,
      mensaje:
        decision.motivo === "espera_minima_manual"
          ? "Actualizaste hace muy poco. Espera unos minutos antes de volver a intentar."
          : "Ya tienes información reciente, no fue necesario volver a consultar.",
      simulado: true,
    };
  }

  const inicio = Date.now();
  const { data: run, error: errorRun } = await supabaseAdmin
    .from("tax_sync_runs")
    .insert({
      company_id: entrada.companyId,
      tax_period_id: periodoRow.id,
      sync_type: tipo === "manual" ? "manual" : "scheduled",
      trigger_type: tipo,
      status: "running",
      source: "mock_gateway",
      modules_requested: MODULOS_SINCRONIZACION,
      idempotency_key: entrada.idempotencyKey ?? null,
      triggered_by: userId,
      started_at: ahora.toISOString(),
    })
    .select("id")
    .single();

  if (errorRun || !run)
    throw new ErrorNegocio(
      "Ya hay una actualización en curso para este periodo. Espera a que termine.",
    );

  const proveedor =
    opciones.proveedor ?? resolverProveedor(conexionFila.provider as SiiProviderId);

  // Cuántas veces se consultó antes este periodo con éxito: el proveedor lo usa
  // para reflejar el avance del RCV sin cambiar los documentos ya conocidos.
  const { count: revisionesPrevias } = await supabaseAdmin
    .from("tax_sync_runs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", entrada.companyId)
    .eq("tax_period_id", periodoRow.id)
    .in("status", ["success", "partial"]);

  const consulta = {
    rut: empresa.rut,
    period: entrada.periodo,
    providerConnectionRef: conexionFila.provider_connection_ref ?? "",
    revision: revisionesPrevias ?? 0,
  };

  // El historial de F29 cambia una vez al mes: se refresca como máximo una vez
  // por semana, aunque el RCV se consulte a diario.
  const { data: ultimoF29 } = await supabaseAdmin
    .from("tax_sync_runs")
    .select("completed_at")
    .eq("company_id", entrada.companyId)
    .contains("modules_completed", ["f29_periods"])
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const plan = modulosAConsultar<SiiModule>({
    modulos: MODULOS_SINCRONIZACION,
    ahora,
    ultimaConsultaF29: ultimoF29?.completed_at ?? null,
    forzarTodo: tipo === "manual" || tipo === "demo_connect",
  });
  const porConsultar = new Set(plan.consultar);

  const completados: SiiModule[] = [];
  const fallidos: SiiModule[] = [];
  const desdeCache: SiiModule[] = plan.desdeCache;
  let consultas = 0;
  let recibidos = 0;
  let descartados = 0;
  let creados = 0;
  let actualizados = 0;
  let datosHasta: string | null = null;
  let primerError: SiiProviderError | null = null;
  let sesionInvalida = false;

  const ejecutar = async (modulos: SiiModule[], fn: () => Promise<void>) => {
    // Sin sesión válida no tiene sentido seguir consultando el resto.
    if (sesionInvalida) {
      fallidos.push(...modulos);
      return;
    }
    if (!modulos.some((m) => porConsultar.has(m))) return;
    try {
      consultas += 1;
      await fn();
      completados.push(...modulos);
    } catch (error) {
      fallidos.push(...modulos);
      if (error instanceof SiiProviderError) {
        if (!primerError) primerError = error;
        if (ERRORES_DE_SESION.includes(error.code)) sesionInvalida = true;
      } else {
        // Un problema nuestro no puede dejar la actualización trabada:
        // se cierra el registro antes de propagar el error.
        await supabaseAdmin
          .from("tax_sync_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_code: "INTERNAL",
            error_message:
              error instanceof Error ? error.message : "Error interno inesperado",
            duration_ms: Date.now() - inicio,
          })
          .eq("id", run.id);
        throw error;
      }
    }
  };



  // 1. Ventas del RCV
  await ejecutar(["rcv_sales_documents"], async () => {
    const ventas = await proveedor.fetchSalesRcv(consulta);
    await guardarSnapshot({
      companyId: entrada.companyId,
      periodId: periodoRow.id,
      syncRunId: run.id,
      modulo: "rcv_sales_documents",
      payload: ventas,
    });
    const n = normalizarVentas(ventas);
    recibidos += ventas.documents.length;
    descartados += n.descartados.length;
    const r = await upsertDocumentos(entrada.companyId, periodoRow.id, n.documentos);
    creados += r.creados;
    actualizados += r.actualizados;
    datosHasta = ventas.dataThroughDate;
  });

  // 2. Compras del RCV, por estado
  await ejecutar(
    [
      "rcv_purchases_registered",
      "rcv_purchases_pending",
      "rcv_purchases_claimed",
      "rcv_purchases_excluded",
    ],
    async () => {
      const compras = await proveedor.fetchPurchasesRcv(consulta);
      for (const [estado, docs] of Object.entries(compras.byStatus)) {
        const modulo = `rcv_purchases_${estado}` as SiiModule;
        await guardarSnapshot({
          companyId: entrada.companyId,
          periodId: periodoRow.id,
          syncRunId: run.id,
          modulo,
          payload: { period: compras.period, documents: docs },
        });
      }
      const n = normalizarCompras(compras);
      recibidos += Object.values(compras.byStatus).reduce((s, d) => s + d.length, 0);
      descartados += n.descartados.length;
      const r = await upsertDocumentos(entrada.companyId, periodoRow.id, n.documentos);
      creados += r.creados;
      actualizados += r.actualizados;
      datosHasta = datosHasta ?? compras.dataThroughDate;
    },
  );

  // 3. Historial de F29
  await ejecutar(["f29_periods"], async () => {
    const historial = await proveedor.fetchF29History({ ...consulta, months: MESES_F29 });
    await guardarSnapshot({
      companyId: entrada.companyId,
      periodId: periodoRow.id,
      syncRunId: run.id,
      modulo: "f29_periods",
      payload: historial,
    });
    for (const fila of normalizarF29(historial)) {
      const p = await asegurarPeriodo(entrada.companyId, fila.period);
      await supabaseAdmin.from("tax_f29_history").upsert(
        {
          company_id: entrada.companyId,
          tax_period_id: p.id,
          declaration_status:
            fila.declaration_status === "pending"
              ? ("draft" as const)
              : fila.declaration_status,
          declared_vat: fila.declared_vat,
          declared_ppm: fila.declared_ppm,
          declared_withholdings: fila.declared_withholdings,
          declared_total: fila.declared_total,
          vat_carryforward: fila.vat_carryforward,
          filed_at: fila.filed_at,
          source: "mock_gateway",
          raw_data: { origen: "proveedor_simulado" },
        },
        { onConflict: "company_id,tax_period_id" },
      );
    }
  });

  // 4. Retenciones
  await ejecutar(["withholdings"], async () => {
    const ret = await proveedor.fetchWithholdings(consulta);
    await guardarSnapshot({
      companyId: entrada.companyId,
      periodId: periodoRow.id,
      syncRunId: run.id,
      modulo: "withholdings",
      payload: ret,
    });
    const n = normalizarRetenciones(ret);
    await supabaseAdmin.from("tax_monthly_summaries").upsert(
      {
        company_id: entrada.companyId,
        tax_period_id: periodoRow.id,
        estimated_withholdings: n.total,
        withholdings_source: "documents",
        source: "mock_gateway",
      },
      { onConflict: "company_id,tax_period_id" },
    );
  });

  const hubieron = completados.length > 0;
  const estado: ResultadoSincronizacion["estado"] = fallidos.length
    ? hubieron
      ? "partial"
      : "failed"
    : "success";
  const fin = new Date();
  const errorCodigo = primerError
    ? (primerError as SiiProviderError).code
    : null;

  // 5. Recálculo oficial en servidor con los datos ya persistidos
  if (hubieron) {
    await supabaseAdmin
      .from("tax_periods")
      .update({ data_source: "mock_gateway" })
      .eq("id", periodoRow.id);
    await recalculateTaxPeriod(userId, {
      companyId: entrada.companyId,
      periodo: entrada.periodo,
    });
  }

  await supabaseAdmin
    .from("tax_sync_runs")
    .update({
      status: estado === "partial" ? "partial" : estado === "success" ? "success" : "failed",
      completed_at: fin.toISOString(),
      records_received: recibidos,
      records_created: creados,
      records_updated: actualizados,
      modules_completed: completados,
      modules_failed: fallidos,
      modules_from_cache: desdeCache,
      cache_hit: desdeCache.length > 0,
      provider_request_count: consultas,
      estimated_credits: consultas,
      data_through_date: datosHasta,
      duration_ms: Date.now() - inicio,
      error_code: errorCodigo,
      error_message: primerError ? (primerError as SiiProviderError).message : null,
      next_retry_at:
        estado !== "success" && primerError && (primerError as SiiProviderError).reintentable
          ? proximoReintento(fin, 1)
          : null,
    })
    .eq("id", run.id);

  /**
   * Estado de la conexión según lo ocurrido:
   * - sesión inválida: queda en error y exige volver a autorizar;
   * - proveedor caído o resultado parcial: queda "stale" (hay datos, pero
   *   pueden estar incompletos);
   * - todo bien: conectada.
   */
  const estadoConexion = sesionInvalida
    ? "error"
    : estado === "success"
      ? "connected"
      : "stale";

  await supabaseAdmin
    .from("tax_sii_connections")
    .update({
      status: estadoConexion,
      last_attempt_at: fin.toISOString(),
      last_successful_sync_at: hubieron
        ? fin.toISOString()
        : conexionFila.last_successful_sync_at,
      last_error_code: errorCodigo,
      last_error_message: primerError ? (primerError as SiiProviderError).message : null,
    })
    .eq("id", conexionFila.id);
  await supabaseAdmin
    .from("tax_companies")
    .update({
      last_sync_at: hubieron ? fin.toISOString() : empresa.last_sync_at,
      connection_status: estadoConexion,
    })
    .eq("id", entrada.companyId);


  await registrarActividad(
    entrada.companyId,
    userId,
    "sii.sync_demo",
    "tax_sync_runs",
    {
      periodo: entrada.periodo,
      estado,
      consultas,
      modulos_fallidos: fallidos.length,
    },
  );

  const mensaje =
    estado === "success"
      ? "Actualizamos la información demostrativa de este periodo."
      : estado === "partial"
        ? "Trajimos solo una parte de la información. Los cálculos quedan como estimación parcial."
        : primerError
          ? (primerError as SiiProviderError).message
          : "No pudimos completar la actualización demostrativa.";

  return {
    ejecutada: true,
    motivo: decision.motivo,
    estado,
    periodo: entrada.periodo,
    syncRunId: run.id,
    modulosCompletados: completados,
    modulosFallidos: fallidos,
    modulosDesdeCache: desdeCache,
    documentosRecibidos: recibidos,
    documentosCreados: creados,
    documentosActualizados: actualizados,
    documentosDescartados: descartados,
    consultasProveedor: consultas,
    datosHasta,
    ultimaSincronizacion: hubieron
      ? fin.toISOString()
      : conexionFila.last_successful_sync_at,
    proximaActualizacion: decision.proximaActualizacion,
    errorCodigo,
    mensaje,
    simulado: true,
  };
}

export interface RegistroSincronizacion {
  id: string;
  periodo: string | null;
  tipo: string;
  estado: string;
  iniciada: string;
  completada: string | null;
  documentos: number;
  consultas: number;
  desdeCache: boolean;
  modulosFallidos: string[];
  errorMensaje: string | null;
}

export async function listarSincronizaciones(
  userId: string,
  companyId: string,
  limite = 10,
): Promise<RegistroSincronizacion[]> {
  await exigirRol(userId, companyId, ["owner", "business_user", "accountant", "viewer"]);
  const { data } = await supabaseAdmin
    .from("tax_sync_runs")
    .select(
      "id, status, sync_type, trigger_type, started_at, completed_at, records_received, provider_request_count, cache_hit, modules_failed, error_message, tax_periods(period)",
    )
    .eq("company_id", companyId)
    .order("started_at", { ascending: false })
    .limit(limite);

  return (data ?? []).map((f) => ({
    id: f.id,
    periodo:
      (f.tax_periods as { period: string } | null)?.period ?? null,
    tipo: String(f.trigger_type ?? f.sync_type),
    estado: String(f.status),
    iniciada: f.started_at,
    completada: f.completed_at,
    documentos: f.records_received ?? 0,
    consultas: f.provider_request_count ?? 0,
    desdeCache: !!f.cache_hit,
    modulosFallidos: (f.modules_failed ?? []) as string[],
    errorMensaje: f.error_message,
  }));
}
