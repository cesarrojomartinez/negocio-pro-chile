import { describe, expect, it } from "vitest";

import {
  crearMockSiiProviderAdapter,
  escenarioDeRut,
  ESCENARIOS_PROVEEDOR,
  type EscenarioProveedor,
} from "@/integrations/sii/mockSiiProviderAdapter";
import {
  normalizarCompras,
  normalizarF29,
  normalizarRetenciones,
  normalizarVentas,
} from "@/integrations/sii/normalizeProviderData";
import { SiiProviderError } from "@/integrations/sii/contracts";
import { apiGatewaySiiProviderAdapter } from "@/integrations/sii/apiGatewaySiiProviderAdapter";
import { decidirSincronizacion } from "@/lib/syncPolicy";

const RUT = "76.412.980-1";
const PERIODO = "2026-05";

function consulta() {
  return { rut: RUT, period: PERIODO, providerConnectionRef: "mock-conn-test" };
}

describe("proveedor SII simulado", () => {
  it("es determinista: la misma empresa y periodo devuelven lo mismo", async () => {
    const a = crearMockSiiProviderAdapter({ escenario: "normal" });
    const b = crearMockSiiProviderAdapter({ escenario: "normal" });
    const v1 = await a.fetchSalesRcv(consulta());
    const v2 = await b.fetchSalesRcv(consulta());
    expect(v1).toEqual(v2);
  });

  it("asigna siempre el mismo escenario a un RUT", () => {
    expect(escenarioDeRut(RUT)).toBe(escenarioDeRut(RUT));
    expect(ESCENARIOS_PROVEEDOR).toContain(escenarioDeRut(RUT));
  });

  it("cubre los ocho escenarios deterministas", async () => {
    for (const escenario of ESCENARIOS_PROVEEDOR) {
      const adapter = crearMockSiiProviderAdapter({ escenario });
      if (escenario === "proveedorCaido") {
        await expect(adapter.fetchSalesRcv(consulta())).rejects.toBeInstanceOf(
          SiiProviderError,
        );
        continue;
      }
      const ventas = await adapter.fetchSalesRcv(consulta());
      const compras = await adapter.fetchPurchasesRcv(consulta());
      expect(ventas.period).toBe(PERIODO);
      expect(Array.isArray(ventas.documents)).toBe(true);
      if (escenario === "sinMovimientos") {
        expect(ventas.documents).toHaveLength(0);
        expect(compras.byStatus.registered).toHaveLength(0);
      } else {
        expect(ventas.documents.length).toBeGreaterThan(0);
      }
    }
  });

  it("entrega documentos sin desglose en el escenario incompleto", async () => {
    const adapter = crearMockSiiProviderAdapter({
      escenario: "documentosIncompletos" as EscenarioProveedor,
    });
    const ventas = await adapter.fetchSalesRcv(consulta());
    expect(ventas.documents.some((d) => d.vatAmount == null)).toBe(true);
  });

  it("nunca expone credenciales en la conexión", async () => {
    const adapter = crearMockSiiProviderAdapter({ escenario: "normal" });
    const conexion = await adapter.connectCompany({ rut: RUT, authMethod: "demo" });
    expect(Object.keys(conexion)).toEqual([
      "providerConnectionRef",
      "authorizedRut",
      "authMethod",
      "connectedAt",
      "sessionExpiresAt",
    ]);
  });
});

describe("adaptador de API Gateway", () => {
  it("responde PROVIDER_NOT_CONFIGURED mientras no exista integración real", async () => {
    await expect(
      apiGatewaySiiProviderAdapter.fetchSalesRcv(consulta()),
    ).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED" });
  });
});

describe("normalización", () => {
  it("infiere el IVA cuando el proveedor no lo entrega", () => {
    const r = normalizarVentas({
      period: PERIODO,
      dataThroughDate: `${PERIODO}-31`,
      documents: [
        {
          externalId: "x1",
          documentType: "boleta",
          folio: 1,
          issueDate: `${PERIODO}-03`,
          counterpartyName: "Cliente",
          counterpartyRut: "1-9",
          netAmount: null,
          vatAmount: null,
          exemptAmount: null,
          totalAmount: 119000,
          rcvStatus: "accepted",
        },
      ],
      summary: { documentCount: 1, totalAmount: 119000, exemptAmount: 0 },
    });
    expect(r.inferidos).toBe(1);
    expect(r.documentos[0].net_amount).toBe(100000);
    expect(r.documentos[0].vat_amount).toBe(19000);
  });

  it("descarta documentos fuera del periodo y deduplica por identificador", () => {
    const base = {
      documentType: "factura" as const,
      folio: 10,
      counterpartyName: "Proveedor",
      counterpartyRut: "1-9",
      netAmount: 1000,
      vatAmount: 190,
      exemptAmount: 0,
      totalAmount: 1190,
      rcvStatus: "registered" as const,
    };
    const r = normalizarCompras({
      period: PERIODO,
      dataThroughDate: `${PERIODO}-31`,
      byStatus: {
        registered: [
          { ...base, externalId: "a", issueDate: `${PERIODO}-02` },
          { ...base, externalId: "a", issueDate: `${PERIODO}-05` },
          { ...base, externalId: "b", issueDate: "2020-01-02" },
        ],
        pending: [],
        claimed: [],
        excluded: [],
      },
    });
    expect(r.documentos).toHaveLength(1);
    expect(r.documentos[0].document_date).toBe(`${PERIODO}-05`);
    expect(r.descartados).toHaveLength(1);
  });

  it("no declara montos de F29 no presentados", () => {
    const filas = normalizarF29([
      {
        period: PERIODO,
        status: "not_available",
        declaredVat: 999,
        declaredPpm: 999,
        declaredWithholdings: 999,
        declaredTotal: 999,
        vatCarryforward: 999,
        filedAt: "x",
      },
    ]);
    expect(filas[0].declared_vat).toBeNull();
    expect(filas[0].filed_at).toBeNull();
  });

  it("prefiere la suma del detalle de retenciones", () => {
    const r = normalizarRetenciones({
      period: PERIODO,
      totalAmount: 1,
      detail: [
        { concept: "Honorarios", amount: 1000 },
        { concept: "Otras", amount: 500 },
      ],
    });
    expect(r.total).toBe(1500);
  });
});

describe("política de actualización y caché", () => {
  const ahora = new Date("2026-05-20T12:00:00Z");

  it("consulta siempre cuando no hay datos previos", () => {
    const d = decidirSincronizacion({
      ahora,
      ultimaSincronizacionExitosa: null,
      tipo: "login_refresh",
      periodoCerrado: false,
    });
    expect(d.debeConsultar).toBe(true);
    expect(d.motivo).toBe("sin_datos_previos");
  });

  it("reutiliza la información dentro de las 24 horas al ingresar", () => {
    const d = decidirSincronizacion({
      ahora,
      ultimaSincronizacionExitosa: "2026-05-20T06:00:00Z",
      tipo: "login_refresh",
      periodoCerrado: false,
    });
    expect(d.debeConsultar).toBe(false);
    expect(d.motivo).toBe("cache_vigente");
  });

  it("actualiza los periodos cerrados solo una vez por semana", () => {
    const dentro = decidirSincronizacion({
      ahora,
      ultimaSincronizacionExitosa: "2026-05-16T12:00:00Z",
      tipo: "scheduled",
      periodoCerrado: true,
    });
    const fuera = decidirSincronizacion({
      ahora,
      ultimaSincronizacionExitosa: "2026-05-10T12:00:00Z",
      tipo: "scheduled",
      periodoCerrado: true,
    });
    expect(dentro.debeConsultar).toBe(false);
    expect(fuera.debeConsultar).toBe(true);
    expect(fuera.motivo).toBe("vencio_ventana_semanal");
  });

  it("limita las actualizaciones manuales seguidas", () => {
    const d = decidirSincronizacion({
      ahora,
      ultimaSincronizacionExitosa: "2026-05-20T11:55:00Z",
      tipo: "manual",
      periodoCerrado: false,
    });
    expect(d.debeConsultar).toBe(false);
    expect(d.motivo).toBe("espera_minima_manual");
  });

  it("permite forzar tras la espera mínima", () => {
    const d = decidirSincronizacion({
      ahora,
      ultimaSincronizacionExitosa: "2026-05-20T11:30:00Z",
      tipo: "manual",
      periodoCerrado: false,
    });
    expect(d.debeConsultar).toBe(true);
    expect(d.motivo).toBe("solicitud_manual");
  });
});
