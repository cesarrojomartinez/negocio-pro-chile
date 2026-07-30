/**
 * Adaptador para el futuro proveedor real (API Gateway).
 *
 * Está preparado para recibir la implementación definitiva sin cambiar el
 * resto de la aplicación: mientras no exista configuración, cada método
 * responde con el error normalizado `PROVIDER_NOT_CONFIGURED`.
 *
 * IMPORTANTE: aquí no se guardan ni se piden claves tributarias, ClaveÚnica,
 * certificados ni tokens. Esa integración se hará en una etapa posterior.
 */
import { SiiProviderError, type SiiProviderAdapter } from "./contracts";

function noConfigurado(): never {
  throw new SiiProviderError("PROVIDER_NOT_CONFIGURED", null);
}

export const apiGatewaySiiProviderAdapter: SiiProviderAdapter = {
  id: "api_gateway",
  esSimulado: false,
  async connectCompany() {
    return noConfigurado();
  },
  async authenticateCompany() {
    return noConfigurado();
  },
  async disconnectCompany() {
    return noConfigurado();
  },
  async fetchSalesRcv() {
    return noConfigurado();
  },
  async fetchPurchasesRcv() {
    return noConfigurado();
  },
  async fetchF29History() {
    return noConfigurado();
  },
  async fetchWithholdings() {
    return noConfigurado();
  },
};
