import { describe, expect, it } from "vitest";
import { SimpleApiProviderAdapter } from "@/integrations/sii/simpleApiProviderAdapter";
import { TaxProviderRegistry } from "@/integrations/sii/taxProviderRegistry";
import { compararProveedoresTributarios } from "@/lib/providerComparison.server";

describe("SimpleAPI Chile Provider Adapter & Comparison", () => {
  it("debe estar registrado en TaxProviderRegistry con id 'simple_api'", () => {
    const adapter = new SimpleApiProviderAdapter();
    TaxProviderRegistry.register(adapter);

    expect(TaxProviderRegistry.has("simple_api")).toBe(true);
    expect(TaxProviderRegistry.get("simple_api").id).toBe("simple_api");
  });

  it("debe retornar error de credenciales en healthCheck si no hay API Key", async () => {
    const adapter = new SimpleApiProviderAdapter({ apiKey: "", baseUrl: "https://api.simpleapi.cl" });
    const health = await adapter.healthCheck();

    expect(health.status).toBe("invalid_credentials");
    expect(health.mensaje).toContain("SimpleAPI no configurado. Falta el Secret: SIMPLEAPI_API_KEY");
  });

  it("debe retornar formato RCV Ventas correcto con la estructura ProviderSalesResult", async () => {
    const adapter = new SimpleApiProviderAdapter({ apiKey: "test_key_123" });
    const res = await adapter.fetchSalesRcv({
      rut: "77976228-9",
      period: "2026-07",
      providerConnectionRef: "ref_test",
    });

    expect(res.period).toBe("2026-07");
    expect(res.documents.length).toBeGreaterThan(0);
    expect(res.rcvSummary).toBeDefined();
    expect(res.rcvSummary?.vatAmount).toBe(912000);
  });

  it("debe retornar formato RCV Compras correcto con la estructura ProviderPurchasesResult", async () => {
    const adapter = new SimpleApiProviderAdapter({ apiKey: "test_key_123" });
    const res = await adapter.fetchPurchasesRcv({
      rut: "77976228-9",
      period: "2026-07",
      providerConnectionRef: "ref_test",
    });

    expect(res.period).toBe("2026-07");
    expect(res.byStatus.registered.length).toBeGreaterThan(0);
    expect(res.rcvSummaryByStatus?.registered.vatAmount).toBe(570000);
  });

  it("debe ejecutar la comparación dual entre Gateway y SimpleAPI", async () => {
    const res = await compararProveedoresTributarios({
      companyId: "demo-company-id",
      rutEmpresa: "77976228-9",
      periodo: "2026-07",
      usarMockParaGateway: true,
    });

    expect(res.periodo).toBe("2026-07");
    expect(res.gateway).toBeDefined();
    expect(res.simpleApi).toBeDefined();
    expect(res.gateway.proveedor).toBe("Gateway SII");
    expect(res.simpleApi.proveedor).toBe("SimpleAPI Chile");
  });
});
