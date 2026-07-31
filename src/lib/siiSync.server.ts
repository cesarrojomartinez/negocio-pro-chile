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
import { totalesFirmados } from "@/integrations/sii/normalizeProviderData";
import {
  MODULOS_SINCRONIZACION,
  SiiProviderError,
  type ProviderRcvSummary,
  type SiiModule,
  type SiiProviderAdapter,
  type SiiProviderId,
} from "@/integrations/sii/contracts";
import {
  documentosConDetalleEsperados,
  documentosSoloResumenMensual,
  RESUMEN_VACIO,
  sumarResumenes,
} from "@/integrations/sii/rcvSummary";

import { mockSiiProviderAdapter } from "@/integrations/sii/mockSiiProviderAdapter";
import {
  apiGatewaySiiProviderAdapter,
  crearAdaptadorApiGateway,
  type CredencialesTemporales,
} from "@/integrations/sii/apiGatewaySiiProviderAdapter";
import {
  RegistroConsumo,
  MAX_REAL_PROVIDER_REQUESTS_PER_SYNC,
} from "@/integrations/sii/apiGatewayClient";
import { sanitizarProfundo } from "@/integrations/sii/sanitize";
import { MODULOS_REALES_HABILITADOS } from "@/integrations/sii/apiGatewayResourceMap";
import {
  diagnoseApiGatewayConfiguration,
  empresaHabilitadaParaPruebaReal,
  leerConfiguracion,
  modoPruebaRealHabilitado,
} from "@/lib/apiGateway.server";
import { diaCivil } from "@/lib/syncPolicy";
import {
  decidirActualizacionPeriodo,
  periodoEnCurso,
  type DecisionPeriodo,
} from "@/lib/syncEconomica";

import { registrarEstadoPeriodo } from "@/lib/periodSyncState.server";
import { normalizarRut } from "@/lib/rut";
import { normalizarPeriodo } from "@/lib/periodo";




export const VERSION_CONSENTIMIENTO = "demo-2026-07";
const MESES_F29 = 6;

/** Errores que invalidan la sesión: no tiene sentido seguir pidiendo módulos. */
const ERRORES_DE_SESION = [
  "AUTH_EXPIRED",
  "SESSION_EXPIRED",
  "SESSION_INVALID",
  "INVALID_CREDENTIALS",
  "NOT_AUTHORIZED",
];

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
  /**
   * Evalúa la caché periodo por periodo (frescura del propio mes, F29 vigente,
   * periodo cerrado). Es lo que usa la actualización real: seleccionar varios
   * meses no invalida la caché de todos.
   */
  politicaPorPeriodo?: boolean;
}

/**
 * Decisión económica para UN periodo: mira su propia última sincronización
 * exitosa, si ya tiene F29 leído y si está cerrado. No consulta al proveedor.
 */
async function decisionPorPeriodo(
  companyId: string,
  periodo: string,
  ahora: Date,
): Promise<DecisionPeriodo> {
  const [{ data: ultima }, { data: f29 }] = await Promise.all([
    supabaseAdmin
      .from("tax_sync_runs")
      .select("completed_at")
      .eq("company_id", companyId)
      .eq("status", "success")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("tax_f29_extractions")
      .select("extraction_status")
      .eq("company_id", companyId)
      .eq("period", periodo)
      .eq("superseded", false)
      .in("extraction_status", ["success", "needs_review", "partial"])
      .limit(1)
      .maybeSingle(),
  ]);
  return decidirActualizacionPeriodo({
    periodo,
    periodoActual: periodoEnCurso(ahora),
    ahora,
    ultimaSincronizacionRcv: (ultima?.completed_at as string | null) ?? null,
    tieneF29Vigente: !!f29,
    periodoCerrado: periodoYaCerrado(periodo, ahora),
  });
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

async function conexionDe(companyId: string, proveedor: SiiProviderId = "mock") {
  const { data } = await supabaseAdmin
    .from("tax_sii_connections")
    .select("*")
    .eq("company_id", companyId)
    .eq("provider", proveedor)
    .maybeSingle();
  return data ?? null;
}


/** Minutos sin actividad tras los cuales una ejecución se considera abandonada. */
export const MINUTOS_EJECUCION_ABANDONADA = 15;

/**
 * Cierra ejecuciones que quedaron "en curso" (por ejemplo, si el navegador se
 * cerró antes de recibir la respuesta). No consume créditos y libera el periodo
 * para poder actualizarlo de nuevo.
 */
export async function cerrarEjecucionesColgadas(
  companyId: string,
  periodId: string | null,
  ahora: Date,
): Promise<number> {
  const limite = new Date(
    ahora.getTime() - MINUTOS_EJECUCION_ABANDONADA * 60_000,
  ).toISOString();
  let consulta = supabaseAdmin
    .from("tax_sync_runs")
    .update({
      status: "failed",
      error_code: "STALE_SYNC_RUN",
      error_message:
        "La actualización anterior quedó interrumpida y se cerró automáticamente.",
      completed_at: ahora.toISOString(),
    })
    .eq("company_id", companyId)
    .eq("status", "running")
    .lt("started_at", limite);
  if (periodId) consulta = consulta.eq("tax_period_id", periodId);
  const { data } = await consulta.select("id");
  return data?.length ?? 0;
}

/** Asegura la existencia del periodo y devuelve su id. */
async function asegurarPeriodo(companyId: string, periodo: string) {
  const p = normalizarPeriodo(periodo);
  if (!p) throw new ErrorNegocio("El periodo debe tener el formato AAAA-MM.");
  const { data } = await supabaseAdmin
    .from("tax_periods")
    .select("id, status")
    .eq("company_id", companyId)
    .eq("period", p)
    .maybeSingle();
  if (data) return data;

  // El año y el mes salen del propio texto: nunca de una fecha ni de una zona.
  const year = Number(p.slice(0, 4));
  const month = Number(p.slice(5, 7));
  if (!year || !month) throw new ErrorNegocio("El periodo indicado no es válido.");

  const { data: creado, error } = await supabaseAdmin
    .from("tax_periods")
    .insert({
      company_id: companyId,
      period: p,

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

/**
 * Devuelve la conexión vigente de la empresa. Si existe una conexión real de
 * prueba con API Gateway, tiene prioridad sobre la demostrativa.
 */
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
  const real = await conexionDe(companyId, "api_gateway");
  if (real && ["connected", "stale", "error"].includes(String(real.status)))
    return mapConexion(real);
  const fila = await conexionDe(companyId);
  return fila ? mapConexion(fila) : real ? mapConexion(real) : null;
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

/**
 * Clasificación exacta de un módulo en una sincronización.
 * "no_disponible" y "sin_informacion" no son fallas: no bloquean el resto.
 */
export type EstadoModulo =
  | "completado"
  | "sin_informacion"
  | "no_disponible"
  | "no_contratado"
  | "error_autenticacion"
  | "error_proveedor"
  | "timeout"
  | "respuesta_invalida"
  | "desde_cache"
  | "omitido";

export interface DetalleModulo {
  modulo: SiiModule;
  estado: EstadoModulo;
  /** Código interno que originó la clasificación, si existe. */
  motivo: string | null;
}

export interface DocumentosPorCategoria {
  ventas: number;
  comprasRegistro: number;
  comprasPendiente: number;
  comprasReclamado: number;
  comprasNoIncluir: number;
}

const CATEGORIAS_VACIAS: DocumentosPorCategoria = {
  ventas: 0,
  comprasRegistro: 0,
  comprasPendiente: 0,
  comprasReclamado: 0,
  comprasNoIncluir: 0,
};

/** Traduce un código del proveedor a la clasificación visible del módulo. */
function clasificarModulo(codigo: string | null): EstadoModulo {
  switch (codigo) {
    case null:
      return "completado";
    case "PERIOD_NOT_AVAILABLE":
      return "sin_informacion";
    case "RESOURCE_NOT_DOCUMENTED":
      return "no_disponible";
    case "PRODUCT_NOT_ENABLED":
      return "no_contratado";
    case "INVALID_CREDENTIALS":
    case "SESSION_INVALID":
    case "SESSION_EXPIRED":
    case "AUTH_EXPIRED":
    case "NOT_AUTHORIZED":
    case "ACCOUNT_BLOCKED":
      return "error_autenticacion";
    case "TIMEOUT":
      return "timeout";
    case "MALFORMED_RESPONSE":
    case "INVALID_PROVIDER_RESPONSE":
      return "respuesta_invalida";
    default:
      return "error_proveedor";
  }
}

/** Estados que NO cuentan como falla real de la sincronización. */
const ESTADOS_SIN_FALLA: EstadoModulo[] = [
  "completado",
  "sin_informacion",
  "no_disponible",
  "desde_cache",
  "omitido",
];

/** Totales oficiales tal como los informa el resumen del RCV, sin recalcular. */
export interface TotalesResumenRcv {
  ventas: ProviderRcvSummary;
  compras: ProviderRcvSummary;
}

/** Valores neutros para las salidas que no llegan a consultar al proveedor. */
const SIN_RESUMEN = {
  documentosInformadosResumen: 0,
  documentosPersistidos: 0,
  motivosRechazo: [] as { motivo: string; cantidad: number }[],
  totalesResumen: null as TotalesResumenRcv | null,
  inconsistencias: [] as string[],
  fuenteTotales: "documents" as "documents" | "rcv_summary",
};


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
  /** Módulos sin recurso oficial disponible en esta etapa. */
  modulosNoDisponibles: SiiModule[];
  /** Clasificación exacta de cada módulo solicitado. */
  detalleModulos: DetalleModulo[];
  /** Documentos importados por categoría del RCV. */
  documentosPorCategoria: DocumentosPorCategoria;

  documentosRecibidos: number;
  documentosCreados: number;
  documentosActualizados: number;
  documentosDescartados: number;
  /** Documentos que el RESUMEN oficial del RCV declara para el periodo. */
  documentosInformadosResumen: number;
  /** Documentos efectivamente guardados en la base tras normalizar. */
  documentosPersistidos: number;
  /** Motivos agrupados por los que se descartó una fila del detalle. */
  motivosRechazo: { motivo: string; cantidad: number }[];
  /** Totales del resumen oficial (ventas y compras) tal como los informa el SII. */
  totalesResumen: TotalesResumenRcv | null;
  /** Diferencias detectadas entre el resumen oficial y el detalle importado. */
  inconsistencias: string[];
  /** De dónde salen las cifras que ve el usuario en el panel. */
  fuenteTotales: "documents" | "rcv_summary";

  consultasProveedor: number;
  datosHasta: string | null;
  ultimaSincronizacion: string | null;
  proximaActualizacion: string | null;
  errorCodigo: string | null;
  mensaje: string;
  simulado: boolean;
  fuente: "mock_gateway" | "api_gateway";
  creditosConsumidos: number | null;
  creditosDisponibles: number | null;
  proxyUsado: boolean | null;
}

async function guardarSnapshot(entrada: {
  companyId: string;
  periodId: string | null;
  syncRunId: string | null;
  modulo: SiiModule;
  payload: unknown;
  proveedor: SiiProviderId;
}) {
  await supabaseAdmin.from("tax_provider_snapshots").insert({
    company_id: entrada.companyId,
    tax_period_id: entrada.periodId,
    sync_run_id: entrada.syncRunId,
    provider: entrada.proveedor,
    module: entrada.modulo,
    // Barrera dura: ninguna clave, token ni cookie llega a la base.
    payload: sanitizarProfundo(entrada.payload) as never,
    received_at: new Date().toISOString(),
    normalized_at: new Date().toISOString(),
  });
}

async function upsertDocumentos(
  companyId: string,
  periodId: string,
  filas: FilaDocumentoNormalizada[],
  fuente: "mock_gateway" | "api_gateway",
) {
  if (!filas.length) return { creados: 0, actualizados: 0 };

  const { data: existentes } = await supabaseAdmin
    .from("tax_documents")
    .select("external_id")
    .eq("company_id", companyId)
    .eq("source", fuente)
    .in(
      "external_id",
      filas.map((f) => f.external_id),
    );
  const yaEstaban = new Set((existentes ?? []).map((e) => e.external_id));

  const { error } = await supabaseAdmin.from("tax_documents").upsert(
    filas.map((f) => ({
      company_id: companyId,
      tax_period_id: periodId,
      source: fuente,
      ...f,
    })),
    { onConflict: "company_id,source,external_id" },
  );
  if (error) throw new ErrorNegocio("No pudimos guardar los documentos recibidos.");

  const actualizados = filas.filter((f) => yaEstaban.has(f.external_id)).length;
  return { creados: filas.length - actualizados, actualizados };
}


/**
 * Sincroniza un periodo completo contra el proveedor activo (simulado o real):
 * consulta, guarda el respaldo crudo sanitizado, normaliza, deduplica,
 * recalcula y deja registro del uso y del consumo.
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
  const proveedorId: SiiProviderId = opciones.proveedorId ?? "mock";
  const fuente = fuenteDe(proveedorId);
  const esReal = proveedorId === "api_gateway";
  const registro = opciones.registro ?? null;
  const empresa = await empresaDe(entrada.companyId);
  const conexionFila = await conexionDe(entrada.companyId, proveedorId);

  // "connecting" es una primera conexión en curso y "error" es un intento
  // anterior fallido: en ambos casos se puede volver a consultar. Solo
  // "disconnected" (o la ausencia de conexión) bloquea la sincronización.
  const ESTADOS_QUE_PERMITEN_SINCRONIZAR = ["connected", "connecting", "stale", "error"];
  if (
    !conexionFila ||
    !ESTADOS_QUE_PERMITEN_SINCRONIZAR.includes(String(conexionFila.status))
  )

    throw new ErrorNegocio(
      esReal
        ? "Primero necesitas autorizar la conexión real de esta empresa."
        : "Primero necesitas activar la conexión demostrativa de esta empresa.",
    );

  const consumo = () => ({
    creditosConsumidos: registro ? Number(registro.creditosUsados.toFixed(4)) : null,
    creditosDisponibles: registro?.creditosDisponibles ?? null,
    proxyUsado: registro?.proxyUsado ?? null,
  });

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
        ...SIN_RESUMEN,
        ejecutada: false,
        motivo: "solicitud_repetida",
        estado: previo.status === "success" ? "success" : "skipped",
        periodo: entrada.periodo,
        syncRunId: previo.id,
        modulosCompletados: (previo.modules_completed ?? []) as SiiModule[],
        modulosFallidos: (previo.modules_failed ?? []) as SiiModule[],
        modulosDesdeCache: (previo.modules_from_cache ?? []) as SiiModule[],
        modulosNoDisponibles: [],
        detalleModulos: [],
        documentosPorCategoria: { ...CATEGORIAS_VACIAS },
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
        simulado: !esReal,
        fuente,
        ...consumo(),
      };
  }

  const ahora = opciones.ahora ?? new Date();
  const periodoRow = await asegurarPeriodo(entrada.companyId, entrada.periodo);
  const decision = opciones.omitirPoliticaCache
    ? {
        debeConsultar: true,
        motivo: "solicitud_manual" as const,
        proximaActualizacion: null,
        minutosDesdeUltima: null,
      }
    : decidirSincronizacion({
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
        source: fuente,
        cache_hit: true,
        completed_at: ahora.toISOString(),
        modules_requested: MODULOS_SINCRONIZACION,
        triggered_by: userId,
        duration_ms: 0,
      })
      .select("id")
      .single();

    return {
      ...SIN_RESUMEN,
      ejecutada: false,
      motivo: decision.motivo,
      estado: "skipped",
      periodo: entrada.periodo,
      syncRunId: omitido?.id ?? null,
      modulosCompletados: [],
      modulosFallidos: [],
      modulosDesdeCache: MODULOS_SINCRONIZACION.slice(),
      modulosNoDisponibles: [],
      detalleModulos: MODULOS_SINCRONIZACION.map((m) => ({
        modulo: m,
        estado: "desde_cache" as EstadoModulo,
        motivo: null,
      })),
      documentosPorCategoria: { ...CATEGORIAS_VACIAS },
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
      simulado: !esReal,
      fuente,
      ...consumo(),
    };
  }


  // Antes de abrir una nueva ejecución, cerramos las que quedaron colgadas.
  await cerrarEjecucionesColgadas(entrada.companyId, periodoRow.id, ahora);

  const inicio = Date.now();

  const { data: run, error: errorRun } = await supabaseAdmin
    .from("tax_sync_runs")
    .insert({
      company_id: entrada.companyId,
      tax_period_id: periodoRow.id,
      sync_type: tipo === "manual" ? "manual" : "scheduled",
      trigger_type: tipo,
      status: "running",
      source: fuente,
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
  const noDisponibles: SiiModule[] = [];
  const desdeCache: SiiModule[] = plan.desdeCache;
  const detalle = new Map<SiiModule, DetalleModulo>();
  const categorias: DocumentosPorCategoria = { ...CATEGORIAS_VACIAS };
  let consultas = 0;
  let recibidos = 0;
  let descartados = 0;
  let creados = 0;
  let actualizados = 0;
  let datosHasta: string | null = null;
  let primerError: SiiProviderError | null = null;
  let sesionInvalida = false;
  // Trazabilidad resumen → detalle → persistencia.
  let resumenVentas: ProviderRcvSummary = RESUMEN_VACIO;
  let resumenCompras: ProviderRcvSummary = RESUMEN_VACIO;
  let hayResumen = false;
  let persistidos = 0;
  const motivos = new Map<string, number>();
  const anotarDescartes = (lista: { motivo: string }[]) => {
    for (const d of lista) motivos.set(d.motivo, (motivos.get(d.motivo) ?? 0) + 1);
  };
  const totalesDetalle = { ventas: 0, compras: 0 };


  const marcar = (modulos: SiiModule[], estado: EstadoModulo, motivo: string | null) => {
    for (const m of modulos) detalle.set(m, { modulo: m, estado, motivo });
  };
  for (const m of desdeCache) marcar([m], "desde_cache", null);

  const ejecutar = async (modulos: SiiModule[], fn: () => Promise<void>) => {
    // Módulos sin recurso oficial: no se consultan, no consumen créditos y no
    // se cuentan como falla. Solo bajan la confiabilidad de lo que dependa de
    // esa información.
    if (esReal && modulos.every((m) => !MODULOS_REALES_HABILITADOS.includes(m))) {
      noDisponibles.push(...modulos);
      marcar(modulos, "no_disponible", "RESOURCE_NOT_AVAILABLE");
      return;
    }
    // Sin sesión válida no tiene sentido seguir consultando el resto.
    if (sesionInvalida) {
      fallidos.push(...modulos);
      marcar(modulos, "error_autenticacion", "SESSION_INVALID");
      return;
    }
    if (!modulos.some((m) => porConsultar.has(m))) {
      if (!modulos.some((m) => detalle.has(m))) marcar(modulos, "omitido", null);
      return;
    }
    try {
      consultas += 1;
      await fn();
      completados.push(...modulos);
      marcar(modulos, "completado", null);
    } catch (error) {
      if (error instanceof SiiProviderError) {
        const estadoModulo = clasificarModulo(error.code);
        marcar(modulos, estadoModulo, error.code);
        if (estadoModulo === "no_disponible") {
          noDisponibles.push(...modulos);
          return;
        }
        // "sin información" no es una falla: el periodo simplemente no tiene
        // movimientos publicados por el SII.
        if (estadoModulo === "sin_informacion") return;
        fallidos.push(...modulos);
        if (!primerError) primerError = error;
        if (ERRORES_DE_SESION.includes(error.code)) sesionInvalida = true;
      } else {
        fallidos.push(...modulos);
        marcar(modulos, "error_proveedor", "INTERNAL");
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



  // 1. Ventas del RCV: primero el resumen oficial, después el detalle.
  await ejecutar(["rcv_sales_documents"], async () => {
    const ventas = await proveedor.fetchSalesRcv(consulta);
    await guardarSnapshot({
      companyId: entrada.companyId,
      periodId: periodoRow.id,
      syncRunId: run.id,
      proveedor: proveedorId,
      modulo: "rcv_sales_documents",
      // El respaldo guarda el resumen, el detalle y el diagnóstico de la forma
      // de la respuesta: así se puede revisar sin volver a consultar.
      payload: ventas,
    });
    if (ventas.rcvSummary) {
      resumenVentas = ventas.rcvSummary;
      hayResumen = true;
    }
    const n = normalizarVentas(ventas);
    recibidos += ventas.documents.length;
    totalesDetalle.ventas += ventas.documents.length;
    categorias.ventas += n.documentos.length;
    descartados += n.descartados.length;
    anotarDescartes(n.descartados);
    persistidos += n.documentos.length;
    const r = await upsertDocumentos(entrada.companyId, periodoRow.id, n.documentos, fuente);
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
          proveedor: proveedorId,
          modulo,
          payload: {
            period: compras.period,
            documents: docs,
            summary:
              compras.rcvSummaryByStatus?.[
                estado as keyof NonNullable<typeof compras.rcvSummaryByStatus>
              ] ?? null,
            diagnostics: compras.diagnostics?.filter((d) => d.modulo === modulo) ?? [],
          },
        });
      }
      if (compras.rcvSummaryByStatus) {
        resumenCompras = sumarResumenes(Object.values(compras.rcvSummaryByStatus));
        hayResumen = true;
      }
      const n = normalizarCompras(compras);
      const recibidosCompras = Object.values(compras.byStatus).reduce(
        (s, d) => s + d.length,
        0,
      );
      recibidos += recibidosCompras;
      totalesDetalle.compras += recibidosCompras;
      categorias.comprasRegistro += compras.byStatus.registered.length;
      categorias.comprasPendiente += compras.byStatus.pending.length;
      categorias.comprasReclamado += compras.byStatus.claimed.length;
      categorias.comprasNoIncluir += compras.byStatus.excluded.length;
      descartados += n.descartados.length;
      anotarDescartes(n.descartados);
      persistidos += n.documentos.length;
      const r = await upsertDocumentos(entrada.companyId, periodoRow.id, n.documentos, fuente);
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
      proveedor: proveedorId,
      modulo: "f29_periods",
      payload: historial,
    });
    for (const fila of normalizarF29(historial)) {
      const p = await asegurarPeriodo(entrada.companyId, fila.period);
      // Nunca sobreescribimos un F29 confirmado por el contador ni el leído
      // del Formulario 29 oficial: el listado del proveedor solo trae folio,
      // fecha y estado, sin cifras tributarias.
      const { data: existente } = await supabaseAdmin
        .from("tax_f29_history")
        .select("source")
        .eq("company_id", entrada.companyId)
        .eq("tax_period_id", p.id)
        .maybeSingle();
      if (existente?.source === "accountant" || existente?.source === "f29_pdf_extracted")
        continue;

      /**
       * El listado sin montos NO puede guardarse como declaración en cero:
       * eso apagaría el PPM, el remanente y las retenciones del periodo.
       */
      const traeMontos = [
        fila.declared_vat,
        fila.declared_ppm,
        fila.declared_withholdings,
        fila.declared_total,
        fila.vat_carryforward,
      ].some((v) => v != null && v !== 0);

      await supabaseAdmin.from("tax_f29_history").upsert(
        {
          company_id: entrada.companyId,
          tax_period_id: p.id,
          declaration_status:
            fila.declaration_status === "pending"
              ? ("draft" as const)
              : fila.declaration_status,
          declared_vat: traeMontos ? fila.declared_vat : null,
          declared_ppm: traeMontos ? fila.declared_ppm : null,
          declared_withholdings: traeMontos ? fila.declared_withholdings : null,
          declared_total: traeMontos ? fila.declared_total : null,
          vat_carryforward: traeMontos ? fila.vat_carryforward : null,
          filed_at: fila.filed_at,
          source: fuente,
          raw_data: {
            origen: fuente === "api_gateway" ? "listado_proveedor" : "proveedor_simulado",
            solo_listado: !traeMontos,
          },
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
      proveedor: proveedorId,
      modulo: "withholdings",
      payload: ret,
    });
    const n = normalizarRetenciones(ret);
    await supabaseAdmin.from("tax_monthly_summaries").upsert(
      {
        company_id: entrada.companyId,
        tax_period_id: periodoRow.id,
        estimated_withholdings: n.total,
        // Sin detalle de retenciones no afirmamos que sean cero.
        withholdings_source: n.detalle.length > 0 || n.total > 0 ? "documents" : "unknown",
        source: fuente,
      },
      { onConflict: "company_id,tax_period_id" },
    );

  });

  const hubieron = completados.length > 0;

  /**
   * Consistencia obligatoria resumen ↔ detalle.
   *
   * Comparación justa: las boletas electrónicas y los comprobantes de pago
   * electrónico el SII los informa SOLO como total del mes, sin detalle
   * documento por documento. Sus cantidades entran en los totales oficiales
   * pero nunca pueden guardarse una por una, así que compararlas contra lo
   * persistido marcaba "por revisar" un resultado en realidad correcto.
   */
  const informadosResumen = resumenVentas.documentCount + resumenCompras.documentCount;
  const esperadosConDetalle =
    documentosConDetalleEsperados(resumenVentas) +
    documentosConDetalleEsperados(resumenCompras);
  const soloTotalMensual =
    documentosSoloResumenMensual(resumenVentas) +
    documentosSoloResumenMensual(resumenCompras);
  const inconsistencias: string[] = [];
  if (hayResumen) {
    if (documentosConDetalleEsperados(resumenVentas) > 0 && totalesDetalle.ventas === 0)
      inconsistencias.push(
        `El SII informa ${documentosConDetalleEsperados(resumenVentas)} documentos de venta con detalle y no llegó ninguno.`,
      );
    if (documentosConDetalleEsperados(resumenCompras) > 0 && totalesDetalle.compras === 0)
      inconsistencias.push(
        `El SII informa ${documentosConDetalleEsperados(resumenCompras)} documentos de compra con detalle y no llegó ninguno.`,
      );
    if (esperadosConDetalle > 0 && persistidos > 0 && persistidos < esperadosConDetalle)
      inconsistencias.push(
        `El resumen informa ${esperadosConDetalle} documentos con detalle y guardamos ${persistidos}.`,
      );
  }


  const estadoBase: ResultadoSincronizacion["estado"] = fallidos.length
    ? hubieron
      ? "partial"
      : "failed"
    : "success";
  const estado: ResultadoSincronizacion["estado"] =
    estadoBase === "success" && inconsistencias.length ? "partial" : estadoBase;
  const fin = new Date();
  const errorCodigo = primerError
    ? (primerError as SiiProviderError).code
    : null;

  // 5. Recálculo oficial en servidor con los datos ya persistidos
  if (hubieron) {
    await supabaseAdmin
      .from("tax_periods")
      .update({
        data_source: fuente,
        rcv_summary: hayResumen
          ? ({ ventas: resumenVentas, compras: resumenCompras } as never)
          : null,
        rcv_summary_updated_at: hayResumen ? fin.toISOString() : null,
      })
      .eq("id", periodoRow.id);
    await recalculateTaxPeriod(userId, {
      companyId: entrada.companyId,
      periodo: entrada.periodo,
    });
  }

  /**
   * Respaldo del panel: si el resumen oficial trae movimientos pero el detalle
   * no pudo importarse, se muestran igualmente los totales del SII marcados
   * como provenientes del resumen. Nunca se inventan documentos.
   */
  const usarResumenComoRespaldo =
    hubieron && hayResumen && informadosResumen > 0 && persistidos === 0;
  if (hubieron) {
    await supabaseAdmin.from("tax_monthly_summaries").upsert(
      usarResumenComoRespaldo
        ? {
            company_id: entrada.companyId,
            tax_period_id: periodoRow.id,
            totals_source: "rcv_summary",
            sales_total: Math.round(resumenVentas.totalAmount),
            exempt_sales: Math.round(resumenVentas.exemptAmount),
            vat_debit: Math.round(resumenVentas.vatAmount),
            purchases_total: Math.round(resumenCompras.totalAmount),
            net_purchases: Math.round(resumenCompras.netAmount),
            exempt_purchases: Math.round(resumenCompras.exemptAmount),
            vat_credit: Math.round(resumenCompras.vatAmount),
          }
        : {
            company_id: entrada.companyId,
            tax_period_id: periodoRow.id,
            totals_source: "documents",
          },
      { onConflict: "company_id,tax_period_id" },
    );
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
      provider_request_count: registro?.consultas ?? consultas,
      estimated_credits: consultas,
      actual_credits: registro ? Number(registro.creditosUsados.toFixed(4)) : null,
      credits_balance: registro?.creditosDisponibles ?? null,
      proxy_used: registro?.proxyUsado ?? null,
      pages_requested: registro?.consultas ?? undefined,
      summary_documents_reported: informadosResumen,
      detail_documents_received: recibidos,
      documents_persisted: persistidos,
      documents_rejected: descartados,
      rejection_reasons: [...motivos.entries()].map(([motivo, cantidad]) => ({
        motivo,
        cantidad,
      })) as never,
      summary_totals: hayResumen
        ? ({ ventas: resumenVentas, compras: resumenCompras } as never)
        : null,
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
   * - sesión inválida o ninguna consulta exitosa: queda en "error";
   * - resultado parcial (hay datos, pero pueden estar incompletos): "stale";
   * - todo bien: "connected".
   * "stale" nunca se usa antes de una primera sincronización exitosa.
   */
  const estadoConexion =
    sesionInvalida || estado === "failed"
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

  // Estado de frescura y caché del periodo, para explicar al usuario cuán
  // reciente es la información que está viendo.
  await registrarEstadoPeriodo({
    companyId: entrada.companyId,
    periodId: periodoRow.id,
    periodo: entrada.periodo,
    proveedor: proveedorId,
    ahora: fin,
    ejecutada: consultas > 0,
    exitosa: hubieron,
    desdeCache: desdeCache.length > 0,
    syncRunId: run.id,
    triggerType: tipo,
    datosHasta,
    periodoConfirmado: ["confirmed", "closed"].includes(String(periodoRow.status)),
  });




  await registrarActividad(
    entrada.companyId,
    userId,
    esReal ? "sii.sync_real" : "sii.sync_demo",
    "tax_sync_runs",
    {
      periodo: entrada.periodo,
      estado,
      consultas,
      modulos_fallidos: fallidos.length,
      fuente,
    },
  );

  const detalleModulos = MODULOS_SINCRONIZACION.map(
    (m): DetalleModulo => detalle.get(m) ?? { modulo: m, estado: "omitido", motivo: null },
  );
  const sinInformacion = detalleModulos.filter((d) => d.estado === "sin_informacion");
  const soloAutenticacion =
    !completados.length &&
    fallidos.length > 0 &&
    detalleModulos
      .filter((d) => fallidos.includes(d.modulo))
      .every((d) => d.estado === "error_autenticacion");

  const mensaje = soloAutenticacion
    ? "No fue posible autenticar la consulta en el SII. Revisa el RUT autorizado y la Clave Tributaria."
    : estado === "success"
      ? // "Sin movimientos" solo cuando el resumen oficial también viene vacío.
        informadosResumen === 0 && persistidos === 0
        ? "El SII no registra movimientos para el periodo seleccionado."
        : noDisponibles.length
          ? "Consulta completada. Obtuvimos las ventas y compras disponibles. Algunos antecedentes complementarios del F29 no están disponibles de forma estructurada."
          : esReal
            ? `Actualizamos la información de este periodo con el proveedor real. Guardamos ${persistidos} documentos.`
            : "Actualizamos la información demostrativa de este periodo."
      : estado === "partial"
        ? inconsistencias.length
          ? `Recibimos los totales oficiales del SII, pero no pudimos importar todo el detalle. ${inconsistencias[0]}`
          : "Consulta parcialmente completada. Obtuvimos parte de la información del periodo. Revisa los módulos pendientes."
        : primerError
          ? (primerError as SiiProviderError).message
          : "No pudimos completar la actualización.";

  return {
    ejecutada: true,
    motivo: decision.motivo,
    estado,
    periodo: entrada.periodo,
    syncRunId: run.id,
    documentosInformadosResumen: informadosResumen,
    documentosPersistidos: persistidos,
    motivosRechazo: [...motivos.entries()].map(([motivo, cantidad]) => ({
      motivo,
      cantidad,
    })),
    totalesResumen: hayResumen
      ? { ventas: resumenVentas, compras: resumenCompras }
      : null,
    inconsistencias,
    fuenteTotales: usarResumenComoRespaldo ? "rcv_summary" : "documents",

    modulosCompletados: completados,
    modulosFallidos: fallidos,
    modulosDesdeCache: desdeCache,
    modulosNoDisponibles: noDisponibles,
    detalleModulos,
    documentosPorCategoria: categorias,
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
    simulado: !esReal,
    fuente,
    ...consumo(),
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
