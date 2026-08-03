/**
 * Registro y Abstracción Única de Proveedores Tributarios (TaxProvider Architecture).
 *
 * Permite conectar Gateway, SimpleAPI, Mock o futuros proveedores
 * manteniendo desacoplado el motor tributario y el resto del sistema.
 */
import type {
  ProviderConnection,
  ProviderF29Entry,
  ProviderPurchasesResult,
  ProviderQuery,
  ProviderSalesResult,
  ProviderWithholdingsResult,
  SiiAuthMethod,
  SiiProviderAdapter,
  SiiProviderId,
} from "./contracts";

export interface HealthCheckResult {
  status: "available" | "unavailable" | "timeout" | "invalid_credentials" | "down";
  latencyMs: number;
  mensaje: string;
}

/**
 * Interfaz universal para proveedores de datos tributarios.
 * Extiende `SiiProviderAdapter` garantizando compatibilidad total con la arquitectura existente.
 */
export interface TaxProvider extends SiiProviderAdapter {
  login?(rut?: string, clave?: string): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;
}

export class TaxProviderRegistry {
  private static providers = new Map<SiiProviderId, TaxProvider>();

  static register(provider: TaxProvider): void {
    this.providers.set(provider.id, provider);
  }

  static get(id: SiiProviderId): TaxProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Proveedor tributario no registrado: ${id}`);
    }
    return provider;
  }

  static has(id: SiiProviderId): boolean {
    return this.providers.has(id);
  }

  static list(): SiiProviderId[] {
    return Array.from(this.providers.keys());
  }
}
