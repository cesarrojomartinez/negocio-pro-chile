import type { Empresa, Escenario, EscenarioId, Periodo } from "@/types/company";
import type {
  DocumentoTributario,
  NivelConfiabilidad,
  PeriodoData,
} from "@/types/tax";
import { TASA_IVA } from "@/utils/taxCalculations";

export const EMPRESA_DEMO: Empresa = {
  id: "emp-1",
  rut: "76.123.456-7",
  razonSocial: "Comercial Los Vilos SpA",
  nombreFantasia: "Los Vilos Market",
  actividad: "Venta al por menor de alimentos y abarrotes",
  estadoConexionSii: "connected",
  ultimaSincronizacion: new Date().toISOString(),
  periodoActivo: "2026-07",
};

export const PERIODOS: Periodo[] = [
  { id: "2026-07", etiqueta: "Julio 2026", anio: 2026, mes: 7 },
  { id: "2026-06", etiqueta: "Junio 2026", anio: 2026, mes: 6 },
  { id: "2026-05", etiqueta: "Mayo 2026", anio: 2026, mes: 5 },
];

export const ESCENARIOS: Escenario[] = [
  {
    id: "equilibrado",
    nombre: "Negocio equilibrado",
    descripcion:
      "Ventas cercanas a la meta, reserva parcialmente cubierta e IVA por pagar.",
  },
  {
    id: "remanente",
    nombre: "Remanente disponible",
    descripcion:
      "Compras elevadas, crédito mayor al débito y remanente para el próximo periodo.",
  },
  {
    id: "ventasAltas",
    nombre: "Ventas altas y reserva insuficiente",
    descripcion:
      "Ventas sobre la meta, impuestos elevados y dinero reservado insuficiente.",
  },
];

const CLIENTES: [string, string][] = [
  ["Distribuidora El Faro Ltda.", "77.884.221-3"],
  ["Panadería San Andrés EIRL", "76.552.109-K"],
  ["Hotel Costa Azul SpA", "78.221.660-1"],
  ["Municipalidad de Los Vilos", "69.040.500-2"],
  ["Restaurante Marina SpA", "77.010.443-6"],
  ["Constructora Pehuén Ltda.", "76.998.001-4"],
  ["Colegio Vista al Mar", "65.443.221-8"],
  ["Consumidor final", "66.666.666-6"],
];

const PROVEEDORES: [string, string][] = [
  ["Comercial Alimentos del Norte SA", "96.554.220-9"],
  ["Bebidas y Licores Chile Ltda.", "89.221.004-7"],
  ["Envases Pacífico SpA", "76.330.988-2"],
  ["Enel Distribución Chile", "96.800.570-7"],
  ["Transportes Coquimbo Ltda.", "77.440.221-5"],
  ["Insumos de Aseo Andes SpA", "76.112.998-1"],
];

/** Generador determinista simple para que los datos demostrativos no cambien entre renders. */
function crearRandom(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function diasDelMes(anio: number, mes: number) {
  return new Date(anio, mes, 0).getDate();
}

function desdeTotal(total: number, exento = 0): { neto: number; iva: number } {
  const afecto = total - exento;
  const neto = Math.round(afecto / (1 + TASA_IVA));
  return { neto, iva: afecto - neto };
}

interface Config {
  ventasFacturasObjetivo: number;
  ventasBoletasObjetivo: number;
  comprasObjetivo: number;
  remanenteAnterior: number;
  tasaPpm: number;
  retenciones: number;
  metaMensual: number;
  dineroReservado: number;
  pendientes: number;
  reclamadas: number;
  noIncluir: number;
  notasCredito: number;
  confiabilidad: NivelConfiabilidad;
  diasTranscurridos: number;
}

function generarPeriodo(
  periodo: Periodo,
  cfg: Config,
  semilla: number,
): PeriodoData {
  const rnd = crearRandom(semilla);
  const total = diasDelMes(periodo.anio, periodo.mes);
  const dias = Math.min(cfg.diasTranscurridos, total);

  const documentosVenta: DocumentoTributario[] = [];
  let folioFactura = 1200;
  let folioBoleta = 8400;

  // Facturas de venta
  const nFacturas = 18;
  const pesos = Array.from({ length: nFacturas }, () => 0.5 + rnd());
  const sumaPesos = pesos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < nFacturas; i++) {
    const dia = 1 + Math.floor(rnd() * dias);
    const fecha = `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}-${String(
      dia,
    ).padStart(2, "0")}`;
    const bruto =
      Math.round((cfg.ventasFacturasObjetivo * pesos[i]) / sumaPesos / 1000) * 1000;
    const exento = i % 7 === 0 ? Math.round(bruto * 0.1) : 0;
    const { neto, iva } = desdeTotal(bruto, exento);
    const [contraparte, rut] = CLIENTES[i % (CLIENTES.length - 1)];
    documentosVenta.push({
      id: `v-f-${periodo.id}-${i}`,
      fecha,
      tipoDocumento: "factura",
      folio: ++folioFactura,
      contraparte,
      rutContraparte: rut,
      neto,
      iva,
      exento,
      total: bruto,
      estado: "emitido",
      periodo: periodo.id,
    });
  }

  // Boletas: un resumen diario por día transcurrido
  const pesosB = Array.from({ length: dias }, () => 0.6 + rnd());
  const sumaB = pesosB.reduce((a, b) => a + b, 0);
  for (let d = 1; d <= dias; d++) {
    const bruto =
      Math.round((cfg.ventasBoletasObjetivo * pesosB[d - 1]) / sumaB / 1000) * 1000;
    const { neto, iva } = desdeTotal(bruto);
    documentosVenta.push({
      id: `v-b-${periodo.id}-${d}`,
      fecha: `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}-${String(
        d,
      ).padStart(2, "0")}`,
      tipoDocumento: "boleta",
      folio: ++folioBoleta,
      contraparte: "Resumen diario de boletas",
      rutContraparte: "66.666.666-6",
      neto,
      iva,
      exento: 0,
      total: bruto,
      estado: "emitido",
      periodo: periodo.id,
    });
  }

  for (let i = 0; i < cfg.notasCredito; i++) {
    const bruto = Math.round((80000 + rnd() * 220000) / 1000) * 1000;
    const { neto, iva } = desdeTotal(bruto);
    const [contraparte, rut] = CLIENTES[(i + 2) % CLIENTES.length];
    documentosVenta.push({
      id: `v-nc-${periodo.id}-${i}`,
      fecha: `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}-${String(
        Math.max(1, Math.min(dias, 5 + i * 6)),
      ).padStart(2, "0")}`,
      tipoDocumento: "notaCredito",
      folio: 500 + i,
      contraparte,
      rutContraparte: rut,
      neto,
      iva,
      exento: 0,
      total: bruto,
      estado: "emitido",
      periodo: periodo.id,
    });
  }

  // Compras
  const documentosCompra: DocumentoTributario[] = [];
  const nCompras = 14;
  const pesosC = Array.from({ length: nCompras }, () => 0.5 + rnd());
  const sumaC = pesosC.reduce((a, b) => a + b, 0);
  for (let i = 0; i < nCompras; i++) {
    const bruto = Math.round((cfg.comprasObjetivo * pesosC[i]) / sumaC / 1000) * 1000;
    const exento = i % 9 === 0 ? Math.round(bruto * 0.08) : 0;
    const { neto, iva } = desdeTotal(bruto, exento);
    const [contraparte, rut] = PROVEEDORES[i % PROVEEDORES.length];
    let estado: DocumentoTributario["estado"] = "registrada";
    if (i < cfg.pendientes) estado = "pendiente";
    else if (i < cfg.pendientes + cfg.reclamadas) estado = "reclamada";
    else if (i < cfg.pendientes + cfg.reclamadas + cfg.noIncluir) estado = "noIncluir";
    documentosCompra.push({
      id: `c-${periodo.id}-${i}`,
      fecha: `${periodo.anio}-${String(periodo.mes).padStart(2, "0")}-${String(
        1 + Math.floor(rnd() * dias),
      ).padStart(2, "0")}`,
      tipoDocumento: "factura",
      folio: 30500 + i,
      contraparte,
      rutContraparte: rut,
      neto,
      iva,
      exento,
      total: bruto,
      estado,
      periodo: periodo.id,
    });
  }

  documentosVenta.sort((a, b) => b.fecha.localeCompare(a.fecha));
  documentosCompra.sort((a, b) => b.fecha.localeCompare(a.fecha));

  return {
    periodo: periodo.id,
    documentosVenta,
    documentosCompra,
    remanenteAnterior: cfg.remanenteAnterior,
    tasaPpm: cfg.tasaPpm,
    retencionesEstimadas: cfg.retenciones,
    metaMensual: cfg.metaMensual,
    dineroReservado: cfg.dineroReservado,
    diasTranscurridos: dias,
    diasTotales: total,
    confiabilidad: cfg.confiabilidad,
  };
}

const CONFIGS: Record<EscenarioId, Record<string, Config>> = {
  equilibrado: {
    "2026-07": {
      ventasFacturasObjetivo: 5600000,
      ventasBoletasObjetivo: 2850000,
      comprasObjetivo: 3400000,
      remanenteAnterior: 120000,
      tasaPpm: 0.006,
      retenciones: 80000,
      metaMensual: 10000000,
      dineroReservado: 700000,
      pendientes: 2,
      reclamadas: 1,
      noIncluir: 1,
      notasCredito: 2,
      confiabilidad: "alta",
      diasTranscurridos: 21,
    },
    "2026-06": {
      ventasFacturasObjetivo: 4900000,
      ventasBoletasObjetivo: 2500000,
      comprasObjetivo: 3600000,
      remanenteAnterior: 90000,
      tasaPpm: 0.006,
      retenciones: 75000,
      metaMensual: 9500000,
      dineroReservado: 640000,
      pendientes: 1,
      reclamadas: 1,
      noIncluir: 0,
      notasCredito: 1,
      confiabilidad: "alta",
      diasTranscurridos: 30,
    },
    "2026-05": {
      ventasFacturasObjetivo: 4600000,
      ventasBoletasObjetivo: 2300000,
      comprasObjetivo: 3100000,
      remanenteAnterior: 60000,
      tasaPpm: 0.006,
      retenciones: 70000,
      metaMensual: 9000000,
      dineroReservado: 600000,
      pendientes: 0,
      reclamadas: 0,
      noIncluir: 1,
      notasCredito: 1,
      confiabilidad: "alta",
      diasTranscurridos: 31,
    },
  },
  remanente: {
    "2026-07": {
      ventasFacturasObjetivo: 3900000,
      ventasBoletasObjetivo: 1800000,
      comprasObjetivo: 6800000,
      remanenteAnterior: 180000,
      tasaPpm: 0.005,
      retenciones: 95000,
      metaMensual: 10000000,
      dineroReservado: 300000,
      pendientes: 4,
      reclamadas: 1,
      noIncluir: 1,
      notasCredito: 3,
      confiabilidad: "media",
      diasTranscurridos: 21,
    },
    "2026-06": {
      ventasFacturasObjetivo: 4200000,
      ventasBoletasObjetivo: 1900000,
      comprasObjetivo: 4300000,
      remanenteAnterior: 40000,
      tasaPpm: 0.005,
      retenciones: 90000,
      metaMensual: 9500000,
      dineroReservado: 250000,
      pendientes: 2,
      reclamadas: 0,
      noIncluir: 1,
      notasCredito: 2,
      confiabilidad: "media",
      diasTranscurridos: 30,
    },
    "2026-05": {
      ventasFacturasObjetivo: 4000000,
      ventasBoletasObjetivo: 1700000,
      comprasObjetivo: 3900000,
      remanenteAnterior: 0,
      tasaPpm: 0.005,
      retenciones: 85000,
      metaMensual: 9000000,
      dineroReservado: 220000,
      pendientes: 1,
      reclamadas: 1,
      noIncluir: 0,
      notasCredito: 1,
      confiabilidad: "media",
      diasTranscurridos: 31,
    },
  },
  ventasAltas: {
    "2026-07": {
      ventasFacturasObjetivo: 8600000,
      ventasBoletasObjetivo: 4200000,
      comprasObjetivo: 3900000,
      remanenteAnterior: 0,
      tasaPpm: 0.008,
      retenciones: 140000,
      metaMensual: 10000000,
      dineroReservado: 350000,
      pendientes: 1,
      reclamadas: 0,
      noIncluir: 1,
      notasCredito: 1,
      confiabilidad: "alta",
      diasTranscurridos: 21,
    },
    "2026-06": {
      ventasFacturasObjetivo: 6900000,
      ventasBoletasObjetivo: 3400000,
      comprasObjetivo: 3700000,
      remanenteAnterior: 0,
      tasaPpm: 0.008,
      retenciones: 120000,
      metaMensual: 9500000,
      dineroReservado: 400000,
      pendientes: 1,
      reclamadas: 1,
      noIncluir: 0,
      notasCredito: 2,
      confiabilidad: "alta",
      diasTranscurridos: 30,
    },
    "2026-05": {
      ventasFacturasObjetivo: 6200000,
      ventasBoletasObjetivo: 3000000,
      comprasObjetivo: 3500000,
      remanenteAnterior: 0,
      tasaPpm: 0.008,
      retenciones: 110000,
      metaMensual: 9000000,
      dineroReservado: 380000,
      pendientes: 0,
      reclamadas: 0,
      noIncluir: 1,
      notasCredito: 1,
      confiabilidad: "alta",
      diasTranscurridos: 31,
    },
  },
};

const cache = new Map<string, PeriodoData>();

export function obtenerPeriodoData(
  escenario: EscenarioId,
  periodoId: string,
): PeriodoData {
  const key = `${escenario}:${periodoId}`;
  const guardado = cache.get(key);
  if (guardado) return guardado;
  const periodo = PERIODOS.find((p) => p.id === periodoId) ?? PERIODOS[0];
  const cfg = CONFIGS[escenario][periodo.id];
  const semilla =
    periodo.anio * 100 + periodo.mes + escenario.length * 7919 + cfg.pendientes;
  const data = generarPeriodo(periodo, cfg, semilla);
  cache.set(key, data);
  return data;
}

export function periodoAnteriorDe(periodoId: string): string | null {
  const idx = PERIODOS.findIndex((p) => p.id === periodoId);
  if (idx === -1 || idx === PERIODOS.length - 1) return null;
  return PERIODOS[idx + 1].id;
}

export const HISTORIAL_METAS = [
  { periodo: "Junio 2026", meta: 9500000, logrado: 9180000 },
  { periodo: "Mayo 2026", meta: 9000000, logrado: 9260000 },
  { periodo: "Abril 2026", meta: 8800000, logrado: 8340000 },
];
