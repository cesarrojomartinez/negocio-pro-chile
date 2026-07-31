import { describe, expect, it } from "vitest";

import {
  CODIGO_GUARDA_CREDITOS,
  construirPlanEjecucion,
  verificarLimitesPlan,
  type EstadoPeriodoConocido,
} from "@/lib/syncPlan";

const AHORA = new Date("2026-07-20T15:00:00.000Z"); // julio 2026 en Chile

function estado(p: Partial<EstadoPeriodoConocido> & { periodo: string }): EstadoPeriodoConocido {
  return {
    ultimaSincronizacionRcv: null,
    tieneDatosRcv: false,
    tieneF29Vigente: false,
    periodoCerrado: false,
    folioConocido: null,
    ultimoFalloDescargaF29: null,
    ...p,
  };
}

describe("plan de ejecución de sincronización", () => {
  it("no pide credenciales cuando todo está vigente", () => {
    const plan = construirPlanEjecucion({
      companyId: "e1",
      requestedPeriods: ["2026-07"],
      ahora: AHORA,
      executionMode: "manual_secure",
      estados: [
        estado({
          periodo: "2026-07",
          tieneDatosRcv: true,
          ultimaSincronizacionRcv: "2026-07-20T13:00:00.000Z",
        }),
      ],
    });
    expect(plan.periodsRequiringRcv).toEqual([]);
    expect(plan.periodsUsingCache).toEqual(["2026-07"]);
    // El listado anual sí puede revisarse, pero sin RCV no hay clave necesaria
    // salvo que existan llamadas: aquí solo queda el listado del año.
    expect(plan.expectedProviderCalls).toBe(2);
  });

  it("un periodo cerrado no genera ninguna llamada", () => {
    const plan = construirPlanEjecucion({
      companyId: "e1",
      requestedPeriods: ["2025-03"],
      ahora: AHORA,
      executionMode: "manual_secure",
      estados: [
        estado({
          periodo: "2025-03",
          tieneDatosRcv: true,
          periodoCerrado: true,
          ultimaSincronizacionRcv: "2025-04-10T12:00:00.000Z",
          folioConocido: "123",
          tieneF29Vigente: true,
        }),
      ],
    });
    expect(plan.expectedProviderCalls).toBe(0);
    expect(plan.requiresCredentials).toBe(false);
    expect(plan.knownFolios["2025-03"]).toBe("123");
  });

  it("tres periodos vencidos: máximo 6 llamadas RCV y 1 listado anual", () => {
    const plan = construirPlanEjecucion({
      companyId: "e1",
      requestedPeriods: ["2026-05", "2026-06", "2026-07"],
      ahora: AHORA,
      executionMode: "manual_secure",
      estados: ["2026-05", "2026-06", "2026-07"].map((periodo) =>
        estado({
          periodo,
          tieneDatosRcv: true,
          ultimaSincronizacionRcv: "2026-06-01T12:00:00.000Z",
        }),
      ),
    });
    expect(plan.periodsRequiringRcv).toHaveLength(3);
    expect(plan.yearsRequiringF29List).toEqual(["2026"]);
    expect(plan.expectedProviderCalls).toBeLessThanOrEqual(6 + 1 + 3);
    expect(plan.requiresCredentials).toBe(true);
    // El detalle documental siempre queda omitido en el flujo normal.
    expect(
      plan.skippedResources.filter((r) => r.recurso === "detalle_documental"),
    ).toHaveLength(3);
  });

  it("regla de oro: un periodo sin datos del RCV siempre se descarga", () => {
    const plan = construirPlanEjecucion({
      companyId: "e1",
      requestedPeriods: ["2025-12"],
      ahora: AHORA,
      executionMode: "manual_secure",
      estados: [
        estado({
          periodo: "2025-12",
          tieneDatosRcv: false,
          periodoCerrado: true,
          tieneF29Vigente: true,
          ultimaSincronizacionRcv: "2026-01-05T12:00:00.000Z",
        }),
      ],
    });
    expect(plan.periodsRequiringRcv).toEqual(["2025-12"]);
  });

  it("no vuelve a descargar el PDF tras un fallo reciente", () => {
    const plan = construirPlanEjecucion({
      companyId: "e1",
      requestedPeriods: ["2026-06"],
      ahora: AHORA,
      executionMode: "manual_secure",
      estados: [
        estado({
          periodo: "2026-06",
          tieneDatosRcv: true,
          ultimoFalloDescargaF29: "2026-07-20T09:00:00.000Z",
        }),
      ],
    });
    expect(plan.possibleNewFolios).toEqual([]);
    expect(
      plan.skippedResources.some((r) => r.motivo === "espera_tras_fallo"),
    ).toBe(true);
  });

  it("un PDF guardado con lectura fallida se reprocesa sin costo", () => {
    const plan = construirPlanEjecucion({
      companyId: "e1",
      requestedPeriods: ["2026-06"],
      ahora: AHORA,
      executionMode: "manual_secure",
      estados: [
        estado({
          periodo: "2026-06",
          tieneDatosRcv: true,
          pdfGuardadoPendienteDeLectura: true,
        }),
      ],
    });
    expect(plan.possibleNewFolios).toEqual([]);
  });

  it("el plan nunca contiene credenciales", () => {
    const plan = construirPlanEjecucion({
      companyId: "e1",
      requestedPeriods: ["2026-07"],
      ahora: AHORA,
      executionMode: "manual_secure",
      estados: [],
    });
    const texto = JSON.stringify(plan).toLowerCase();
    for (const prohibido of ["clave", "password", "contrase", "secret"])
      expect(texto).not.toContain(prohibido);
  });

  it("la guarda acepta un plan normal", () => {
    const plan = construirPlanEjecucion({
      companyId: "e1",
      requestedPeriods: ["2026-05", "2026-06"],
      ahora: AHORA,
      executionMode: "manual_secure",
      estados: [],
    });
    expect(verificarLimitesPlan(plan).ok).toBe(true);
  });

  it("la guarda cancela antes de llamar si el plan es anormal", () => {
    const plan = construirPlanEjecucion({
      companyId: "e1",
      requestedPeriods: ["2026-05"],
      ahora: AHORA,
      executionMode: "manual_secure",
      estados: [],
    });
    const anormal = { ...plan, expectedProviderCalls: plan.expectedProviderCalls + 5 };
    const guarda = verificarLimitesPlan(anormal);
    expect(guarda.ok).toBe(false);
    expect(guarda.codigo).toBe(CODIGO_GUARDA_CREDITOS);
    expect(guarda.mensajeUsuario).toContain("No se consumieron créditos");
  });
});
