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
import {
  empresaAutorizadaParaPruebaReal,
  leerConfiguracion,
  modoPruebaRealHabilitado,
} from "@/lib/apiGateway.server";
import {
  ErrorNegocio,
  VERSION_CONSENTIMIENTO,
  exigirRol,
  registrarActividad,
  syncSiiCompanyPeriod,
  type ConexionSii,
  type ResultadoSincronizacion,
} from "@/lib/siiSync.server";

export interface EntradaPruebaReal {
  companyId: string;
  periodo: string;
  /** RUT del usuario autorizado ante el SII. */
  rutUsuario: string;
  /** Clave Tributaria. Solo en memoria. */
  claveTributaria: string;
  consentimiento: boolean;
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
}

/** Verificaciones previas comunes a toda operación real. */
async function exigirPruebaRealPermitida(userId: string, companyId: string) {
  await exigirRol(userId, companyId, ["owner"]);
  if (!modoPruebaRealHabilitado())
    throw new ErrorNegocio(
      "La prueba con el proveedor real no está habilitada en este ambiente.",
    );
  if (!empresaAutorizadaParaPruebaReal(companyId))
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
  const proveedor = crearAdaptadorApiGateway({ config, credenciales, registro });
  const ahora = new Date().toISOString();

  const consumo = () => ({
    consultas: registro.consultas,
    creditosConsumidos: Number(registro.creditosUsados.toFixed(4)),
    creditosDisponibles: registro.creditosDisponibles,
    proxyUsado: registro.proxyUsado,
  });

  // 1. Validar credenciales contra el proveedor real.
  let conexionProveedor;
  try {
    conexionProveedor = await proveedor.connectCompany({
      rut: credenciales.rutEmpresa,
      authMethod: "tax_key",
    });
  } catch (error) {
    const codigo = error instanceof SiiProviderError ? error.code : "INTERNAL";
    const mensaje =
      error instanceof SiiProviderError
        ? error.message
        : "No pudimos validar la conexión con el proveedor real.";
    await supabaseAdmin.from("tax_sii_connections").upsert(
      {
        company_id: entrada.companyId,
        provider: "api_gateway",
        status: "error",
        last_attempt_at: ahora,
        last_error_code: codigo,
        last_error_message: mensaje,
      },
      { onConflict: "company_id,provider" },
    );
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
      mensaje,
      errorCodigo: codigo,
    };
  }

  // 2. Registrar la conexión real. Nunca se guarda la clave.
  const { data: filaConexion, error: errorConexion } = await supabaseAdmin
    .from("tax_sii_connections")
    .upsert(
      {
        company_id: entrada.companyId,
        provider: "api_gateway",
        provider_connection_ref: conexionProveedor.providerConnectionRef,
        auth_method: "tax_key",
        status: "connected",
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
    "sii.connected_real",
    "tax_sii_connections",
    { proveedor: "api_gateway", version_consentimiento: VERSION_CONSENTIMIENTO },
  );

  // 3. Sincronizar el periodo con el mismo orquestador de siempre.
  const sincronizacion = await syncSiiCompanyPeriod(
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

  return {
    conexion: {
      id: String(filaConexion.id),
      proveedor: "api_gateway",
      simulado: false,
      estado: sincronizacion.estado === "failed" ? "stale" : "connected",
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
