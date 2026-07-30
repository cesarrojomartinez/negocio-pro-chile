/**
 * Proveedor SII simulado.
 *
 * Genera información ficticia de forma determinista a partir del RUT y del
 * periodo: la misma empresa y el mismo mes siempre devuelven exactamente los
 * mismos documentos. No realiza llamadas de red ni usa credenciales reales.
 *
 * La única variación admitida es `revision`: representa cuántas veces se ha
 * consultado el periodo. El RCV real cambia entre consultas (una compra
 * pendiente pasa a registrada), y la simulación reproduce ese avance sin
 * cambiar el identificador del documento.
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

/** Los ocho casos de datos deterministas de la demostración. */
export type EscenarioDatos =
  | "normal"
  | "sinMovimientos"
  | "remanente"
  | "ventasAltas"
  | "comprasPendientes"
  | "documentosIncompletos"
  | "f29Incompleto"
  | "proveedorCaido";

/** Casos de falla que solo se activan explícitamente en pruebas controladas. */
export type EscenarioFalla =
  | "credencialesInvalidas"
  | "sesionVencida"
  | "mantenimiento"
  | "datosParciales";

export type EscenarioProveedor = EscenarioDatos | EscenarioFalla;

export const ESCENARIOS_PROVEEDOR: EscenarioDatos[] = [
  "normal",
  "sinMovimientos",
  "remanente",
  "ventasAltas",
  "comprasPendientes",
  "documentosIncompletos",
  "f29Incompleto",
  "proveedorCaido",
];

export const ESCENARIOS_FALLA: EscenarioFalla[] = [
  "credencialesInvalidas",
  "sesionVencida",
  "mantenimiento",
  "datosParciales",
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
export function escenarioDeRut(rut: string): EscenarioDatos {
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
function fechaCorte(periodo: string, ahora: Date): string {
  const [anio, mes] = periodo.split("-").map(Number);
  const total = diasDelMes(periodo);
  const esActual = ahora.getUTCFullYear() === anio && ahora.getUTCMonth() + 1 === mes;
  const dia = esActual ? Math.min(ahora.getUTCDate(), total) : total;
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
  const base = escenario === "ventasAltas" ? 380000 : 120000;
  const neto = redondear(base + rnd() * base * 2.2);
  const iva = redondear(neto * TASA_IVA);
  const esBoleta = rnd() < 0.55;
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
    exemptAmount: sinDesglose ? null : 0,
    totalAmount: neto + iva,
    rcvStatus: "accepted",
  };
}

/**
 * Documentos especiales que siempre acompañan a un mes con movimiento:
 * una nota de crédito, una nota de débito y una venta exenta.
 * Permiten verificar que el motor ajusta el débito en ambos sentidos.
 */
function documentosEspeciales(periodo: string, diaMax: number): ProviderDocument[] {
  const dia = String(Math.min(20, diaMax)).padStart(2, "0");
  const [cliente, rut] = CLIENTES[0];
  return [
    {
      externalId: `mock-sale-${periodo}-nc`,
      documentType: "notaCredito",
      folio: 9001,
      issueDate: `${periodo}-${dia}`,
      counterpartyName: cliente,
      counterpartyRut: rut,
      netAmount: 100000,
      vatAmount: 19000,
      exemptAmount: 0,
      totalAmount: 119000,
      rcvStatus: "accepted",
    },
    {
      externalId: `mock-sale-${periodo}-nd`,
      documentType: "notaDebito",
      folio: 9002,
      issueDate: `${periodo}-${dia}`,
      counterpartyName: cliente,
      counterpartyRut: rut,
      netAmount: 50000,
      vatAmount: 9500,
      exemptAmount: 0,
      totalAmount: 59500,
      rcvStatus: "accepted",
    },
    {
      externalId: `mock-sale-${periodo}-ex`,
      documentType: "factura",
      folio: 9003,
      issueDate: `${periodo}-${dia}`,
      counterpartyName: CLIENTES[1][0],
      counterpartyRut: CLIENTES[1][1],
      netAmount: 0,
      vatAmount: 0,
      exemptAmount: 80000,
      totalAmount: 80000,
      rcvStatus: "accepted",
    },
  ];
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
    // El identificador NO incluye el estado: una compra que pasa de pendiente
    // a registrada sigue siendo el mismo documento.
    externalId: `mock-purchase-${periodo}-${indice}`,
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
  /** Reloj inyectable para pruebas controladas. */
  ahora?: () => Date;
}

export function crearMockSiiProviderAdapter(
  opciones: OpcionesMockProveedor = {},
): SiiProviderAdapter {
  const reloj = opciones.ahora ?? (() => new Date());
  const resolverEscenario = (rut: string): EscenarioProveedor =>
    opciones.escenario ?? escenarioDeRut(rut);

  /** Fallas que impiden seguir consultando módulos: exigen reconexión. */
  const exigirSesion = (rut: string) => {
    const escenario = resolverEscenario(rut);
    if (escenario === "sesionVencida") throw new SiiProviderError("AUTH_EXPIRED", null);
    if (escenario === "proveedorCaido" || escenario === "mantenimiento")
      throw new SiiProviderError("PROVIDER_UNAVAILABLE", null);
  };

  return {
    id: "mock",
    esSimulado: true,

    async connectCompany({ rut, authMethod }: { rut: string; authMethod: SiiAuthMethod }) {
      if (resolverEscenario(rut) === "credencialesInvalidas")
        throw new SiiProviderError("INVALID_CREDENTIALS", null);
      const ahora = reloj();
      const conexion: ProviderConnection = {
        providerConnectionRef: `mock-conn-${hash(rut).toString(16)}`,
        authorizedRut: rut,
        authMethod,
        connectedAt: ahora.toISOString(),
        sessionExpiresAt: new Date(ahora.getTime() + 30 * 86400000).toISOString(),
      };
      return conexion;
    },

    async authenticateCompany({ rut }: { rut: string; providerConnectionRef: string }) {
      exigirSesion(rut);
      return {
        sessionExpiresAt: new Date(reloj().getTime() + 30 * 86400000).toISOString(),
      };
    },

    async disconnectCompany() {
      /* El proveedor simulado no mantiene estado remoto. */
    },

    async fetchSalesRcv({ rut, period }: ProviderQuery): Promise<ProviderSalesResult> {
      exigirSesion(rut);
      const escenario = resolverEscenario(rut);
      const rnd = generador(hash(`${rut}|${period}|sales`));
      const corte = fechaCorte(period, reloj());
      const diaMax = Number(corte.slice(8));
      const total = cantidades(escenario).ventas;
      const documents = Array.from({ length: total }, (_, i) =>
        documentoVenta(period, i, rnd, escenario, diaMax),
      );
      if (total > 0) documents.push(...documentosEspeciales(period, diaMax));
      documents.sort((a, b) => a.issueDate.localeCompare(b.issueDate));

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

    async fetchPurchasesRcv({
      rut,
      period,
      revision = 0,
    }: ProviderQuery): Promise<ProviderPurchasesResult> {
      exigirSesion(rut);
      const escenario = resolverEscenario(rut);
      const corte = fechaCorte(period, reloj());
      const diaMax = Number(corte.slice(8));
      const c = cantidades(escenario);
      const rnd = generador(hash(`${rut}|${period}|purchases`));

      // Índice global: el mismo documento conserva su identificador aunque
      // cambie de estado entre una consulta y la siguiente.
      let indice = 0;
      const grupos: Record<
        "registered" | "pending" | "claimed" | "excluded",
        ProviderDocument[]
      > = { registered: [], pending: [], claimed: [], excluded: [] };

      const construir = (
        estado: "registered" | "pending" | "claimed" | "excluded",
        cantidad: number,
      ) => {
        for (let i = 0; i < cantidad; i += 1) {
          grupos[estado].push(
            documentoCompra(period, indice++, rnd, estado, escenario, diaMax),
          );
        }
      };

      construir("registered", c.registradas);
      construir("pending", c.pendientes);
      construir("claimed", c.reclamadas);
      construir("excluded", c.excluidas);

      // Avance del RCV: en cada nueva consulta la compra pendiente más
      // antigua queda registrada, conservando identificador, folio y montos.
      grupos.pending.sort((a, b) => a.issueDate.localeCompare(b.issueDate));
      const promover = Math.min(revision, grupos.pending.length);
      for (let i = 0; i < promover; i += 1) {
        const doc = grupos.pending.shift()!;
        grupos.registered.push({ ...doc, rcvStatus: "registered" });
      }

      for (const lista of Object.values(grupos))
        lista.sort((a, b) => a.issueDate.localeCompare(b.issueDate));

      return { period, dataThroughDate: corte, byStatus: grupos };
    },

    async fetchF29History({
      rut,
      period,
      months,
    }: ProviderQuery & { months: number }): Promise<ProviderF29Entry[]> {
      exigirSesion(rut);
      const escenario = resolverEscenario(rut);
      if (escenario === "datosParciales")
        throw new SiiProviderError("PERIOD_NOT_AVAILABLE", "f29_periods");
      const entradas: ProviderF29Entry[] = [];
      for (let i = 0; i < months; i += 1) {
        const p = periodoPrevio(period, i);
        const sinDatos = i === 0 || (escenario === "f29Incompleto" && i % 2 === 0);
        if (sinDatos) {
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
        const iva = escenario === "remanente" ? 0 : redondear(180000 + rnd() * 900000);
        const ppm = redondear(40000 + rnd() * 160000);
        const ret = escenario === "sinMovimientos" ? 0 : redondear(rnd() * 90000);
        const remanente =
          escenario === "remanente" ? redondear(120000 + rnd() * 400000) : 0;
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

    async fetchWithholdings({
      rut,
      period,
    }: ProviderQuery): Promise<ProviderWithholdingsResult> {
      exigirSesion(rut);
      const escenario = resolverEscenario(rut);
      if (escenario === "sinMovimientos") return { period, totalAmount: 0, detail: [] };
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
