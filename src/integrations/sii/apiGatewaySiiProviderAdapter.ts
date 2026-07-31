/**
 * Adaptador real de API Gateway V2.
 *
 * Implementa la MISMA interfaz `SiiProviderAdapter` que el adaptador simulado:
 * el resto de la aplicación (motor tributario, normalización, caché,
 * deduplicación, pantallas) no cambia.
 *
 * Solo se usan recursos presentes en el esquema OpenAPI oficial
 * (`apiGatewayResourceMap.ts`). Un recurso no documentado no se implementa por
 * aproximación: se informa como no disponible.
 *
 * Credenciales: en esta etapa API Gateway exige RUT + Clave Tributaria en cada
 * recurso (`{"auth":{"pass":{"rut","clave"}}}`). No existe una sesión
 * reutilizable, por lo que las credenciales viven solo en memoria durante la
 * operación en curso y nunca se guardan, registran ni devuelven.
 */
import {
  SiiProviderError,
  type ProviderConnection,
  type ProviderDocument,
  type ProviderDocumentType,
  type ProviderF29Entry,
  type ProviderModuleDiagnostics,
  type ProviderPurchasesResult,
  type ProviderQuery,
  type ProviderRcvSummary,
  type ProviderSalesResult,
  type ProviderWithholdingsResult,
  type SiiModule,
  type SiiProviderAdapter,
} from "./contracts";
import {
  ESTADOS_RCV_COMPRAS,
  RECURSO_RESUMEN_COMPRAS,
  recursoDe,
} from "./apiGatewayResourceMap";
import {
  requestApiGateway,
  RegistroConsumo,
  type ApiGatewayCallLog,
  type ApiGatewayConfig,
} from "./apiGatewayClient";
import { unwrapProviderCollection } from "./unwrapProviderCollection";
import {
  aNumero,
  construirResumenRcv,
  DTE_EFECTO_NEGATIVO,
  RESUMEN_VACIO,
  tiposConDocumentos,
  type FilaResumenRcv,
} from "./rcvSummary";
import { rutConGuion } from "@/lib/rut";


export interface CredencialesTemporales {
  /** RUT de la empresa consultada (emisor/receptor en el RCV). */
  rutEmpresa: string;
  /** RUT del usuario autorizado ante el SII. */
  rutUsuario: string;
  /** Clave Tributaria. Solo en memoria, solo durante esta operación. */
  claveTributaria: string;
}

interface CuerpoAuth {
  auth: { pass: { rut: string; clave: string } };
}

/**
 * Construye el cuerpo de autenticación exigido por API Gateway.
 * Sin envoltorios adicionales (`credentials`, `authorizedRut`, `taxKey`, etc.).
 */
export function construirCuerpoAuth(
  rutUsuarioAutorizado: string,
  claveTributaria: string,
): CuerpoAuth {
  return {
    auth: {
      pass: { rut: rutConGuion(rutUsuarioAutorizado), clave: claveTributaria },
    },
  };
}


interface FilaDetalle {
  detTipoDoc?: number | string;
  detNroDoc?: number | string;
  detFchDoc?: string;
  detRutDoc?: number | string;
  detDvDoc?: string;
  detRznSoc?: string;
  detMntNeto?: number | string;
  detMntIVA?: number | string;
  detMntExe?: number | string;
  detMntTotal?: number | string;
}

interface FilaF29 {
  periodo?: number | string;
  folio?: string | number;
  fecha?: string;
  estado?: string;
}

/** Códigos de DTE reconocidos. Un código desconocido se descarta, no se infiere. */
const TIPOS_DTE: Record<number, ProviderDocumentType> = {
  30: "factura",
  32: "factura",
  33: "factura",
  34: "factura",
  35: "boleta",
  38: "boleta",
  39: "boleta",
  41: "boleta",
  43: "factura",
  45: "factura",
  46: "factura",
  48: "factura",
  55: "notaDebito",
  56: "notaDebito",
  60: "notaCredito",
  61: "notaCredito",
  110: "factura",
  111: "notaDebito",
  112: "notaCredito",
};

function periodoCompacto(periodo: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!m) throw new SiiProviderError("PERIOD_NOT_AVAILABLE", null);
  return `${m[1]}${m[2]}`;
}

function fechaIso(valor: string | undefined): string | null {
  if (!valor) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(valor.trim());
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor.trim());
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

function rutContraparte(fila: FilaDetalle): string {
  if (fila.detRutDoc == null || fila.detRutDoc === "") return "";
  return `${fila.detRutDoc}-${(fila.detDvDoc ?? "").toString().trim().toUpperCase()}`;
}

function montoOpcional(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  return aNumero(valor);
}

/**
 * Convierte una fila del DETALLE en un documento del contrato interno.
 * Devuelve `null` solo cuando la fila no trae los tres datos mínimos: tipo de
 * DTE reconocido, fecha y folio.
 */
export function aDocumento(
  fila: FilaDetalle,
  direccion: "sale" | "purchase",
  estado: ProviderDocument["rcvStatus"],
): ProviderDocument | null {
  const codigo = fila.detTipoDoc == null ? 0 : Math.round(aNumero(fila.detTipoDoc));
  const tipo = TIPOS_DTE[codigo];
  const fecha = fechaIso(fila.detFchDoc);
  const folio = fila.detNroDoc == null ? 0 : Math.round(aNumero(fila.detNroDoc));
  if (!tipo || !fecha || !folio) return null;

  const rut = rutContraparte(fila);
  return {
    externalId: `apigw:${direccion}:${codigo}:${folio}:${rut || "sn"}`,
    documentType: tipo,
    folio,
    issueDate: fecha,
    counterpartyName: (fila.detRznSoc ?? "").trim() || "Sin identificar",
    counterpartyRut: rut,
    netAmount: montoOpcional(fila.detMntNeto),
    vatAmount: montoOpcional(fila.detMntIVA),
    exemptAmount: montoOpcional(fila.detMntExe),
    totalAmount: aNumero(fila.detMntTotal),
    rcvStatus: estado,
    // Los montos del SII llegan positivos: el signo es un efecto, no un dato.
    taxEffect: DTE_EFECTO_NEGATIVO.has(codigo) ? -1 : 1,
  };
}

export interface OpcionesAdaptadorReal {
  config: ApiGatewayConfig;
  credenciales: CredencialesTemporales;
  registro: RegistroConsumo;
  /** Tope de tipos de documento a consultar por módulo. Protege los créditos. */
  maxTiposPorModulo?: number;
  /**
   * Fuerza una sesión nueva en el proveedor (`auth_cache=0`) SOLO en la primera
   * consulta de la ejecución. Nunca queda activado de forma permanente.
   */
  sesionNueva?: boolean;
  /**
   * Modo económico (el de la actualización normal): se leen únicamente los
   * RESÚMENES oficiales del RCV. No se descarga el detalle documento por
   * documento ni se consultan los estados secundarios de compras, porque la
   * pantalla no los usa y sus cifras ya vienen en el resumen.
   * El detalle sigue existiendo como capacidad técnica interna.
   */
  soloResumen?: boolean;
  /** Estados de compras a consultar. Por omisión, los del flujo normal. */
  estadosCompras?: readonly string[];
}

/**
 * Crea un adaptador real ligado a unas credenciales temporales.
 * No es un singleton: se descarta al terminar la operación.
 */
export function crearAdaptadorApiGateway(
  opciones: OpcionesAdaptadorReal,
): SiiProviderAdapter {
  const { config, credenciales, registro } = opciones;
  const maxTipos = opciones.maxTiposPorModulo ?? 6;
  const soloResumen = opciones.soloResumen === true;
  const estadosPermitidos: readonly string[] =
    opciones.estadosCompras ?? Object.values(ESTADOS_RCV_COMPRAS);
  /** Se consume en la primera solicitud y no se vuelve a aplicar. */
  let sinCacheAuthPendiente = opciones.sesionNueva === true;


  // Cuerpo EXACTO exigido por API Gateway: solo `auth.pass.rut` (el RUT del
  // usuario autorizado, sin puntos y con guion) y `auth.pass.clave`.
  // El RUT de la empresa jamás reemplaza al del usuario autorizado.
  const cuerpo: CuerpoAuth = construirCuerpoAuth(
    credenciales.rutUsuario,
    credenciales.claveTributaria,
  );


  async function pedir<T>(
    modulo: SiiModule | "autenticacion",
    ruta: string,
    query?: Record<string, string>,
  ): Promise<{ datos: T; log: ApiGatewayCallLog }> {
    const sinCacheAuth = sinCacheAuthPendiente;
    sinCacheAuthPendiente = false;
    return requestApiGateway<CuerpoAuth, T>({
      config,
      modulo,
      metodo: "POST",
      ruta,
      query,
      body: cuerpo,
      registro,
      sinCacheAuth,
    });
  }

  /**
   * Lee un RESUMEN del RCV. Alimenta los totales oficiales y decide qué tipos
   * de DTE vale la pena pedir en el detalle.
   */
  async function leerResumen(
    modulo: SiiModule,
    ruta: string,
    diagnostics: ProviderModuleDiagnostics[],
  ): Promise<ProviderRcvSummary> {
    const { datos, log } = await pedir<unknown>(modulo, ruta, { formato: "json" });
    const coleccion = unwrapProviderCollection<FilaResumenRcv>(datos, modulo);
    const resumen = construirResumenRcv(coleccion.items);
    diagnostics.push({
      modulo,
      recurso: `${ruta.split("/").slice(0, 4).join("/")}/resumen`,
      estadoHttp: log.estadoHttp,
      contentType: log.contentType,
      forma: coleccion.forma,
      clavesSuperiores: coleccion.clavesSuperiores,
      largoArreglo: coleccion.items.length,
      propiedadesPrimerElemento: coleccion.propiedadesPrimerElemento,
      filasNoInterpretadas: coleccion.items.length - resumen.lines.length,
    });
    return resumen;
  }

  /**
   * Lee el DETALLE de un tipo de DTE.
   *
   * `tipo=rcv` se envía siempre de forma explícita: el valor por omisión del
   * proveedor (`rcv_csv`) devuelve las columnas del archivo CSV del SII, que no
   * tienen los campos `det*` y hacían que todas las filas se descartaran.
   *
   * Si la respuesta trae filas y NINGUNA se puede interpretar, se informa
   * `INVALID_PROVIDER_RESPONSE`: nunca se devuelve una lista vacía en silencio.
   */
  async function detallesPorTipo(
    modulo: SiiModule,
    tipos: number[],
    ruta: (dte: number) => string,
    direccion: "sale" | "purchase",
    estado: ProviderDocument["rcvStatus"],
    diagnostics: ProviderModuleDiagnostics[],
  ): Promise<ProviderDocument[]> {
    const documentos: ProviderDocument[] = [];
    let filasTotales = 0;
    let filasNoInterpretadas = 0;

    for (const dte of tipos.slice(0, maxTipos)) {
      const recurso = ruta(dte);
      const { datos, log } = await pedir<unknown>(modulo, recurso, {
        formato: "json",
        tipo: "rcv",
      });
      const coleccion = unwrapProviderCollection<FilaDetalle>(datos, modulo);
      let interpretadas = 0;
      for (const fila of coleccion.items) {
        const doc = aDocumento(fila, direccion, estado);
        if (doc) {
          documentos.push(doc);
          interpretadas += 1;
        }
      }
      filasTotales += coleccion.items.length;
      filasNoInterpretadas += coleccion.items.length - interpretadas;
      diagnostics.push({
        modulo,
        recurso: `detalle/dte-${dte}`,
        estadoHttp: log.estadoHttp,
        contentType: log.contentType,
        forma: coleccion.forma,
        clavesSuperiores: coleccion.clavesSuperiores,
        largoArreglo: coleccion.items.length,
        propiedadesPrimerElemento: coleccion.propiedadesPrimerElemento,
        filasNoInterpretadas: coleccion.items.length - interpretadas,
      });
    }

    if (filasTotales > 0 && filasNoInterpretadas === filasTotales)
      throw new SiiProviderError("INVALID_PROVIDER_RESPONSE", modulo);

    return documentos;
  }

  return {
    id: "api_gateway",
    esSimulado: false,

    /**
     * NO hay validación previa contra `misii/contribuyente/datos`: ese recurso
     * fue retirado del flujo real porque devolvía HTTP 400 y bloqueaba el RCV
     * sin aportar nada al MVP. La primera consulta real es el resumen de
     * ventas del RCV, y es ella la que confirma si las credenciales sirven.
     * Aquí solo se prepara una referencia local, sin gastar créditos.
     */
    async connectCompany({ rut }): Promise<ProviderConnection> {
      const ahora = new Date();
      return {
        // Referencia no sensible: no contiene clave ni token.
        providerConnectionRef: `apigw:${rut}:${ahora.getTime()}`,
        authorizedRut: credenciales.rutUsuario,
        authMethod: "tax_key",
        connectedAt: ahora.toISOString(),
        // El proveedor exige credenciales en cada consulta: la "sesión" solo
        // dura la operación en curso.
        sessionExpiresAt: new Date(ahora.getTime() + 15 * 60_000).toISOString(),
      };
    },

    /** Sin sesión reutilizable: no se consulta nada ni se consumen créditos. */
    async authenticateCompany() {
      return {
        sessionExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      };
    },

    /** No existe recurso oficial para cerrar sesión: se descartan las credenciales. */
    async disconnectCompany() {
      return;
    },

    async fetchSalesRcv(query: ProviderQuery): Promise<ProviderSalesResult> {
      const periodo = periodoCompacto(query.period);
      const emisor = rutConGuion(query.rut);
      const diagnostics: ProviderModuleDiagnostics[] = [];

      const resumenRecurso = recursoDe("rcv_sales_summary");
      const detalleRecurso = recursoDe("rcv_sales_documents");

      const resumen = await leerResumen(
        "rcv_sales_summary",
        resumenRecurso.path.replace("{emisor}", emisor).replace("{periodo}", periodo),
        diagnostics,
      );

      // El detalle se pide SOLO por los tipos que el resumen declara con
      // documentos: no se depende de una consulta genérica DTE 0.
      const documentos = await detallesPorTipo(
        "rcv_sales_documents",
        tiposConDocumentos(resumen),
        (dte) =>
          detalleRecurso.path
            .replace("{emisor}", emisor)
            .replace("{periodo}", periodo)
            .replace("{dte}", String(dte)),
        "sale",
        "registered",
        diagnostics,
      );

      return {
        period: query.period,
        dataThroughDate: new Date().toISOString().slice(0, 10),
        documents: documentos,
        // Los totales provienen del resumen oficial, no de sumar el detalle.
        summary: {
          documentCount: resumen.documentCount,
          totalAmount: resumen.totalAmount,
          exemptAmount: resumen.exemptAmount,
        },
        rcvSummary: resumen,
        diagnostics,
      };
    },

    async fetchPurchasesRcv(query: ProviderQuery): Promise<ProviderPurchasesResult> {
      const periodo = periodoCompacto(query.period);
      const receptor = rutConGuion(query.rut);
      const diagnostics: ProviderModuleDiagnostics[] = [];
      const byStatus: ProviderPurchasesResult["byStatus"] = {
        registered: [],
        pending: [],
        claimed: [],
        excluded: [],
      };
      const rcvSummaryByStatus: NonNullable<
        ProviderPurchasesResult["rcvSummaryByStatus"]
      > = {
        registered: RESUMEN_VACIO,
        pending: RESUMEN_VACIO,
        claimed: RESUMEN_VACIO,
        excluded: RESUMEN_VACIO,
      };

      const equivalencias: Array<{
        modulo: keyof typeof ESTADOS_RCV_COMPRAS;
        clave: keyof ProviderPurchasesResult["byStatus"];
        estadoDoc: ProviderDocument["rcvStatus"];
      }> = [
        { modulo: "rcv_purchases_registered", clave: "registered", estadoDoc: "registered" },
        { modulo: "rcv_purchases_pending", clave: "pending", estadoDoc: "pending" },
        { modulo: "rcv_purchases_claimed", clave: "claimed", estadoDoc: "claimed" },
        { modulo: "rcv_purchases_excluded", clave: "excluded", estadoDoc: "excluded" },
      ];

      for (const eq of equivalencias) {
        const estado = ESTADOS_RCV_COMPRAS[eq.modulo];
        const resumen = await leerResumen(
          eq.modulo,
          RECURSO_RESUMEN_COMPRAS.path
            .replace("{receptor}", receptor)
            .replace("{periodo}", periodo)
            .replace("{estado}", estado),
          diagnostics,
        );
        rcvSummaryByStatus[eq.clave] = resumen;

        const detalleRecurso = recursoDe(eq.modulo);
        // Sin documentos informados no se consulta el detalle: no se gastan
        // créditos en una respuesta que ya sabemos vacía.
        byStatus[eq.clave] = await detallesPorTipo(
          eq.modulo,
          tiposConDocumentos(resumen),
          (dte) =>
            detalleRecurso.path
              .replace("{receptor}", receptor)
              .replace("{periodo}", periodo)
              .replace("{dte}", String(dte))
              .replace("{estado}", estado),
          "purchase",
          eq.estadoDoc,
          diagnostics,
        );
      }

      return {
        period: query.period,
        dataThroughDate: new Date().toISOString().slice(0, 10),
        byStatus,
        rcvSummaryByStatus,
        diagnostics,
      };
    },

    /**
     * Listado oficial de declaraciones por período. El detalle estructurado
     * (remanente, PPM, retenciones) NO está documentado: esos campos quedan
     * nulos en vez de inventarse.
     */
    async fetchF29History(
      query: ProviderQuery & { months: number },
    ): Promise<ProviderF29Entry[]> {
      const recurso = recursoDe("f29_periods");
      const anio = query.period.slice(0, 4);
      const { datos } = await pedir<unknown>(
        "f29_periods",
        recurso.path.replace("{periodo}", anio),
      );

      const filas = unwrapProviderCollection<FilaF29>(datos, "f29_periods").items;
      const entradas: ProviderF29Entry[] = [];
      for (const fila of filas) {
        const crudo = String(fila.periodo ?? "");
        const m = /^(\d{4})(\d{2})$/.exec(crudo);
        if (!m) continue;
        const declarado = /vigente|declarad/i.test(String(fila.estado ?? ""));
        entradas.push({
          period: `${m[1]}-${m[2]}`,
          status: declarado ? "filed" : "pending",
          declaredVat: null,
          declaredPpm: null,
          declaredWithholdings: null,
          declaredTotal: null,
          vatCarryforward: null,
          filedAt: fechaIso(fila.fecha),
        });
      }

      return entradas
        .sort((a, b) => b.period.localeCompare(a.period))
        .slice(0, Math.max(1, query.months));
    },

    /** No existe recurso oficial de retenciones en el esquema V2. */
    async fetchWithholdings(): Promise<ProviderWithholdingsResult> {
      throw new SiiProviderError("RESOURCE_NOT_DOCUMENTED", "withholdings");
    },
  };
}

/**
 * Adaptador sin credenciales. Existe para que `resolverProveedor("api_gateway")`
 * siga siendo válido: sin credenciales temporales no se puede consultar nada.
 */
export const apiGatewaySiiProviderAdapter: SiiProviderAdapter = {
  id: "api_gateway",
  esSimulado: false,
  async connectCompany() {
    throw new SiiProviderError("PROVIDER_NOT_CONFIGURED", null);
  },
  async authenticateCompany() {
    throw new SiiProviderError("PROVIDER_NOT_CONFIGURED", null);
  },
  async disconnectCompany() {
    return;
  },
  async fetchSalesRcv() {
    throw new SiiProviderError("PROVIDER_NOT_CONFIGURED", null);
  },
  async fetchPurchasesRcv() {
    throw new SiiProviderError("PROVIDER_NOT_CONFIGURED", null);
  },
  async fetchF29History() {
    throw new SiiProviderError("PROVIDER_NOT_CONFIGURED", null);
  },
  async fetchWithholdings() {
    throw new SiiProviderError("PROVIDER_NOT_CONFIGURED", null);
  },
};
