import {
  EMPRESA_DEMO,
  obtenerPeriodoData,
  periodoAnteriorDe,
} from "@/data/mockTaxData";
import type { ConsultaDashboard, TaxDataService } from "./taxDataService";
import type { DashboardData } from "@/types/tax";
import {
  construirComparacion,
  construirMeta,
  construirProyeccion,
  construirResumenCompras,
  construirResumenMensual,
  construirResumenVentas,
} from "@/utils/taxCalculations";

function esperar(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export const mockTaxDataService: TaxDataService = {
  esDemo: true,

  async obtenerDashboard(consulta: ConsultaDashboard): Promise<DashboardData> {
    await esperar(450);

    const data = obtenerPeriodoData(consulta.escenario, consulta.periodoId);
    const dineroReservado = consulta.dineroReservado ?? data.dineroReservado;
    const metaMensual = consulta.metaMensual ?? data.metaMensual;

    const resumen = construirResumenMensual(data, {
      margenPorcentaje: consulta.margenPorcentaje,
      dineroReservado,
    });
    const ventas = construirResumenVentas(data.documentosVenta);
    const compras = construirResumenCompras(data.documentosCompra);
    const meta = construirMeta(data, resumen.ventasTotales, metaMensual);

    const anteriorId = periodoAnteriorDe(consulta.periodoId);
    let anterior: { resumen: typeof resumen; ventas: typeof ventas } | null = null;
    if (anteriorId) {
      const dataAnterior = obtenerPeriodoData(consulta.escenario, anteriorId);
      anterior = {
        resumen: construirResumenMensual(dataAnterior, {
          margenPorcentaje: consulta.margenPorcentaje,
          dineroReservado: dataAnterior.dineroReservado,
        }),
        ventas: construirResumenVentas(dataAnterior.documentosVenta),
      };
    }

    const cargaTributaria =
      resumen.ventasTotales > 0
        ? resumen.reservaRecomendada / resumen.ventasTotales
        : 0;

    return {
      empresa: { ...EMPRESA_DEMO, periodoActivo: consulta.periodoId },
      resumen,
      meta,
      ventas,
      compras,
      confiabilidad:
        compras.documentosPendientes >= 3 ? "media" : data.confiabilidad,
      comparacion: construirComparacion(
        consulta.periodoId,
        { resumen, ventas },
        anterior,
        anteriorId,
      ),
      proyeccion: construirProyeccion(resumen, meta, cargaTributaria),
      documentosVenta: data.documentosVenta,
      documentosCompra: data.documentosCompra,
    };
  },

  async sincronizar(): Promise<string> {
    await esperar(1400);
    return new Date().toISOString();
  },
};
