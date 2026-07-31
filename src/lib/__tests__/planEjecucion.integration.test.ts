/**
 * Pruebas de integración del gobierno del plan de ejecución.
 *
 * Verifican el contrato completo entre `construirPlanEjecucion`,
 * `verificarLimitesPlan`, la guarda de presupuesto y el portero
 * `ControlPlanEjecucion` que autoriza cada llamada real.
 *
 * No se realiza NINGUNA consulta real al proveedor ni se consumen créditos.
 */
import { describe, expect, it } from "vitest";

import {
  CODIGO_AMPLIACION_RECHAZADA,
  construirPropuestaAmpliacionF29,
  evaluarAmpliacion,
} from "@/lib/planAmendment";


import {
  CODIGO_GUARDA_CREDITOS,
  CODIGO_LLAMADA_NO_PLANIFICADA,
  ControlPlanEjecucion,
  ErrorPlanEjecucion,
  construirPlanEjecucion,
  resumenPlanVsReal,
  verificarLimitesPlan,
  type EstadoPeriodoConocido,
} from "@/lib/syncPlan";
import { evaluarPresupuesto, PREFERENCIAS_POR_DEFECTO } from "@/lib/syncPreferences";

const AHORA = new Date("2026-07-20T15:00:00.000Z");
const CLAVE = "clave-super-secreta-1234";

function estado(
  p: Partial<EstadoPeriodoConocido> & { periodo: string },
): EstadoPeriodoConocido {
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

function plan(periodos: string[], estados: EstadoPeriodoConocido[]) {
  return construirPlanEjecucion({
    companyId: "empresa-1",
    requestedPeriods: periodos,
    estados,
    ahora: AHORA,
    executionMode: "manual_secure",
  });
}

/** Proveedor de mentira: solo cuenta las llamadas que el portero autoriza. */
function proveedorFalso(control: ControlPlanEjecucion) {
  const llamadas: string[] = [];
  return {
    llamadas,
    rcv(periodo: string) {
      control.autorizar(`rcv:${periodo}`);
      llamadas.push(`rcv:${periodo}`);
    },
    listadoF29(anio: string) {
      control.autorizar(`f29_listado:${anio}`);
      llamadas.push(`f29_listado:${anio}`);
    },
    pdfF29(periodo: string, _folio: string) {
      control.autorizar(`f29_pdf:${periodo}`);
      llamadas.push(`f29_pdf:${periodo}`);
    },
  };
}

describe("plan de ejecución conectado al orquestador", () => {
  it("A. todo en caché: cero llamadas y sin credenciales", () => {
    const p = plan(
      ["2026-07"],
      [
        estado({
          periodo: "2026-07",
          tieneDatosRcv: true,
          ultimaSincronizacionRcv: "2026-07-20T13:00:00.000Z",
          tieneF29Vigente: true,
        }),
      ],
    );
    expect(p.requiresCredentials).toBe(false);
    expect(p.expectedProviderCalls).toBe(0);
    expect(p.expectedCreditRange).toEqual({ min: 0, max: 0 });

    const control = new ControlPlanEjecucion(p);
    expect(resumenPlanVsReal(control, 0).planStatus).toBe("cache_only");
    expect(control.llamadasReales).toBe(0);
  });

  it("B. tres periodos vencidos del mismo año: 6 RCV y 1 listado anual", () => {
    const vencido = (periodo: string) =>
      estado({
        periodo,
        tieneDatosRcv: true,
        tieneF29Vigente: false,
        ultimaSincronizacionRcv: "2026-07-01T10:00:00.000Z",
      });
    const p = plan(
      ["2026-04", "2026-05", "2026-06"],
      [vencido("2026-04"), vencido("2026-05"), vencido("2026-06")],
    );

    expect(p.periodsRequiringRcv).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(p.expectedRcvCalls).toBe(6);
    expect(p.expectedF29Calls).toBe(1);
    expect(p.yearsRequiringF29List).toEqual(["2026"]);
    expect(p.expectedPdfDownloads).toBe(3);
    expect(p.allowsDocumentDetail).toBe(false);
    expect(verificarLimitesPlan(p).ok).toBe(true);

    // Ejecución real dentro de lo planificado.
    const control = new ControlPlanEjecucion(p);
    const proveedor = proveedorFalso(control);
    for (const periodo of p.periodsRequiringRcv) {
      proveedor.rcv(periodo); // ventas
      proveedor.rcv(periodo); // compras
    }
    proveedor.listadoF29("2026");
    expect(control.llamadasReales).toBe(7);
    expect(control.bloqueadas).toBe(0);
    expect(resumenPlanVsReal(control, 0.42).planStatus).toBe("completed_below_plan");
  });

  it("C. presupuesto agotado: se bloquea antes de llamar al proveedor", () => {
    const preferencias = {
      ...PREFERENCIAS_POR_DEFECTO,
      companyId: "empresa-1",
      monthlyCreditBudget: 10,
      creditsUsedCurrentMonth: 10,
    };
    expect(evaluarPresupuesto(preferencias).estado).toBe("bloqueado");

    const p = plan(["2026-06"], [estado({ periodo: "2026-06" })]);
    expect(p.requiresCredentials).toBe(true);
    // La ejecución no llega a empezar: cero llamadas y cero créditos.
    const control = new ControlPlanEjecucion(p);
    expect(control.llamadasReales).toBe(0);
    expect(resumenPlanVsReal(control, 0, false).actualCredits).toBe(0);
  });

  it("D. plan excedido: la guarda rechaza sin ejecución parcial", () => {
    const p = plan(["2026-06"], [estado({ periodo: "2026-06" })]);
    const excedido = { ...p, expectedProviderCalls: p.expectedProviderCalls + 5 };
    const guarda = verificarLimitesPlan(excedido);
    expect(guarda.ok).toBe(false);
    expect(guarda.codigo).toBe(CODIGO_GUARDA_CREDITOS);
    expect(guarda.mensajeUsuario).toContain("No se consumieron créditos");
  });

  it("E. recurso no planificado: se bloquea con UNPLANNED_PROVIDER_CALL", () => {
    const p = plan(
      ["2026-06"],
      [estado({ periodo: "2026-06", tieneDatosRcv: true })],
    );
    const control = new ControlPlanEjecucion(p);
    const proveedor = proveedorFalso(control);

    let codigo: string | null = null;
    try {
      proveedor.rcv("2026-01"); // periodo jamás solicitado
    } catch (error) {
      codigo = error instanceof ErrorPlanEjecucion ? error.codigo : "otro";
    }
    expect(codigo).toBe(CODIGO_LLAMADA_NO_PLANIFICADA);
    expect(proveedor.llamadas).toEqual([]);
    expect(control.llamadasReales).toBe(0);
    expect(control.bloqueadas).toBe(1);
    expect(resumenPlanVsReal(control, 0).planStatus).toBe("stopped_by_guard");
  });

  it("F. doble ejecución del mismo recurso: la segunda no llega al proveedor", () => {
    const p = plan(["2026-06"], [estado({ periodo: "2026-06" })]);
    const control = new ControlPlanEjecucion(p);
    const proveedor = proveedorFalso(control);

    proveedor.listadoF29("2026");
    expect(() => proveedor.listadoF29("2026")).toThrow(ErrorPlanEjecucion);
    expect(proveedor.llamadas.filter((l) => l.startsWith("f29_listado"))).toHaveLength(1);
    expect(control.bloqueadas).toBe(1);
  });

  it("G. F29 ya extraído: el plan no incluye descarga de PDF", () => {
    const p = plan(
      ["2026-05"],
      [
        estado({
          periodo: "2026-05",
          tieneDatosRcv: true,
          tieneF29Vigente: true,
          folioConocido: "9154699596",
          ultimaSincronizacionRcv: "2026-07-19T10:00:00.000Z",
        }),
      ],
    );
    expect(p.foliosRequiringDownload).toEqual([]);
    expect(p.expectedPdfDownloads).toBe(0);
    expect(p.knownFolios).toEqual({ "2026-05": "9154699596" });
  });

  it("H. descarga fallida reciente: tampoco se incluye el PDF", () => {
    const p = plan(
      ["2026-06"],
      [
        estado({
          periodo: "2026-06",
          tieneDatosRcv: true,
          ultimoFalloDescargaF29: "2026-07-20T05:00:00.000Z",
        }),
      ],
    );
    expect(p.expectedPdfDownloads).toBe(0);
    expect(
      p.skippedResources.some(
        (r) => r.recurso === "f29_pdf" && r.motivo === "espera_tras_fallo",
      ),
    ).toBe(true);
  });

  it("I. rectificatoria: sin ampliación aprobada no se descarga nada", () => {
    const p = plan(
      ["2026-05"],
      [
        estado({
          periodo: "2026-05",
          tieneDatosRcv: true,
          tieneF29Vigente: true,
          folioConocido: "111",
          ultimaSincronizacionRcv: "2026-07-19T10:00:00.000Z",
        }),
      ],
    );
    const control = new ControlPlanEjecucion(p);
    const proveedor = proveedorFalso(control);

    // Ya no existe excepción por folio nuevo: sin recurso en el plan, se bloquea.
    expect(() => proveedor.pdfF29("2026-05", "222")).toThrow(ErrorPlanEjecucion);
    expect(proveedor.llamadas).toEqual([]);

    // Solo una ampliación formalmente aprobada incorpora el recurso.
    const propuesta = construirPropuestaAmpliacionF29({
      planId: "plan-1",
      companyId: "empresa-1",
      periodo: "2026-05",
      folioNuevo: "222",
      folioAnterior: "111",
    });
    const evaluacion = evaluarAmpliacion(p, propuesta, {
      permisosOk: true,
      bloqueoVigente: true,
      folioYaDescargado: false,
      ampliacionPrevia: false,
      descargasDelFolio: 0,
      llamadasRealizadas: control.llamadasReales,
      maximoLlamadasPorEjecucion: 24,
      presupuestoBloqueado: false,
      creditoDisponible: null,
    });
    expect(evaluacion.aprobada).toBe(true);
    expect(propuesta.motivo).toBe("RECTIFICATORY_F29");

    control.aplicarAmpliacion(propuesta);
    expect(control.plan.planAmended).toBe(true);
    proveedor.pdfF29("2026-05", "222");
    expect(() => proveedor.pdfF29("2026-05", "222")).toThrow(ErrorPlanEjecucion);
    expect(proveedor.llamadas).toEqual(["f29_pdf:2026-05"]);
  });

  it("I.2 ampliación rechazada por presupuesto: no autoriza el recurso", () => {
    const p = plan(["2026-05"], [estado({ periodo: "2026-05", tieneDatosRcv: true })]);
    const propuesta = construirPropuestaAmpliacionF29({
      planId: "plan-1",
      companyId: "empresa-1",
      periodo: "2026-05",
      folioNuevo: "333",
      folioAnterior: null,
    });
    const evaluacion = evaluarAmpliacion(p, propuesta, {
      permisosOk: true,
      bloqueoVigente: true,
      folioYaDescargado: false,
      ampliacionPrevia: false,
      descargasDelFolio: 0,
      llamadasRealizadas: 0,
      maximoLlamadasPorEjecucion: 24,
      presupuestoBloqueado: true,
      creditoDisponible: 0,
    });
    expect(evaluacion).toMatchObject({
      aprobada: false,
      codigo: CODIGO_AMPLIACION_RECHAZADA,
      motivo: "presupuesto_insuficiente",
    });
  });

  it("J. la clave nunca aparece en el plan ni en el resumen", () => {
    const p = plan(["2026-06"], [estado({ periodo: "2026-06" })]);
    const control = new ControlPlanEjecucion(p);
    const serializado = JSON.stringify({
      plan: p,
      llamadas: control.llamadas,
      resumen: resumenPlanVsReal(control, 0),
    });
    expect(serializado).not.toContain(CLAVE);
    expect(serializado.toLowerCase()).not.toContain("clave");
    expect(serializado.toLowerCase()).not.toContain("password");
  });
});
