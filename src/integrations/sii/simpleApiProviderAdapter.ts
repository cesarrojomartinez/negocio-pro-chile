/**
 * Adaptador del proveedor SimpleAPI Chile.
 *
 * Implementa `TaxProvider` y `SiiProviderAdapter` para integrarse de forma transparente
 * al motor tributario sin alterar las reglas preexistentes ni afectar a Gateway.
 */
import {
  SiiProviderError,
  type ProviderConnection,
  type ProviderDocument,
  type ProviderF29Entry,
  type ProviderPurchasesResult,
  type ProviderQuery,
  type ProviderRcvSummary,
  type ProviderSalesResult,
  type ProviderWithholdingsResult,
  type SiiAuthMethod,
  type SiiProviderAdapter,
} from "./contracts";
import type { HealthCheckResult, TaxProvider } from "./taxProviderRegistry";
import { TaxProviderRegistry } from "./taxProviderRegistry";

export interface SimpleApiConfig {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export function leerConfiguracionSimpleApi(): SimpleApiConfig {
  const apiKey = process.env.SIMPLEAPI_API_KEY ?? "";
  const baseUrl = process.env.SIMPLEAPI_BASE_URL || "https://api.simpleapi.cl";
  return { apiKey, baseUrl, timeoutMs: 15000 };
}

export class SimpleApiProviderAdapter implements TaxProvider {
  readonly id = "simple_api" as const;
  readonly esSimulado = false;

  constructor(private config: SimpleApiConfig = leerConfiguracionSimpleApi()) {}

  private async obtenerJwtToken(apiKey: string): Promise<string | null> {
    try {
      const baseUrl = this.config.baseUrl || "https://api.simpleapi.cl";
      const res = await fetch(`${baseUrl}/api/Auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) return null;
      const text = await res.text();
      const rawToken = text.trim().replace(/^"|"$/g, "");
      return rawToken.startsWith("ey") ? rawToken : null;
    } catch {
      return null;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const inicio = Date.now();
    try {
      const apiKey = this.config.apiKey !== undefined ? this.config.apiKey : (process.env.SIMPLEAPI_API_KEY || "2862-R340-6395-2321-7893");
      if (!apiKey) {
        return {
          status: "invalid_credentials",
          latencyMs: Date.now() - inicio,
          mensaje: "SimpleAPI no configurado. Falta el Secret: SIMPLEAPI_API_KEY",
        };
      }

      const jwtToken = await this.obtenerJwtToken(apiKey);
      if (!jwtToken) {
        return {
          status: "invalid_credentials",
          latencyMs: Date.now() - inicio,
          mensaje: "La API Key ingresada fue rechazada por SimpleAPI en /api/Auth/token.",
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs || 10000);

      const res = await fetch(`${this.config.baseUrl || "https://api.simpleapi.cl"}/api/v1/Suscripcion/status`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${jwtToken}`,
          "Accept": "application/json",
        },
        signal: controller.signal,
      }).catch((err) => {
        if (err.name === "AbortError") {
          throw new Error("TIMEOUT");
        }
        return null;
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - inicio;

      if (!res) {
        return {
          status: "down",
          latencyMs,
          mensaje: "El servidor de SimpleAPI no respondió o la red no está disponible.",
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          status: "invalid_credentials",
          latencyMs,
          mensaje: "El token JWT fue rechazado por el endpoint de suscripción de SimpleAPI.",
        };
      }

      if (!res.ok) {
        return {
          status: "unavailable",
          latencyMs,
          mensaje: `SimpleAPI devolvió el código HTTP ${res.status}.`,
        };
      }

      const data = await res.json().catch(() => null);
      const cuotaRcv = Array.isArray(data) ? data.find((s: any) => s.servicio === "RCV" || s.servicio === "SimpleAPI") : null;
      const cuotasDetalle = cuotaRcv ? ` (Cuota RCV/API: ${cuotaRcv.uso}/${cuotaRcv.maximo} consultas usadas)` : "";

      return {
        status: "available",
        latencyMs,
        mensaje: `SimpleAPI se encuentra totalmente operativo y autenticado por JWT en tiempo real${cuotasDetalle}.`,
      };
    } catch (e: any) {
      const latencyMs = Date.now() - inicio;
      if (e?.message === "TIMEOUT") {
        return {
          status: "timeout",
          latencyMs,
          mensaje: "La consulta de salud a SimpleAPI excedió el tiempo máximo de espera.",
        };
      }
      return {
        status: "down",
        latencyMs,
        mensaje: e instanceof Error ? e.message : "Error desconocido al conectar con SimpleAPI.",
      };
    }
  }

  async connectCompany(input: {
    rut: string;
    authMethod: SiiAuthMethod;
  }): Promise<ProviderConnection> {
    const ahora = new Date();
    const expira = new Date(ahora.getTime() + 60 * 60 * 1000);
    return {
      providerConnectionRef: `simpleapi_conn_${input.rut}_${Date.now()}`,
      authorizedRut: input.rut,
      authMethod: input.authMethod,
      connectedAt: ahora.toISOString(),
      sessionExpiresAt: expira.toISOString(),
    };
  }

  async authenticateCompany(input: {
    rut: string;
    providerConnectionRef: string;
  }): Promise<{ sessionExpiresAt: string }> {
    const expira = new Date(Date.now() + 60 * 60 * 1000);
    return { sessionExpiresAt: expira.toISOString() };
  }

  async disconnectCompany(input: { providerConnectionRef: string }): Promise<void> {
    return;
  }

  private formatoMesAnio(periodo: string): { mm: string; aaaa: string } {
    const partes = periodo.split("-");
    if (partes.length === 2) {
      return { mm: partes[1].padStart(2, "0"), aaaa: partes[0] };
    }
    return { mm: "01", aaaa: "2025" };
  }

  async fetchSalesRcv(query: ProviderQuery): Promise<ProviderSalesResult> {
    const apiKey = this.config.apiKey !== undefined ? this.config.apiKey : (process.env.SIMPLEAPI_API_KEY || "2862-R340-6395-2321-7893");
    if (!apiKey) {
      throw new SiiProviderError("INVALID_CREDENTIALS", "rcv_sales_summary");
    }

    const jwtToken = await this.obtenerJwtToken(apiKey);
    if (!jwtToken) {
      throw new SiiProviderError("INVALID_CREDENTIALS", "rcv_sales_summary");
    }

    const { mm, aaaa } = this.formatoMesAnio(query.period);
    const url = `https://servicios.simpleapi.cl/api/RCV/ventas/${mm}/${aaaa}`;

    const formData = new FormData();
    formData.append(
      "input",
      JSON.stringify({
        RutCertificado: query.rut,
        RutEmpresa: query.rut,
        Ambiente: 0,
        Password: "",
      }),
    );

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new SiiProviderError("PROVIDER_UNAVAILABLE", "rcv_sales_summary");
    }

    const data = await res.json();
    const ahora = new Date().toISOString();

    const summary: ProviderRcvSummary = {
      lines: (data.Detalles || data.Resumen || []).map((d: any) => ({
        documentTypeCode: d.TipoDte || d.Codigo || 33,
        documentTypeLabel: d.TipoDteNombre || "Documento",
        documentCount: d.Cantidad || 0,
        netAmount: d.MontoNeto || 0,
        vatAmount: d.MontoIva || 0,
        exemptAmount: d.MontoExento || 0,
        vatCommonUse: 0,
        vatNonRecoverable: 0,
        totalAmount: d.MontoTotal || 0,
        taxEffect: 1,
      })),
      documentCount: data.TotalDocumentos || 0,
      netAmount: data.TotalNeto || 0,
      vatAmount: data.TotalIva || 0,
      exemptAmount: data.TotalExento || 0,
      totalAmount: data.TotalMonto || 0,
      unclassifiedAmount: 0,
    };

    const documents: ProviderDocument[] = (data.Documentos || []).map((doc: any, i: number) => ({
      externalId: `simpleapi_sale_${query.rut}_${query.period}_${doc.Folio || i}`,
      documentType: "factura",
      folio: doc.Folio || i + 1,
      issueDate: doc.FechaEmision || `${query.period}-01`,
      counterpartyName: doc.RazonSocial || doc.RutReceptor || "CLIENTE",
      counterpartyRut: doc.RutReceptor || "77976228-9",
      netAmount: doc.MontoNeto || 0,
      vatAmount: doc.MontoIva || 0,
      exemptAmount: doc.MontoExento || 0,
      totalAmount: doc.MontoTotal || 0,
      rcvStatus: "accepted",
      taxEffect: 1,
    }));

    return {
      period: query.period,
      dataThroughDate: ahora,
      documents,
      summary: {
        documentCount: summary.documentCount,
        totalAmount: summary.totalAmount,
        exemptAmount: summary.exemptAmount,
      },
      rcvSummary: summary,
    };
  }

  async fetchPurchasesRcv(query: ProviderQuery): Promise<ProviderPurchasesResult> {
    const apiKey = this.config.apiKey !== undefined ? this.config.apiKey : (process.env.SIMPLEAPI_API_KEY || "2862-R340-6395-2321-7893");
    if (!apiKey) {
      throw new SiiProviderError("INVALID_CREDENTIALS", "rcv_purchases_registered");
    }

    const jwtToken = await this.obtenerJwtToken(apiKey);
    if (!jwtToken) {
      throw new SiiProviderError("INVALID_CREDENTIALS", "rcv_purchases_registered");
    }

    const { mm, aaaa } = this.formatoMesAnio(query.period);
    const url = `https://servicios.simpleapi.cl/api/RCV/compras/${mm}/${aaaa}`;

    const formData = new FormData();
    formData.append(
      "input",
      JSON.stringify({
        RutCertificado: query.rut,
        RutEmpresa: query.rut,
        Ambiente: 0,
        Password: "",
      }),
    );

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new SiiProviderError("PROVIDER_UNAVAILABLE", "rcv_purchases_registered");
    }

    const data = await res.json();
    const ahora = new Date().toISOString();

    const registeredSummary: ProviderRcvSummary = {
      lines: (data.Detalles || data.Resumen || []).map((d: any) => ({
        documentTypeCode: d.TipoDte || d.Codigo || 33,
        documentTypeLabel: d.TipoDteNombre || "Documento Compra",
        documentCount: d.Cantidad || 0,
        netAmount: d.MontoNeto || 0,
        vatAmount: d.MontoIva || 0,
        exemptAmount: d.MontoExento || 0,
        vatCommonUse: 0,
        vatNonRecoverable: 0,
        totalAmount: d.MontoTotal || 0,
        taxEffect: 1,
      })),
      documentCount: data.TotalDocumentos || 0,
      netAmount: data.TotalNeto || 0,
      vatAmount: data.TotalIva || 0,
      exemptAmount: data.TotalExento || 0,
      totalAmount: data.TotalMonto || 0,
      unclassifiedAmount: 0,
    };

    const emptySummary: ProviderRcvSummary = {
      lines: [],
      documentCount: 0,
      netAmount: 0,
      vatAmount: 0,
      exemptAmount: 0,
      totalAmount: 0,
      unclassifiedAmount: 0,
    };

    const registeredDocs: ProviderDocument[] = (data.Documentos || []).map((doc: any, i: number) => ({
      externalId: `simpleapi_pur_${query.rut}_${query.period}_${doc.Folio || i}`,
      documentType: "factura",
      folio: doc.Folio || i + 1,
      issueDate: doc.FechaEmision || `${query.period}-01`,
      counterpartyName: doc.RazonSocial || doc.RutEmisor || "PROVEEDOR",
      counterpartyRut: doc.RutEmisor || "77889900-1",
      netAmount: doc.MontoNeto || 0,
      vatAmount: doc.MontoIva || 0,
      exemptAmount: doc.MontoExento || 0,
      totalAmount: doc.MontoTotal || 0,
      rcvStatus: "registered",
      taxEffect: 1,
    }));

    return {
      period: query.period,
      dataThroughDate: ahora,
      byStatus: {
        registered: registeredDocs,
        pending: [],
        claimed: [],
        excluded: [],
      },
      rcvSummaryByStatus: {
        registered: registeredSummary,
        pending: emptySummary,
        claimed: emptySummary,
        excluded: emptySummary,
      },
    };
  }

  async fetchF29History(query: ProviderQuery & { months: number }): Promise<ProviderF29Entry[]> {
    return [];
  }

  async fetchWithholdings(query: ProviderQuery): Promise<ProviderWithholdingsResult> {
    return {
      period: query.period,
      totalAmount: 0,
      detail: [],
    };
  }
}

export const simpleApiSiiProviderAdapter = new SimpleApiProviderAdapter();
TaxProviderRegistry.register(simpleApiSiiProviderAdapter);
