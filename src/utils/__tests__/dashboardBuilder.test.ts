import { describe, expect, it } from "vitest";

import { construirDashboard } from "@/lib/dashboardBuilder";
import type { DocumentoTributario, PeriodoData } from "@/types/tax";
import type { Empresa } from "@/types/company";

const EMPRESA: Empresa = {
  id: "empresa-prueba",
  rut: "76.123.456-0",
  razonSocial: "Comercial de Prueba SpA",
  nombreFantasia: "Prueba",
  actividad: "Comercio al por menor",
  estadoConexionSii: "connected",
  ultimaSincronizacion: "2026-07-30T00:00:00.000Z",
  periodoActivo: "2026-05",
};

function venta(
  folio: number,
  neto: number,
  extra: Partial<DocumentoTributario> = {},
): DocumentoTributario {
  const iva = Math.round(neto * 0.19);
  return {
    id: `v-${folio}`,
    fecha: "2026-05-05",
    tipoDocumento: "factura",
    folio,
    contraparte: "Cliente Uno",
    rutContraparte: "77.111.222-3",
    neto,
    iva,
    exento: 0,
    total: neto + iva,
    estado: "emitido",
    periodo: "2026-05",
    ...extra,
  };
}

function compra(
  folio: number,
  neto: number,
  extra: Partial<DocumentoTributario> = {},
): DocumentoTributario {
  const iva = Math.round(neto * 0.19);
  return {
    id: `c-${folio}`,
    fecha: "2026-05-07",
    tipoDocumento: "factura",
    folio,
    contraparte: "Proveedor Uno",
    rutContraparte: "78.333.444-5",
    neto,
    iva,
    exento: 0,
    total: neto + iva,
    estado: "registrada",
    periodo: "2026-05",
    ...extra,
  };
}

function periodoBase(overrides: Partial<PeriodoData> = {}): PeriodoData {
  return {
    periodo: "2026-05",
    documentosVenta: [],
    documentosCompra: [],
    remanenteAnterior: 0,
    fuenteRemanente: "unknown",
    tasaPpm: 0.006,
    fuentePpm: "configured",
    retencionesEstimadas: 0,
    fuenteRetenciones: "unknown",
    metaMensual: 0,
    dineroReservado: 0,
    diasTranscurridos: 31,
    diasTotales: 31,
    estadoPeriodo: "closed",
    confiabilidad: "media",
    ...overrides,
  };
}

function armar(periodo: PeriodoData, opciones: Partial<Parameters<typeof construirDashboard>[0]> = {}) {
  return construirDashboard({
    empresa: EMPRESA,
    periodo,
    periodoAnterior: null,
    idPeriodoAnterior: "2026-04",
    margenPorcentaje: 10,
    dineroReservado: periodo.dineroReservado,
    metaMensual: periodo.metaMensual,
    diasDesdeSincronizacion: 0,
    configuradoManualmente: true,
    ...opciones,
  });
}

describe("dashboardBuilder — casos deterministas", () => {
  it("caso 1: IVA por pagar cuando el débito supera al crédito", () => {
    const d = armar(
      periodoBase({
        documentosVenta: [venta(1, 1_000_000)],
        documentosCompra: [compra(1, 400_000)],
        remanenteAnterior: 0,
      }),
    );
    expect(d.resumen.ivaDebito).toBe(190_000);
    expect(d.resumen.ivaCredito).toBe(76_000);
    expect(d.resumen.ivaEstimado).toBe(114_000);
    expect(d.resumen.nuevoRemanente).toBe(0);
  });

  it("caso 2: nuevo remanente cuando el crédito supera al débito", () => {
    const d = armar(
      periodoBase({
        documentosVenta: [venta(1, 200_000)],
        documentosCompra: [compra(1, 500_000)],
        remanenteAnterior: 50_000,
        fuenteRemanente: "previous_period",
      }),
    );
    // débito 38.000 − crédito 95.000 − remanente 50.000 = −107.000
    expect(d.resumen.ivaEstimado).toBe(0);
    expect(d.resumen.nuevoRemanente).toBe(107_000);
  });

  it("caso 3: compras pendientes quedan fuera del crédito utilizable", () => {
    const d = armar(
      periodoBase({
        documentosVenta: [venta(1, 1_000_000)],
        documentosCompra: [
          compra(1, 300_000),
          compra(2, 200_000, { estado: "pendiente" }),
          compra(3, 100_000, { estado: "pendiente" }),
          compra(4, 100_000, { estado: "pendiente" }),
        ],
      }),
    );
    expect(d.resumen.ivaCredito).toBe(57_000);
    // el potencial cuenta solo el IVA de las compras pendientes
    expect(d.resumen.ivaCreditoPotencial).toBe(38_000 + 19_000 + 19_000);
    expect(d.compras.documentosPendientes).toBe(3);
    expect(d.confiabilidad).not.toBe("alta");
  });

  it("caso 4: sin tasa de PPM el PPM queda pendiente en cero", () => {
    const d = armar(
      periodoBase({
        documentosVenta: [venta(1, 1_000_000)],
        tasaPpm: null,
        fuentePpm: "unknown",
      }),
    );
    expect(d.resumen.ppmEstimado).toBe(0);
    expect(d.resumen.tasaPpm).toBeNull();
    expect(d.resumen.fuentePpm).toBe("unknown");
    expect(Number.isFinite(d.resumen.totalTributarioEstimado)).toBe(true);
  });

  it("caso 5: sin periodo anterior las variaciones son nulas", () => {
    const d = armar(periodoBase({ documentosVenta: [venta(1, 500_000)] }), {
      periodoAnterior: null,
    });
    expect(d.comparacion.periodoAnterior).toBeNull();
    expect(d.comparacion.variacionVentas).toBeNull();
    expect(d.comparacion.variacionCompras).toBeNull();
    expect(d.comparacion.variacionIva).toBeNull();
  });

  it("caso 6: meta superada", () => {
    const d = armar(
      periodoBase({
        documentosVenta: [venta(1, 2_000_000)],
        metaMensual: 1_000_000,
      }),
    );
    expect(d.meta.metaSuperada).toBe(true);
    expect(d.meta.montoFaltante).toBe(0);
    expect(d.meta.montoExcedido).toBeGreaterThan(0);
    expect(d.meta.porcentajeCumplimiento).toBeGreaterThan(100);
  });

  it("caso 7: periodo sin datos entrega ceros y confiabilidad desconocida", () => {
    const d = armar(
      periodoBase({ tasaPpm: null, fuentePpm: "unknown", estadoPeriodo: "open" }),
    );
    expect(d.resumen.ventasTotales).toBe(0);
    expect(d.resumen.ivaEstimado).toBe(0);
    expect(d.resumen.totalTributarioEstimado).toBe(0);
    expect(d.confiabilidad).toBe("desconocida");
    expect(d.razonesConfiabilidad.length).toBeGreaterThan(0);
  });

  it("caso 8: reserva recomendada igual a cero", () => {
    const d = armar(
      periodoBase({
        documentosVenta: [venta(1, 200_000)],
        documentosCompra: [compra(1, 500_000)],
        tasaPpm: null,
        fuentePpm: "unknown",
      }),
    );
    expect(d.resumen.totalTributarioEstimado).toBe(0);
    expect(d.resumen.margenPreventivo).toBe(0);
    expect(d.resumen.reservaRecomendada).toBe(0);
  });
});

describe("dashboardBuilder — invariantes numéricas y pureza", () => {
  const escenarios: PeriodoData[] = [
    periodoBase(),
    periodoBase({ documentosVenta: [venta(1, 1_000_000)] }),
    periodoBase({
      documentosVenta: [venta(1, 900_000), venta(2, 100_000, { tipoDocumento: "notaCredito" })],
      documentosCompra: [compra(1, 200_000), compra(2, 50_000, { estado: "reclamada" })],
      remanenteAnterior: 20_000,
      metaMensual: 500_000,
      dineroReservado: 100_000,
    }),
  ];

  it("nunca produce NaN, Infinity ni negativos indebidos", () => {
    for (const p of escenarios) {
      const d = armar(p);
      const numeros = [
        ...Object.values(d.resumen),
        ...Object.values(d.meta),
        ...Object.values(d.proyeccion),
      ].filter((v): v is number => typeof v === "number");
      for (const n of numeros) expect(Number.isFinite(n)).toBe(true);
      expect(d.resumen.ivaEstimado).toBeGreaterThanOrEqual(0);
      expect(d.resumen.nuevoRemanente).toBeGreaterThanOrEqual(0);
      expect(d.resumen.reservaRecomendada).toBeGreaterThanOrEqual(0);
      expect(d.meta.montoFaltante).toBeGreaterThanOrEqual(0);
    }
  });

  it("es puro: misma entrada, misma salida, sin mutar la entrada", () => {
    const entrada = periodoBase({
      documentosVenta: [venta(1, 750_000)],
      documentosCompra: [compra(1, 250_000)],
      remanenteAnterior: 15_000,
      metaMensual: 800_000,
    });
    const copia = structuredClone(entrada);
    const a = armar(entrada);
    const b = armar(entrada);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(entrada).toEqual(copia);
  });

  it("no depende de APIs del navegador ni de estado global", () => {
    expect(typeof globalThis.document).toBe("undefined");
    const d = armar(periodoBase({ documentosVenta: [venta(1, 100_000)] }));
    expect(d.empresa.id).toBe(EMPRESA.id);
  });
});
