import { describe, expect, it } from "vitest";

import { conciliarConF29Oficial } from "@/lib/f29Reconciliation";
import type { ResumenMensual } from "@/types/tax";

const RESUMEN: ResumenMensual = {
  periodo: "2026-01",
  ventasTotales: 10000000,
  ventasFacturas: 10000000,
  ventasBoletas: 0,
  ventasExentas: 0,
  notasCreditoVentas: 0,
  comprasTotales: 1000000,
  comprasNetas: 840336,
  comprasExentas: 0,
  ivaDebito: 1900000,
  ivaDebitoInferido: false,
  ivaCredito: 159664,
  ivaCreditoPotencial: 0,
  remanenteAnterior: 0,
  fuenteRemanente: "unknown",
  ivaEstimado: 1740336,
  nuevoRemanente: 0,
  ivaEstimadoConPendientes: 1740336,
  ppmEstimado: 100000,
  basePpm: 10000000,
  tasaPpm: 0.01,
  fuentePpm: "configured",
  ppmPendiente: false,
  retencionesEstimadas: 0,
  fuenteRetenciones: "unknown",
  totalTributarioEstimado: 1840336,
  margenPorcentaje: 10,
  margenPreventivo: 184034,
  reservaRecomendada: 2024370,
  dineroReservado: 0,
};

const SIN_OFICIAL = {
  ivaDebito: null,
  ivaCredito: null,
  remanenteAnterior: null,
  ivaDeterminado: null,
  nuevoRemanente: null,
  ppm: null,
  retenciones: null,
  totalAPagar: null,
};

describe("conciliación con el Formulario 29 oficial", () => {
  it("sin formulario oficial no toca ninguna cifra", () => {
    const r = conciliarConF29Oficial(RESUMEN, SIN_OFICIAL, { margenPorcentaje: 10 });
    expect(r.resumen).toEqual(RESUMEN);
    expect(r.conciliacion.hayOficial).toBe(false);
    expect(r.conciliacion.ajustado).toBe(false);
  });

  it("corrige la pantalla con las cifras declaradas y registra la diferencia", () => {
    const r = conciliarConF29Oficial(
      RESUMEN,
      {
        ...SIN_OFICIAL,
        ivaDeterminado: 1764974,
        ppm: 248957,
        retenciones: 0,
        totalAPagar: 2013931,
      },
      { margenPorcentaje: 10 },
    );
    expect(r.resumen.ivaEstimado).toBe(1764974);
    expect(r.resumen.ppmEstimado).toBe(248957);
    expect(r.resumen.totalTributarioEstimado).toBe(2013931);
    expect(r.resumen.margenPreventivo).toBe(201393);
    expect(r.resumen.reservaRecomendada).toBe(2215324);
    expect(r.conciliacion.ajustado).toBe(true);
    expect(r.conciliacion.diferencias.map((d) => d.id)).toContain("ivaDeterminado");
  });

  it("si el formulario no trae total, lo recompone con sus propias partes", () => {
    const r = conciliarConF29Oficial(
      RESUMEN,
      { ...SIN_OFICIAL, ivaDeterminado: 1000000, ppm: 50000, retenciones: 20000 },
      { margenPorcentaje: 10 },
    );
    expect(r.resumen.totalTributarioEstimado).toBe(1070000);
  });

  it("no marca diferencias cuando la estimación coincidió", () => {
    const r = conciliarConF29Oficial(
      RESUMEN,
      {
        ...SIN_OFICIAL,
        ivaDeterminado: 1740336,
        ppm: 100000,
        totalAPagar: 1840336,
      },
      { margenPorcentaje: 10 },
    );
    expect(r.conciliacion.hayOficial).toBe(true);
    expect(r.conciliacion.ajustado).toBe(false);
    expect(r.conciliacion.diferencias).toHaveLength(0);
  });
});
