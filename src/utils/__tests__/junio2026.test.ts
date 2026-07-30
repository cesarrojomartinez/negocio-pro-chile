import { describe, expect, it } from "vitest";

import { construirDashboard } from "@/lib/dashboardBuilder";
import { aplicarAntecedenteF29, interpretarAntecedenteF29 } from "@/lib/f29Antecedent";
import type { DocumentoTributario, PeriodoData } from "@/types/tax";
import type { Empresa } from "@/types/company";

/**
 * Caso real de junio de 2026 (RUT 77.976.228-9) confirmado por el contador.
 * VENTAS  DTE 33: 10.840.000 neto / 2.059.600 IVA (3 documentos)
 *         DTE 61:  4.820.000 neto /   915.800 IVA (efecto negativo)
 * COMPRAS         887.224 neto / 168.571 IVA recuperable / 1.225.687 total SII
 * F29     IVA determinado 975.229 · PPM 150.500 (2,5 %) · Total 1.125.729
 */

const EMPRESA: Empresa = {
  id: "bdc659fe-ef6e-4e14-82a5-33c8e32c86ba",
  rut: "77.976.228-9",
  razonSocial: "Explotación de Madera JMC SpA",
  nombreFantasia: "JMC",
  actividad: "Servicios de corta de madera",
  estadoConexionSii: "connected",
  ultimaSincronizacion: "2026-07-30T08:15:29.223Z",
  periodoActivo: "2026-06",
};

/** `signo` reproduce ambos orígenes: montos firmados (RCV real) y positivos. */
function documentosJunio(signo: 1 | -1): {
  ventas: DocumentoTributario[];
  compras: DocumentoTributario[];
} {
  const venta = (
    folio: number,
    neto: number,
    iva: number,
    tipo: DocumentoTributario["tipoDocumento"] = "factura",
    factor = 1,
  ): DocumentoTributario => ({
    id: `v-${folio}`,
    fecha: "2026-06-01",
    tipoDocumento: tipo,
    folio,
    contraparte: "Agrícola Hacienda Huentelauquén Limitada",
    rutContraparte: "77.422.290-1",
    neto: factor * neto,
    iva: factor * iva,
    exento: 0,
    total: factor * (neto + iva),
    estado: "emitido",
    periodo: "2026-06",
  });

  return {
    ventas: [
      venta(51, 4_820_000, 915_800),
      venta(52, 4_820_000, 915_800),
      venta(53, 1_200_000, 228_000),
      venta(7, 4_820_000, 915_800, "notaCredito", signo),
    ],
    compras: [
      {
        id: "c-1",
        fecha: "2026-06-15",
        tipoDocumento: "factura",
        folio: 1,
        contraparte: "Proveedores varios",
        rutContraparte: "77.936.634-0",
        neto: 887_224,
        iva: 168_571,
        exento: 0,
        total: 1_225_687,
        estado: "registrada",
        periodo: "2026-06",
      },
    ],
  };
}

function armar(signo: 1 | -1) {
  const { ventas, compras } = documentosJunio(signo);
  const periodo: PeriodoData = {
    periodo: "2026-06",
    documentosVenta: ventas,
    documentosCompra: compras,
    remanenteAnterior: 0,
    fuenteRemanente: "accountant_confirmed_f29",
    tasaPpm: 0.025,
    fuentePpm: "accountant_confirmed_f29",
    retencionesEstimadas: 0,
    fuenteRetenciones: "accountant_confirmed_f29",
    metaMensual: 0,
    dineroReservado: 0,
    diasTranscurridos: 30,
    diasTotales: 30,
    estadoPeriodo: "closed",
    confiabilidad: "alta",
  };
  return construirDashboard({
    empresa: EMPRESA,
    periodo,
    periodoAnterior: null,
    idPeriodoAnterior: null,
    margenPorcentaje: 0,
    dineroReservado: 0,
    metaMensual: 0,
    diasDesdeSincronizacion: 0,
    configuradoManualmente: true,
  });
}

describe("junio 2026 — cifras confirmadas por el F29", () => {
  for (const signo of [1, -1] as const) {
    const etiqueta = signo === -1 ? "montos firmados (RCV real)" : "montos positivos";

    it(`resta la nota de crédito con ${etiqueta}`, () => {
      const d = armar(signo);
      expect(d.resumen.ivaDebito).toBe(1_143_800);
      expect(d.ventas.ventasNetas).toBe(6_020_000);
      expect(d.ventas.ventasTotales).toBe(7_163_800);
      expect(d.ventas.cantidadNotasCredito).toBe(1);
      expect(d.ventas.cantidadDocumentosInformados).toBe(4);
    });

    it(`determina IVA, PPM y total del periodo con ${etiqueta}`, () => {
      const d = armar(signo);
      expect(d.resumen.ivaCredito).toBe(168_571);
      expect(d.resumen.ivaEstimado).toBe(975_229);
      expect(d.resumen.nuevoRemanente).toBe(0);
      expect(d.resumen.basePpm).toBe(6_020_000);
      expect(d.resumen.tasaPpm).toBe(0.025);
      expect(d.resumen.ppmEstimado).toBe(150_500);
      expect(d.resumen.totalTributarioEstimado).toBe(1_125_729);
    });
  }
});

describe("antecedente del F29 confirmado por el contador", () => {
  const fila = {
    declaration_status: "filed",
    declared_vat: 975229,
    declared_ppm: 150500,
    declared_withholdings: 0,
    declared_total: 1125729,
    vat_carryforward: 0,
    source: "accountant",
    raw_data: { origin: "accountant_confirmed_f29", ppm_rate: 0.025 },
  };

  it("interpreta la tasa y el remanente declarados", () => {
    const a = interpretarAntecedenteF29(fila);
    expect(a?.confirmado).toBe(true);
    expect(a?.tasaPpm).toBe(0.025);
    expect(a?.remanenteAnterior).toBe(0);
  });

  it("tiene prioridad sobre la configuración de la empresa", () => {
    const base = {
      remanenteAnterior: 40_000,
      fuenteRemanente: "previous_period" as const,
      tasaPpm: 0.006,
      fuentePpm: "configured" as const,
      retenciones: 5_000,
      fuenteRetenciones: "configured" as const,
    };
    const r = aplicarAntecedenteF29(base, interpretarAntecedenteF29(fila));
    expect(r.tasaPpm).toBe(0.025);
    expect(r.fuentePpm).toBe("accountant_confirmed_f29");
    expect(r.remanenteAnterior).toBe(0);
    expect(r.retenciones).toBe(0);
  });

  it("no altera nada cuando el F29 no está confirmado", () => {
    const base = {
      remanenteAnterior: 1,
      fuenteRemanente: "previous_period" as const,
      tasaPpm: 0.006,
      fuentePpm: "configured" as const,
      retenciones: 2,
      fuenteRetenciones: "configured" as const,
    };
    const sinConfirmar = interpretarAntecedenteF29({
      ...fila,
      declaration_status: "pending",
      source: "provider",
      raw_data: {},
    });
    expect(aplicarAntecedenteF29(base, sinConfirmar)).toEqual(base);
  });
});
