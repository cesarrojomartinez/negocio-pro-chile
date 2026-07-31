import { describe, expect, it } from "vitest";

import { resolverEstadoMensual } from "@/lib/estadoMensual";
import type { ContextoTributario } from "@/lib/taxContext";
import type { ResumenMensual } from "@/types/tax";

const AHORA = new Date("2026-06-15T12:00:00Z");

function resumen(parcial: Partial<ResumenMensual> = {}): ResumenMensual {
  return {
    periodo: "2026-06",
    ventasTotales: 0,
    ventasFacturas: 0,
    ventasBoletas: 0,
    ventasExentas: 0,
    notasCreditoVentas: 0,
    comprasTotales: 0,
    comprasNetas: 0,
    comprasExentas: 0,
    ivaDebito: 0,
    ivaDebitoInferido: false,
    ivaCredito: 0,
    ivaCreditoPotencial: 0,
    remanenteAnterior: 0,
    fuenteRemanente: "mock",
    ivaEstimado: 0,
    nuevoRemanente: 0,
    ivaEstimadoConPendientes: 0,
    ppmEstimado: 0,
    basePpm: 0,
    tasaPpm: 0.01,
    fuentePpm: "mock",
    ppmPendiente: false,
    retencionesEstimadas: 0,
    fuenteRetenciones: "mock",
    totalTributarioEstimado: 0,
    margenPorcentaje: 10,
    margenPreventivo: 0,
    reservaRecomendada: 0,
    dineroReservado: 0,
    ...parcial,
  };
}

function contexto(parcial: Partial<ContextoTributario> = {}): ContextoTributario {
  return {
    calculation_status: "estimated_complete",
    declared_tax_total: null,
    missing_components: [],
    ...parcial,
  } as ContextoTributario;
}

describe("resolverEstadoMensual", () => {
  it("mes en curso con impuestos muestra la reserva recomendada", () => {
    const r = resolverEstadoMensual({
      resumen: resumen({ totalTributarioEstimado: 100000, reservaRecomendada: 110000 }),
      contexto: contexto(),
      ahora: AHORA,
    });
    expect(r.estado).toBe("reserva_recomendada");
    expect(r.monto).toBe(110000);
  });

  it("mes terminado sin F29 queda como declaración pendiente", () => {
    const r = resolverEstadoMensual({
      resumen: resumen({
        periodo: "2026-04",
        totalTributarioEstimado: 250000,
        reservaRecomendada: 275000,
      }),
      contexto: contexto(),
      ahora: AHORA,
    });
    expect(r.estado).toBe("declaracion_pendiente");
    expect(r.monto).toBe(250000);
  });

  it("con F29 presentado muestra el total declarado", () => {
    const r = resolverEstadoMensual({
      resumen: resumen({ periodo: "2026-04", totalTributarioEstimado: 250000 }),
      contexto: contexto({ declared_tax_total: 261000 }),
      ahora: AHORA,
    });
    expect(r.estado).toBe("total_declarado");
    expect(r.monto).toBe(261000);
  });

  it("con pago confirmado muestra el total pagado", () => {
    const r = resolverEstadoMensual({
      resumen: resumen({ periodo: "2026-04" }),
      contexto: contexto({ declared_tax_total: 261000 }),
      pagoConfirmado: true,
      ahora: AHORA,
    });
    expect(r.estado).toBe("total_pagado");
  });

  it("sin impuestos y con remanente muestra dinero a favor", () => {
    const r = resolverEstadoMensual({
      resumen: resumen({ nuevoRemanente: 48000 }),
      contexto: contexto(),
      ahora: AHORA,
    });
    expect(r.estado).toBe("dinero_a_favor");
    expect(r.monto).toBe(48000);
  });

  it("sin impuestos ni remanente indica que no hay monto por pagar", () => {
    const r = resolverEstadoMensual({
      resumen: resumen(),
      contexto: contexto(),
      ahora: AHORA,
    });
    expect(r.estado).toBe("sin_monto_por_pagar");
  });

  it("antecedentes faltantes marcan la estimación como incompleta", () => {
    const r = resolverEstadoMensual({
      resumen: resumen({ totalTributarioEstimado: 90000, reservaRecomendada: 99000 }),
      contexto: contexto({
        calculation_status: "incomplete",
        missing_components: [
          { clave: "carryforward", etiqueta: "Remanente anterior", detalle: "Falta." },
        ],
      }),
      ahora: AHORA,
    });
    expect(r.estado).toBe("estimacion_incompleta");
    expect(r.faltantes).toHaveLength(1);
  });

  it("el F29 manda por sobre una estimación incompleta", () => {
    const r = resolverEstadoMensual({
      resumen: resumen({ periodo: "2026-04" }),
      contexto: contexto({
        declared_tax_total: 120000,
        calculation_status: "incomplete",
      }),
      ahora: AHORA,
    });
    expect(r.estado).toBe("total_declarado");
  });
});
