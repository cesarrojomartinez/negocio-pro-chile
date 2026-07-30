import { describe, expect, it } from "vitest";

import { antiguedadLegible, evaluarFrescura } from "@/lib/freshness";
import { transicionValida, explicarDiferencia } from "@/lib/periodLifecycle.server";
import { periodoYaTermino } from "@/lib/periodSyncState.server";

const ahora = new Date("2026-07-30T14:00:00Z");

describe("frescura de la información", () => {
  it("marca sin sincronizar cuando nunca se consultó", () => {
    const r = evaluarFrescura({
      ahora,
      ultimaSincronizacionExitosa: null,
      periodoCerrado: false,
    });
    expect(r.estado).toBe("never_synced");
  });

  it("considera al día una consulta del mismo día chileno", () => {
    const r = evaluarFrescura({
      ahora,
      ultimaSincronizacionExitosa: "2026-07-30T11:00:00Z",
      periodoCerrado: false,
    });
    expect(r.estado).toBe("fresh");
  });

  it("marca desactualizado luego de tres días", () => {
    const r = evaluarFrescura({
      ahora,
      ultimaSincronizacionExitosa: "2026-07-26T11:00:00Z",
      periodoCerrado: false,
    });
    expect(r.estado).toBe("outdated");
  });

  it("usa ventana semanal en periodos ya terminados", () => {
    const mismaSemana = evaluarFrescura({
      ahora,
      ultimaSincronizacionExitosa: "2026-07-27T11:00:00Z",
      periodoCerrado: true,
    });
    const semanaPasada = evaluarFrescura({
      ahora,
      ultimaSincronizacionExitosa: "2026-07-20T11:00:00Z",
      periodoCerrado: true,
    });
    expect(mismaSemana.estado).toBe("fresh");
    expect(semanaPasada.estado).toBe("stale");
  });

  it("no pide actualizar un periodo confirmado o cerrado", () => {
    const r = evaluarFrescura({
      ahora,
      ultimaSincronizacionExitosa: "2026-05-02T11:00:00Z",
      periodoCerrado: true,
      periodoConfirmado: true,
    });
    expect(r.estado).toBe("closed_period");
    expect(r.proximaActualizacionRecomendada).toBeNull();
  });

  it("describe la antigüedad en lenguaje simple", () => {
    expect(antiguedadLegible(null)).toContain("sin consultas");
    expect(antiguedadLegible(0)).toContain("menos de una hora");
    expect(antiguedadLegible(5)).toBe("hace 5 horas");
    expect(antiguedadLegible(49)).toBe("hace 2 días");
  });
});

describe("periodos terminados", () => {
  it("julio 2026 no ha terminado al 30 de julio", () => {
    expect(periodoYaTermino("2026-07", ahora)).toBe(false);
  });
  it("junio 2026 ya terminó", () => {
    expect(periodoYaTermino("2026-06", ahora)).toBe(true);
  });
});

describe("ciclo de vida del periodo", () => {
  it("no permite cerrar sin confirmar antes", () => {
    expect(transicionValida("open", "closed")).toBe(false);
    expect(transicionValida("confirmed", "closed")).toBe(true);
  });

  it("permite reabrir solo lo confirmado o cerrado", () => {
    expect(transicionValida("closed", "reopened")).toBe(true);
    expect(transicionValida("open", "reopened")).toBe(false);
  });
});

describe("comparación estimado vs declarado", () => {
  it("informa coincidencia cuando no hay diferencia", () => {
    expect(explicarDiferencia(0, 0)).toContain("coincidió");
  });
  it("explica una sobreestimación", () => {
    expect(explicarDiferencia(50000, 5)).toContain("más alta");
  });
});
