import type { EscenarioId } from "@/types/company";
import type { DashboardData } from "@/types/tax";

export interface ConsultaDashboard {
  escenario: EscenarioId;
  periodoId: string;
  margenPorcentaje: number;
  dineroReservado: number | null;
  metaMensual: number | null;
}

/**
 * Contrato de datos de la aplicación.
 * Hoy lo implementa `mockTaxDataService`; más adelante podrá implementarlo
 * `cloudTaxDataService` (Lovable Cloud + API Gateway) sin cambiar la interfaz.
 */
export interface TaxDataService {
  readonly esDemo: boolean;
  obtenerDashboard(consulta: ConsultaDashboard): Promise<DashboardData>;
  sincronizar(): Promise<string>;
}
