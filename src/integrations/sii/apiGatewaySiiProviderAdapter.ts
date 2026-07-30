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
  type ProviderPurchasesResult,
  type ProviderQuery,
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
  type ApiGatewayConfig,
} from "./apiGatewayClient";
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


interface FilaResumen {
  rsmnTipoDocInteger?: number;
  rsmnTotDoc?: number;
}

interface FilaDetalle {
  detTipoDoc?: number;
  detNroDoc?: number;
  detFchDoc?: string;
  detRutDoc?: number;
  detDvDoc?: string;
  detRznSoc?: string;
  detMntNeto?: number;
  detMntIVA?: number;
  detMntExe?: number;
  detMntTotal?: number;
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
  if (!fila.detRutDoc) return "";
  return `${fila.detRutDoc}-${(fila.detDvDoc ?? "").toString().trim().toUpperCase()}`;
}

function numero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function aDocumento(
  fila: FilaDetalle,
  direccion: "sale" | "purchase",
  estado: ProviderDocument["rcvStatus"],
): ProviderDocument | null {
  const tipo = fila.detTipoDoc ? TIPOS_DTE[fila.detTipoDoc] : undefined;
  const fecha = fechaIso(fila.detFchDoc);
  if (!tipo || !fecha || !fila.detNroDoc) return null;

  const rut = rutContraparte(fila);
  return {
    externalId: `apigw:${direccion}:${fila.detTipoDoc}:${fila.detNroDoc}:${rut || "sn"}`,
    documentType: tipo,
    folio: fila.detNroDoc,
    issueDate: fecha,
    counterpartyName: (fila.detRznSoc ?? "").trim() || "Sin identificar",
    counterpartyRut: rut,
    netAmount: numero(fila.detMntNeto),
    vatAmount: numero(fila.detMntIVA),
    exemptAmount: numero(fila.detMntExe),
    totalAmount: numero(fila.detMntTotal) ?? 0,
    rcvStatus: estado,
  };
}

function listaDatos<T>(cuerpo: unknown): T[] {
  if (!cuerpo || typeof cuerpo !== "object") return [];
  const raiz = (cuerpo as { data?: unknown }).data;
  if (Array.isArray(raiz)) return raiz as T[];
  if (raiz && typeof raiz === "object") {
    const anidado = (raiz as { data?: unknown }).data;
    if (Array.isArray(anidado)) return anidado as T[];
  }
  return [];
}

export interface OpcionesAdaptadorReal {
  config: ApiGatewayConfig;
  credenciales: CredencialesTemporales;
  registro: RegistroConsumo;
  /** Tope de tipos de documento a consultar por módulo. Protege los créditos. */
  maxTiposPorModulo?: number;
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
  ): Promise<T> {
    const { datos } = await requestApiGateway<CuerpoAuth, T>({
      config,
      modulo,
      metodo: "POST",
      ruta,
      query,
      body: cuerpo,
      registro,
    });
    return datos;
  }

  async function detallesPorTipo(
    modulo: SiiModule,
    tipos: number[],
    ruta: (dte: number) => string,
    direccion: "sale" | "purchase",
    estado: ProviderDocument["rcvStatus"],
  ): Promise<ProviderDocument[]> {
    const documentos: ProviderDocument[] = [];
    for (const dte of tipos.slice(0, maxTipos)) {
      const respuesta = await pedir<unknown>(modulo, ruta(dte), { formato: "json" });
      for (const fila of listaDatos<FilaDetalle>(respuesta)) {
        const doc = aDocumento(fila, direccion, estado);
        if (doc) documentos.push(doc);
      }
    }
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

      const resumenRecurso = recursoDe("rcv_sales_summary");
      const detalleRecurso = recursoDe("rcv_sales_documents");

      const resumen = await pedir<unknown>(
        "rcv_sales_summary",
        resumenRecurso.path.replace("{emisor}", emisor).replace("{periodo}", periodo),
        { formato: "json" },
      );
      const filas = listaDatos<FilaResumen>(resumen);
      const tipos = filas
        .filter((f) => (f.rsmnTotDoc ?? 0) > 0 && f.rsmnTipoDocInteger)
        .map((f) => f.rsmnTipoDocInteger as number);

      const documentos = await detallesPorTipo(
        "rcv_sales_documents",
        tipos,
        (dte) =>
          detalleRecurso.path
            .replace("{emisor}", emisor)
            .replace("{periodo}", periodo)
            .replace("{dte}", String(dte)),
        "sale",
        "registered",
      );

      return {
        period: query.period,
        dataThroughDate: new Date().toISOString().slice(0, 10),
        documents: documentos,
        summary: {
          documentCount: documentos.length,
          totalAmount: documentos.reduce((s, d) => s + (d.totalAmount || 0), 0),
          exemptAmount: documentos.reduce((s, d) => s + (d.exemptAmount ?? 0), 0),
        },
      };
    },

    async fetchPurchasesRcv(query: ProviderQuery): Promise<ProviderPurchasesResult> {
      const periodo = periodoCompacto(query.period);
      const receptor = query.rut;
      const byStatus: ProviderPurchasesResult["byStatus"] = {
        registered: [],
        pending: [],
        claimed: [],
        excluded: [],
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
        const resumen = await pedir<unknown>(
          eq.modulo,
          RECURSO_RESUMEN_COMPRAS.path
            .replace("{receptor}", receptor)
            .replace("{periodo}", periodo)
            .replace("{estado}", estado),
          { formato: "json" },
        );
        const tipos = listaDatos<FilaResumen>(resumen)
          .filter((f) => (f.rsmnTotDoc ?? 0) > 0 && f.rsmnTipoDocInteger)
          .map((f) => f.rsmnTipoDocInteger as number);

        const detalleRecurso = recursoDe(eq.modulo);
        byStatus[eq.clave] = await detallesPorTipo(
          eq.modulo,
          tipos,
          (dte) =>
            detalleRecurso.path
              .replace("{receptor}", receptor)
              .replace("{periodo}", periodo)
              .replace("{dte}", String(dte))
              .replace("{estado}", estado),
          "purchase",
          eq.estadoDoc,
        );
      }

      return {
        period: query.period,
        dataThroughDate: new Date().toISOString().slice(0, 10),
        byStatus,
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
      const respuesta = await pedir<unknown>(
        "f29_periods",
        recurso.path.replace("{periodo}", anio),
      );

      const filas = listaDatos<FilaF29>(respuesta);
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
