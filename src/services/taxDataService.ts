import type { EscenarioId } from "@/types/company";
import type { DashboardData } from "@/types/tax";
import type { AdditionalSaleInput, AdditionalSaleResult } from "@/types/engine";

export interface ConsultaDashboard {
  escenario: EscenarioId;
  periodoId: string;
  margenPorcentaje: number;
  dineroReservado: number | null;
  metaMensual: number | null;
  /** Solo en modo autenticado (Lovable Cloud). */
  companyId?: string | null;
}

/**
 * Contrato de datos de la aplicación.
 * Lo implementan `mockTaxDataService` (modo demostración) y
 * `cloudTaxDataService` (modo autenticado sobre Lovable Cloud).
 */
export interface TaxDataService {
  readonly esDemo: boolean;
  obtenerDashboard(consulta: ConsultaDashboard): Promise<DashboardData>;
  /** Simulación pura: nunca modifica datos persistidos. */
  simulateAdditionalSale(entrada: AdditionalSaleInput): AdditionalSaleResult;
  sincronizar(companyId?: string | null, periodoId?: string | null): Promise<string>;
}
