/**
 * Proveedor SII simulado.
 *
 * Genera información ficticia de forma determinista a partir del RUT y del
 * periodo: la misma empresa y el mismo mes siempre devuelven exactamente los
 * mismos documentos. No realiza llamadas de red ni usa credenciales reales.
 */
import {
  SiiProviderError,
  type ProviderConnection,
  type ProviderDocument,
  type ProviderF29Entry,
  type ProviderPurchasesResult,
  type ProviderQuery,
  type ProviderSalesResult,
  type ProviderWithholdingsResult,
  type SiiAuthMethod,
  type SiiProviderAdapter,
} from "./contracts";

/** Los ocho casos deterministas que debe poder reproducir la demostración. */
export type EscenarioProveedor =
  | "normal"
  | "sinMovimientos"
  | "remanente"
  | "ventasAltas"
  | "comprasPendientes"
  | "documentosIncompletos"
  | "f29Incompleto"
  | "proveedorCaido";

export const ESCENARIOS_PROVEEDOR: EscenarioProveedor[] = [
  "normal",
  "sinMovimientos",
  "remanente",
  "ventasAltas",
  "comprasPendientes",
  "documentosIncompletos",
  "f29Incompleto",
  "proveedorCaido",
];

const TASA_IVA = 0.19;

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Generador pseudoaleatorio determinista (mulberry32). */
function generador(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** El escenario queda fijado por el RUT: nunca cambia entre sincronizaciones. */
export function escenarioDeRut(rut: string): EscenarioProveedor {
  return ESCENARIOS_PROVEEDOR[hash(rut) % ESCENARIOS_PROVEEDOR.length];
}

const CLIENTES = [
  ["Comercial Los Aromos SpA", "76.412.980-1"],
  ["Distribuidora Vega Central Ltda.", "77.203.114-5"],
  ["Panadería Santa Elena EIRL", "76.998.220-9"],
  ["Servicios Andes SpA", "77.554.301-K"],
  ["Almacén El Roble Ltda.", "76.120.443-2"],
  ["Consultora Maipo SpA", "77.881.507-3"],
];

const PROVEEDORES = [
  ["Mayorista Central del Sur SpA", "76.330.221-4"],
  ["Insumos y Envases Bío Bío Ltda.", "77.410.882-6"],
  ["Energía y Servicios Cordillera SpA", "76.775.190-8"],
  ["Transportes Ruta 5 Ltda.", "77.019.663-1"],
  ["Suministros Pacífico SpA", "76.640.775-7"],
];

function diasDelMes(periodo: string): number {
  const [anio, mes] = periodo.split("-").map(Number);
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** Último día con información disponible: hoy si el periodo está en curso. */
function fechaCorte(periodo: string): string {
  const [anio, mes] = periodo.split("-").map(Number);
  const total = diasDelMes(periodo);
  const hoy = new Date();
  const esActual = hoy.getUTCFullYear() === anio && hoy.getUTCMonth() + 1 === mes;
  const dia = esActual ? Math.min(hoy.getUTCDate(), total) : total;
  return `${periodo}-${String(dia).padStart(2, "0")}`;
}

function redondear(valor: number): number {
  return Math.round(valor);
}

function documentoVenta(
  periodo: string,
  indice: number,
  rnd: () => number,
  escenario: EscenarioProveedor,
  diaMax: number,
): ProviderDocument {
  const [cliente, rut] = CLIENTES[Math.floor(rnd() * CLIENTES.length)];
  const dia = 1 + Math.floor(rnd() * diaMax);
  const esBoleta = rnd() < 0.55;
  const base = escenario === "ventasAltas" ? 380000 : 120000;
  const neto = redondear(base + rnd() * base * 2.2);
  const exento = rnd() < 0.08 ? redondear(neto * 0.2) : 0;
  const iva = redondear(neto * TASA_IVA);
  const sinDesglose = escenario === "documentosIncompletos" && indice % 3 === 0;
  return {
    externalId: `mock-sale-${periodo}-${indice}`,
    documentType: esBoleta ? "boleta" : "factura",
    folio: 1000 + indice,
    issueDate: `${periodo}-${String(dia).padStart(2, "0")}`,
    counterpartyName: cliente,
    counterpartyRut: rut,
    netAmount: sinDesglose ? null : neto,
    vatAmount: sinDesglose ? null : iva,
    exemptAmount: sinDesglose ? null : exento,
    totalAmount: neto + iva + exento,
    rcvStatus: "accepted",
  };
}

function documentoCompra(
  periodo: string,
  indice: number,
  rnd: () => number,
  estado: ProviderDocument["rcvStatus"],
  escenario: EscenarioProveedor,
  diaMax: number,
): ProviderDocument {
  const [proveedor, rut] = PROVEEDORES[Math.floor(rnd() * PROVEEDORES.length)];
  const dia = 1 + Math.floor(rnd() * diaMax);
  const base = escenario === "remanente" ? 520000 : 95000;
  const neto = redondear(base + rnd() * base * 1.8);
  const iva = redondear(neto * TASA_IVA);
  return {
    externalId: `mock-purchase-${periodo}-${estado}-${indice}`,
    documentType: "factura",
    folio: 5000 + indice,
    issueDate: `${periodo}-${String(dia).padStart(2, "0")}`,
    counterpartyName: proveedor,
    counterpartyRut: rut,
    netAmount: neto,
    vatAmount: iva,
    exemptAmount: 0,
    totalAmount: neto + iva,
    rcvStatus: estado,
  };
}

interface CantidadesEscenario {
  ventas: number;
  registradas: number;
  pendientes: number;
  reclamadas: number;
  excluidas: number;
}

function cantidades(escenario: EscenarioProveedor): CantidadesEscenario {
  switch (escenario) {
    case "sinMovimientos":
      return { ventas: 0, registradas: 0, pendientes: 0, reclamadas: 0, excluidas: 0 };
    case "remanente":
      return { ventas: 6, registradas: 14, pendientes: 2, reclamadas: 0, excluidas: 1 };
    case "ventasAltas":
      return { ventas: 26, registradas: 6, pendientes: 1, reclamadas: 0, excluidas: 0 };
    case "comprasPendientes":
      return { ventas: 12, registradas: 4, pendientes: 9, reclamadas: 3, excluidas: 2 };
    case "documentosIncompletos":
      return { ventas: 14, registradas: 7, pendientes: 2, reclamadas: 1, excluidas: 0 };
    case "f29Incompleto":
      return { ventas: 11, registradas: 6, pendientes: 1, reclamadas: 0, excluidas: 0 };
    default:
      return { ventas: 15, registradas: 8, pendientes: 3, reclamadas: 1, excluidas: 1 };
  }
}

function periodoPrevio(periodo: string, atras: number): string {
  const [anio, mes] = periodo.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1 - atras, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface OpcionesMockProveedor {
  /** Fuerza un escenario. Si se omite, se deriva del RUT de la empresa. */
  escenario?: EscenarioProveedor;
}

export function crearMockSiiProviderAdapter(
  opciones: OpcionesMockProveedor = {},
): SiiProviderAdapter {
  const resolverEscenario = (rut: string): EscenarioProveedor =>
    opciones.escenario ?? escenarioDeRut(rut);

  const exigirDisponibilidad = (rut: string) => {
    if (resolverEscenario(rut) === "proveedorCaido")
      throw new SiiProviderError("PROVIDER_UNAVAILABLE", null);
  };

  return {
    id: "mock",
    esSimulado: true,

    async connectCompany({ rut, authMethod }: { rut: string; authMethod: SiiAuthMethod }) {
      const ahora = new Date();
      const conexion: ProviderConnection = {
        providerConnectionRef: `mock-conn-${hash(rut).toString(16)}`,
        authorizedRut: rut,
        authMethod,
        connectedAt: ahora.toISOString(),
        sessionExpiresAt: new Date(ahora.getTime() + 30 * 86400000).toISOString(),
      };
      return conexion;
    },

    async authenticateCompany() {
      return {
        sessionExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      };
    },

    async disconnectCompany() {
      /* El proveedor simulado no mantiene estado remoto. */
    },

    async fetchSalesRcv({ rut, period }: ProviderQuery): Promise<ProviderSalesResult> {
      exigirDisponibilidad(rut);
      const escenario = resolverEscenario(rut);
      const rnd = generador(hash(`${rut}|${period}|sales`));
      const corte = fechaCorte(period);
      const diaMax = Number(corte.slice(8));
      const total = cantidades(escenario).ventas;
      const documents = Array.from({ length: total }, (_, i) =>
        documentoVenta(period, i, rnd, escenario, diaMax),
      ).sort((a, b) => a.issueDate.localeCompare(b.issueDate));

      return {
        period,
        dataThroughDate: corte,
        documents,
        summary: {
          documentCount: documents.length,
          totalAmount: documents.reduce((s, d) => s + d.totalAmount, 0),
          exemptAmount: documents.reduce((s, d) => s + (d.exemptAmount ?? 0), 0),
        },
      };
    },

    async fetchPurchasesRcv({ rut, period }: ProviderQuery): Promise<ProviderPurchasesResult> {
      exigirDisponibilidad(rut);
      const escenario = resolverEscenario(rut);
      const corte = fechaCorte(period);
      const diaMax = Number(corte.slice(8));
      const c = cantidades(escenario);
      const construir = (
        estado: "registered" | "pending" | "claimed" | "excluded",
        cantidad: number,
      ) => {
        const rnd = generador(hash(`${rut}|${period}|${estado}`));
        return Array.from({ length: cantidad }, (_, i) =>
          documentoCompra(period, i, rnd, estado, escenario, diaMax),
        ).sort((a, b) => a.issueDate.localeCompare(b.issueDate));
      };

      return {
        period,
        dataThroughDate: corte,
        byStatus: {
          registered: construir("registered", c.registradas),
          pending: construir("pending", c.pendientes),
          claimed: construir("claimed", c.reclamadas),
          excluded: construir("excluded", c.excluidas),
        },
      };
    },

    async fetchF29History({
      rut,
      period,
      months,
    }: ProviderQuery & { months: number }): Promise<ProviderF29Entry[]> {
      exigirDisponibilidad(rut);
      const escenario = resolverEscenario(rut);
      const entradas: ProviderF29Entry[] = [];
      for (let i = 0; i < months; i += 1) {
        const p = periodoPrevio(period, i);
        if (i === 0) {
          entradas.push({
            period: p,
            status: "not_available",
            declaredVat: null,
            declaredPpm: null,
            declaredWithholdings: null,
            declaredTotal: null,
            vatCarryforward: null,
            filedAt: null,
          });
          continue;
        }
        // Escenario con historial parcial: faltan declaraciones intermedias.
        if (escenario === "f29Incompleto" && i % 2 === 0) {
          entradas.push({
            period: p,
            status: "not_available",
            declaredVat: null,
            declaredPpm: null,
            declaredWithholdings: null,
            declaredTotal: null,
            vatCarryforward: null,
            filedAt: null,
          });
          continue;
        }
        const rnd = generador(hash(`${rut}|${p}|f29`));
        const iva =
          escenario === "remanente" ? 0 : redondear(180000 + rnd() * 900000);
        const ppm = redondear(40000 + rnd() * 160000);
        const ret = escenario === "sinMovimientos" ? 0 : redondear(rnd() * 90000);
        const remanente = escenario === "remanente" ? redondear(120000 + rnd() * 400000) : 0;
        entradas.push({
          period: p,
          status: "filed",
          declaredVat: iva,
          declaredPpm: ppm,
          declaredWithholdings: ret,
          declaredTotal: iva + ppm + ret,
          vatCarryforward: remanente,
          filedAt: `${p}-12T12:00:00.000Z`,
        });
      }
      return entradas;
    },

    async fetchWithholdings({ rut, period }: ProviderQuery): Promise<ProviderWithholdingsResult> {
      exigirDisponibilidad(rut);
      const escenario = resolverEscenario(rut);
      if (escenario === "sinMovimientos")
        return { period, totalAmount: 0, detail: [] };
      const rnd = generador(hash(`${rut}|${period}|withholdings`));
      const honorarios = redondear(rnd() * 220000);
      const segunda = redondear(rnd() * 60000);
      return {
        period,
        totalAmount: honorarios + segunda,
        detail: [
          { concept: "Retención sobre boletas de honorarios", amount: honorarios },
          { concept: "Otras retenciones informadas", amount: segunda },
        ],
      };
    },
  };
}

export const mockSiiProviderAdapter = crearMockSiiProviderAdapter();
