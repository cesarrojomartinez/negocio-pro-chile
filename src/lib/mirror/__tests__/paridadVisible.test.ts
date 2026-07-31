import { describe, expect, it } from "vitest";

import { construirDashboard } from "@/lib/dashboardBuilder";
import {
  EMPRESA_DEMO,
  ESCENARIOS,
  PERIODOS,
  obtenerPeriodoData,
  periodoAnteriorDe,
} from "@/data/mockTaxData";

/**
 * Paridad productiva de la Etapa 6.8.
 *
 * Congela todas las cifras hoy visibles para cada escenario y periodo. Si la
 * activación del núcleo unificado cambiara un solo peso mostrado, esta prueba
 * falla. Los snapshots no deben actualizarse para ocultar una diferencia:
 * cada diferencia se revisa y se clasifica.
 */

function cifrasVisibles(escenarioId: string, periodoId: string) {
  const data = obtenerPeriodoData(escenarioId as never, periodoId);
  const anteriorId = periodoAnteriorDe(periodoId);
  const d = construirDashboard({
    empresa: EMPRESA_DEMO,
    periodo: data,
    periodoAnterior: anteriorId
      ? obtenerPeriodoData(escenarioId as never, anteriorId)
      : null,
    idPeriodoAnterior: anteriorId,
    margenPorcentaje: data.margenPorcentaje ?? 10,
    dineroReservado: data.dineroReservado,
    metaMensual: data.metaMensual,
    esDemo: true,
    calculadoEn: "2026-07-31T00:00:00.000Z",
  });

  return {
    ventasTotales: d.resumen.ventasTotales,
    comprasTotales: d.resumen.comprasTotales,
    ivaDebito: d.resumen.ivaDebito,
    ivaCredito: d.resumen.ivaCredito,
    remanenteAnterior: d.resumen.remanenteAnterior,
    ivaEstimado: d.resumen.ivaEstimado,
    nuevoRemanente: d.resumen.nuevoRemanente,
    ppmEstimado: d.resumen.ppmEstimado,
    tasaPpm: d.resumen.tasaPpm,
    retencionesEstimadas: d.resumen.retencionesEstimadas,
    totalTributarioEstimado: d.resumen.totalTributarioEstimado,
    reservaRecomendada: d.resumen.reservaRecomendada,
    dineroReservado: d.resumen.dineroReservado,
    fuentePeriodo: d.fuentePeriodo,
    estadoCalculo: d.contexto.calculation_status,
    confiabilidad: d.confiabilidad,
    totalContexto: d.contexto.estimated_tax_total,
  };
}

describe("paridad de cifras visibles", () => {
  for (const escenario of ESCENARIOS) {
    for (const periodo of PERIODOS) {
      it(`${escenario.id} · ${periodo.id}`, () => {
        expect(cifrasVisibles(escenario.id, periodo.id)).toMatchSnapshot();
      });
    }
  }
});
