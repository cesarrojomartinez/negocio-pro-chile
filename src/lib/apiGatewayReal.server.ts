/**
 * Prueba real controlada con API Gateway.
 *
 * Reglas de esta etapa:
 * - Solo el dueño de la empresa puede ejecutarla.
 * - Solo empresas explícitamente autorizadas por configuración del backend.
 * - La Clave Tributaria viaja en la solicitud, se usa en memoria durante la
 *   operación y NUNCA se guarda, registra ni devuelve.
 * - Cada ejecución tiene un tope de consultas para proteger los créditos.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  crearAdaptadorApiGateway,
  type CredencialesTemporales,
} from "@/integrations/sii/apiGatewaySiiProviderAdapter";
import {
  MAX_REAL_PROVIDER_REQUESTS_PER_SYNC,
  RegistroConsumo,
} from "@/integrations/sii/apiGatewayClient";
import { SiiProviderError } from "@/integrations/sii/contracts";
import { esRutValido, normalizarRut } from "@/lib/rut";
import { normalizarPeriodo } from "@/lib/periodo";

import {
  empresaHabilitadaParaPruebaReal,
  leerConfiguracion,
  modoPruebaRealHabilitado,
} from "@/lib/apiGateway.server";
import {
  ErrorNegocio,
  exigirRol,
  registrarActividad,
} from "@/lib/companies.server";
import {
  VERSION_CONSENTIMIENTO,
  syncSiiCompanyPeriod,
  type ConexionSii,
  type ResultadoSincronizacion,
} from "@/lib/siiSync.server";


export interface EntradaPruebaReal {
  companyId: string;
  periodo: string;
  /** RUT del usuario autorizado ante el SII. */
  rutUsuario: string;
  /** Fuerza una sesión nueva (`auth_cache=0`) en la primera consulta RCV. */
  sesionNueva?: boolean;
  /** Clave Tributaria. Solo en memoria. */
  claveTributaria: string;
  consentimiento: boolean;
}

/** Resultado de la lectura automática del F29 dentro de la actualización. */
export interface ResultadoF29Automatico {
  estado: "leido" | "no_declarado" | "revisar" | "omitido";
  mensaje: string;
  /** Código específico del F29 (F29_NOT_DECLARED, F29_PERIOD_MISMATCH, etc.). */
  codigo: string | null;
  folio: string | null;
  recalculado: boolean;
}


export interface ResultadoPruebaReal {
  conexion: ConexionSii | null;
  sincronizacion: ResultadoSincronizacion | null;
  consultas: number;
  creditosConsumidos: number;
  creditosDisponibles: number | null;
  proxyUsado: boolean | null;
  mensaje: string;
  errorCodigo: string | null;
  /** Lectura automática del Formulario 29 oficial del mismo periodo. */
  f29: ResultadoF29Automatico;
}


/** Verificaciones previas comunes a toda operación real. */
async function exigirPruebaRealPermitida(userId: string, companyId: string) {
  await exigirRol(userId, companyId, ["owner"]);
  if (!modoPruebaRealHabilitado())
    throw new ErrorNegocio(
      "La prueba con el proveedor real no está habilitada en este ambiente.",
    );
  if (!(await empresaHabilitadaParaPruebaReal(companyId)))
    throw new ErrorNegocio(
      "Esta empresa no está autorizada para la prueba con el proveedor real.",
    );
  const { config } = leerConfiguracion();
  if (!config)
    throw new ErrorNegocio(
      "Falta configurar el servicio del proveedor real en el backend.",
    );
  return config;
}

/**
 * Ejecuta la prueba controlada: valida credenciales, deja registrada la
 * conexión real y sincroniza un periodo con el mismo contrato interno.
 */
export async function ejecutarPruebaRealApiGateway(
  userId: string,
  entrada: EntradaPruebaReal,
): Promise<ResultadoPruebaReal> {
  const config = await exigirPruebaRealPermitida(userId, entrada.companyId);

  if (!entrada.consentimiento)
    throw new ErrorNegocio("Necesitamos tu autorización expresa para continuar.");

  // El periodo es texto AAAA-MM de principio a fin: nunca se convierte a fecha.
  const periodo = normalizarPeriodo(entrada.periodo);
  if (!periodo) throw new ErrorNegocio("El periodo debe tener el formato AAAA-MM.");
  entrada = { ...entrada, periodo };

  const rutUsuario = normalizarRut(entrada.rutUsuario ?? "");
  if (!esRutValido(rutUsuario))
    throw new ErrorNegocio("El RUT del usuario autorizado no es válido.");
  if (!entrada.claveTributaria || entrada.claveTributaria.length < 4)
    throw new ErrorNegocio("La clave indicada no es válida.");


  const { data: empresa } = await supabaseAdmin
    .from("tax_companies")
    .select("id, rut")
    .eq("id", entrada.companyId)
    .maybeSingle();
  if (!empresa) throw new ErrorNegocio("No pudimos cargar la empresa.");

  const registro = new RegistroConsumo(MAX_REAL_PROVIDER_REQUESTS_PER_SYNC);
  const credenciales: CredencialesTemporales = {
    rutEmpresa: normalizarRut(String(empresa.rut)),
    rutUsuario,
    claveTributaria: entrada.claveTributaria,
  };
  const proveedor = crearAdaptadorApiGateway({
    config,
    credenciales,
    registro,
    // Uso puntual: solo cuando la ejecución anterior indicó sesión vencida.
    sesionNueva: entrada.sesionNueva === true,
  });
  const ahora = new Date().toISOString();

  const consumo = () => ({
    consultas: registro.consultas,
    creditosConsumidos: Number(registro.creditosUsados.toFixed(4)),
    creditosDisponibles: registro.creditosDisponibles,
    proxyUsado: registro.proxyUsado,
  });

  // 1. Preparar la referencia local de conexión. NO consulta al proveedor ni
  //    gasta créditos: la validación real ocurre en la primera consulta al RCV.
  const conexionProveedor = await proveedor.connectCompany({
    rut: credenciales.rutEmpresa,
    authMethod: "tax_key",
  });

  // 2. Dejar registrada la conexión ANTES de consultar, en estado
  //    "connecting": la ejecución queda auditable aunque el RCV falle, y
  //    "stale" se reserva para conexiones que ya tuvieron una sincronización
  //    exitosa. Nunca se guarda la clave.
  const { data: filaConexion, error: errorConexion } = await supabaseAdmin
    .from("tax_sii_connections")
    .upsert(
      {
        company_id: entrada.companyId,
        provider: "api_gateway",
        provider_connection_ref: conexionProveedor.providerConnectionRef,
        auth_method: "tax_key",
        status: "connecting",

        authorized_rut: conexionProveedor.authorizedRut,
        connected_at: conexionProveedor.connectedAt,
        session_expires_at: conexionProveedor.sessionExpiresAt,
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
  if (errorConexion || !filaConexion)
    throw new ErrorNegocio("No pudimos guardar la conexión real.");

  await registrarActividad(
    entrada.companyId,
    userId,
    "sii.real_test_started",
    "tax_sii_connections",
    { proveedor: "api_gateway", version_consentimiento: VERSION_CONSENTIMIENTO },
  );

  // 3. Sincronizar el periodo empezando directamente por el RCV.
  let sincronizacion: ResultadoSincronizacion;
  try {
    sincronizacion = await syncSiiCompanyPeriod(
      userId,
      {
        companyId: entrada.companyId,
        periodo: entrada.periodo,
        triggerType: "manual",
      },
      {
        proveedor,
        proveedorId: "api_gateway",
        registro,
        omitirPoliticaCache: true,
      },
    );
  } catch (error) {
    const codigo = error instanceof SiiProviderError ? error.code : "INTERNAL";
    const mensaje =
      error instanceof SiiProviderError
        ? error.message
        : "No pudimos completar la consulta con el proveedor real.";
    await supabaseAdmin
      .from("tax_sii_connections")
      .update({
        status: "error",
        last_attempt_at: new Date().toISOString(),
        last_error_code: codigo,
        last_error_message: mensaje,
      })
      .eq("company_id", entrada.companyId)
      .eq("provider", "api_gateway");
    await registrarActividad(
      entrada.companyId,
      userId,
      "sii.real_test_failed",
      "tax_sii_connections",
      { codigo, ...consumo() },
    );
    return {
      conexion: null,
      sincronizacion: null,
      ...consumo(),
      f29: {
        estado: "omitido",
        mensaje: "No se revisó el Formulario 29 en esta actualización.",
        codigo: null,
        folio: null,
        recalculado: false,
      },
      mensaje,
      errorCodigo: codigo,
    };
  }

  const exito = sincronizacion.estado !== "failed";
  if (exito) {
    await supabaseAdmin
      .from("tax_sii_connections")
      .update({ status: "connected", last_error_code: null, last_error_message: null })
      .eq("company_id", entrada.companyId)
      .eq("provider", "api_gateway");
  }

  // 4. Formulario 29 oficial del mismo periodo: ocurre solo, sin pasos extra
  //    para la persona. Si el periodo aún no tiene declaración, simplemente se
  //    mantiene la estimación del RCV. Nunca interrumpe la actualización ni
  //    borra las ventas y compras ya guardadas.
  let f29: ResultadoF29Automatico = {
    estado: "omitido",
    mensaje: "No se revisó el Formulario 29 en esta actualización.",
    codigo: null,
    folio: null,
    recalculado: false,
  };
  if (exito) {
    try {
      const { extraerF29Compacto } = await import("@/lib/f29PdfExtraction.server");
      const r = await extraerF29Compacto(userId, {
        companyId: entrada.companyId,
        periodo: entrada.periodo,
        rutUsuario,
        claveTributaria: entrada.claveTributaria,
        consentimiento: true,
      });
      f29 = {
        estado: r.errorCodigo === "F29_NOT_DECLARED"
          ? "no_declarado"
          : r.errorCodigo
            ? "revisar"
            : "leido",
        mensaje: r.errorCodigo
          ? `${r.mensaje} Tus ventas y compras sí quedaron actualizadas.`
          : "Leímos el Formulario 29 oficial de este periodo.",
        codigo: r.errorCodigo ?? null,
        folio: r.extraccion?.folio ?? null,
        recalculado: r.recalculado,
      };
    } catch (error) {
      const codigoF29 =
        error && typeof error === "object" && "codigo" in error
          ? String((error as { codigo: unknown }).codigo)
          : error instanceof SiiProviderError
            ? error.code
            : "F29_UNKNOWN_ERROR";
      f29 = {
        estado: codigoF29 === "F29_NOT_DECLARED" ? "no_declarado" : "revisar",
        mensaje:
          error instanceof Error && error.name === "ErrorF29"
            ? `${error.message} Tus ventas y compras sí quedaron actualizadas.`
            : "Las ventas y compras fueron actualizadas, pero no pudimos leer el Formulario 29.",
        codigo: codigoF29,
        folio: null,
        recalculado: false,
      };
    }
  }


  await registrarActividad(
    entrada.companyId,
    userId,
    exito ? "sii.connected_real" : "sii.real_test_failed",
    "tax_sii_connections",
    {
      proveedor: "api_gateway",
      periodo: entrada.periodo,
      estado: sincronizacion.estado,
      f29: f29.estado,
      f29_codigo: f29.codigo,
      ...consumo(),
    },

  );


  return {
    conexion: {
      id: String(filaConexion.id),
      proveedor: "api_gateway",
      simulado: false,
      // Primera conexión: éxito -> connected; parcial -> stale; falla -> error.
      estado:
        sincronizacion.estado === "failed"
          ? "error"
          : sincronizacion.estado === "success"
            ? "connected"
            : "stale",

      rutAutorizado: conexionProveedor.authorizedRut,
      conectadaEn: conexionProveedor.connectedAt,
      expiraEn: conexionProveedor.sessionExpiresAt,
      ultimaSincronizacionExitosa: sincronizacion.ultimaSincronizacion,
      ultimoIntento: ahora,
      ultimoErrorCodigo: sincronizacion.errorCodigo,
      ultimoErrorMensaje: null,
    },
    sincronizacion,
    ...consumo(),
    f29,
    mensaje: sincronizacion.mensaje,
    errorCodigo: sincronizacion.errorCodigo,
  };
}


/** Corta la conexión real y borra la referencia guardada. */
export async function desconectarPruebaReal(
  userId: string,
  companyId: string,
): Promise<void> {
  await exigirRol(userId, companyId, ["owner"]);
  await supabaseAdmin
    .from("tax_sii_connections")
    .update({
      status: "disconnected",
      disconnected_at: new Date().toISOString(),
      session_expires_at: null,
      provider_connection_ref: null,
    })
    .eq("company_id", companyId)
    .eq("provider", "api_gateway");
  await registrarActividad(
    companyId,
    userId,
    "sii.disconnected_real",
    "tax_sii_connections",
  );
}
