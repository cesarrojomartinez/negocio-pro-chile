import {
  EMPRESA_DEMO,
  obtenerPeriodoData,
  periodoAnteriorDe,
} from "@/data/mockTaxData";
import { construirDashboard } from "@/lib/dashboardBuilder";
import { estadoDelPeriodo, simulateAdditionalSale } from "@/utils/taxCalculations";
import type { ConsultaDashboard, TaxDataService } from "./taxDataService";
import type { DashboardData } from "@/types/tax";
import type { AdditionalSaleInput, AdditionalSaleResult } from "@/types/engine";

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
    const anteriorId = periodoAnteriorDe(consulta.periodoId);

    return construirDashboard({
      empresa: { ...EMPRESA_DEMO, periodoActivo: consulta.periodoId },
      periodo: { ...data, estadoPeriodo: estadoDelPeriodo(consulta.periodoId) },
      periodoAnterior: anteriorId
        ? obtenerPeriodoData(consulta.escenario, anteriorId)
        : null,
      idPeriodoAnterior: anteriorId,
      margenPorcentaje: consulta.margenPorcentaje,
      dineroReservado,
      metaMensual,
      diasDesdeSincronizacion: 0,
      configuradoManualmente: true,
      esDemo: true,
      tasaPpmPersonalizada: consulta.tasaPpmPersonalizada ?? null,
    });
  },

  simulateAdditionalSale(entrada: AdditionalSaleInput): AdditionalSaleResult {
    return simulateAdditionalSale(entrada);
  },

  async sincronizar(): Promise<string> {
    await esperar(1400);
    return new Date().toISOString();
  },
};
