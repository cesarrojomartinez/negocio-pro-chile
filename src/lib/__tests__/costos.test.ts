import { describe, expect, it } from "vitest";

import {
  detectarAlertasConsumo,
  resumirConsumo,
  type EventoConsumo,
} from "@/lib/costos";

const eventos: EventoConsumo[] = [
  {
    categoria: "rcv",
    consultas: 4,
    cacheHits: 2,
    errores: 0,
    pdfsNuevos: 0,
    unidades: 8,
    mes: "2026-07",
  },
  {
    categoria: "f29",
    consultas: 2,
    cacheHits: 1,
    errores: 1,
    pdfsNuevos: 1,
    unidades: 6,
    mes: "2026-07",
  },
  {
    categoria: "pdf",
    consultas: 1,
    cacheHits: 0,
    errores: 0,
    pdfsNuevos: 1,
    unidades: 2,
    mes: "2026-06",
  },
];

describe("resumirConsumo", () => {
  it("agrega el consumo del mes solicitado", () => {
    const r = resumirConsumo(eventos, "2026-07");
    expect(r.consultasRcv).toBe(4);
    expect(r.consultasF29).toBe(2);
    expect(r.consultasTotales).toBe(6);
    expect(r.consultasEvitadasPorCache).toBe(3);
    expect(r.pdfsNuevos).toBe(1);
    expect(r.erroresConCosto).toBe(1);
    expect(r.unidadesTotales).toBe(14);
  });

  it("calcula el costo promedio mensual sobre todos los meses", () => {
    const r = resumirConsumo(eventos);
    expect(r.unidadesTotales).toBe(16);
    expect(r.costoPromedioMensual).toBe(8);
  });
});

describe("detectarAlertasConsumo", () => {
  const resumen = resumirConsumo(eventos, "2026-07");

  it("avisa cuando el presupuesto está cerca del límite", () => {
    const a = detectarAlertasConsumo(resumen, { presupuesto: 16 });
    expect(a.some((x) => x.tipo === "presupuesto_cercano")).toBe(true);
  });

  it("marca como crítico el presupuesto alcanzado", () => {
    const a = detectarAlertasConsumo(resumen, { presupuesto: 10 });
    const alerta = a.find((x) => x.tipo === "presupuesto_cercano");
    expect(alerta?.severidad).toBe("critical");
  });

  it("detecta consumo anormal frente al promedio histórico", () => {
    const a = detectarAlertasConsumo(resumen, {
      presupuesto: 100,
      promedioHistorico: 5,
    });
    expect(a.some((x) => x.tipo === "consumo_anormal")).toBe(true);
  });

  it("detecta PDF repetido y consultas fuera del flujo económico", () => {
    const conFuera = resumirConsumo(
      [{ ...eventos[0], fueraDeFlujo: true }],
      "2026-07",
    );
    const a = detectarAlertasConsumo(conFuera, {
      presupuesto: 100,
      pdfsRepetidos: 2,
    });
    expect(a.some((x) => x.tipo === "pdf_repetido")).toBe(true);
    expect(a.some((x) => x.tipo === "fuera_de_flujo")).toBe(true);
  });

  it("no genera alertas cuando todo es normal", () => {
    const a = detectarAlertasConsumo(resumirConsumo([eventos[2]], "2026-06"), {
      presupuesto: 100,
      promedioHistorico: 50,
    });
    expect(a).toHaveLength(0);
  });
});
