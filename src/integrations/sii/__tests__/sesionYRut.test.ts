/**
 * Diagnóstico de autenticación intermitente: sesión vencida vs. clave errónea,
 * formato del RUT y uso puntual de `auth_cache=0`.
 *
 * Todas las pruebas usan un `fetch` simulado: no consumen créditos reales.
 */
import { describe, expect, it, vi } from "vitest";

import { mapearError, requestApiGateway, RegistroConsumo } from "../apiGatewayClient";
import { crearAdaptadorApiGateway } from "../apiGatewaySiiProviderAdapter";
import { construirCuerpoAuth } from "../apiGatewaySiiProviderAdapter";
import { formatearRut, rutConGuion } from "@/lib/rut";
import { mensajeProveedor } from "@/utils/mensajesProveedor";

const RUT_CANONICO = "77976228-9";

describe("formato del RUT", () => {
  it("muestra 77.976.228-9 a partir del valor almacenado", () => {
    expect(formatearRut("779762289")).toBe("77.976.228-9");
    expect(formatearRut("77976228-9")).toBe("77.976.228-9");
    expect(formatearRut("77.976.228-9")).toBe("77.976.228-9");
  });

  it("nunca produce 7.797-62289", () => {
    for (const entrada of ["779762289", "77976228-9", "77.976.228-9", " 779762289 "])
      expect(formatearRut(entrada)).not.toBe("7.797-62289");
  });

  it("auth.pass.rut mantiene 77976228-9 y la clave no se transforma", () => {
    const clave = "  Clave Con Espacios  ";
    const cuerpo = construirCuerpoAuth("77.976.228-9", clave);
    expect(cuerpo).toEqual({ auth: { pass: { rut: RUT_CANONICO, clave } } });
    expect(rutConGuion("7.797-62289")).toBe(RUT_CANONICO);
  });
});

describe("clasificación de errores", () => {
  it("una sesión vencida no se clasifica como clave incorrecta", () => {
    expect(mapearError(401, "Debe volver a autenticar la sesión", true)).toBe(
      "SESSION_INVALID",
    );
    expect(mapearError(401, "Error de autenticación en el portal", true, true)).toBe(
      "SESSION_INVALID",
    );
  });

  it("solo el rechazo explícito de RUT o clave es INVALID_CREDENTIALS", () => {
    expect(mapearError(401, "RUT o clave incorrectos", true)).toBe(
      "INVALID_CREDENTIALS",
    );
  });

  it("los mensajes visibles distinguen sesión de credenciales", () => {
    expect(
      mensajeProveedor({ proveedor: "api_gateway", codigo: "SESSION_INVALID" }).texto,
    ).toContain("sesión del SII utilizada por el proveedor venció");
    expect(
      mensajeProveedor({ proveedor: "api_gateway", codigo: "INVALID_CREDENTIALS" })
        .texto,
    ).toBe("El SII rechazó las credenciales ingresadas.");
    expect(
      mensajeProveedor({ proveedor: "api_gateway", codigo: "INVALID_REQUEST" }).texto,
    ).toBe("La solicitud enviada al proveedor no tenía el formato esperado.");
    expect(
      mensajeProveedor({ proveedor: "api_gateway", codigo: "COMPANY_ACCESS_DENIED" })
        .texto,
    ).toBe(
      "Las credenciales son válidas, pero no tienen autorización para consultar esta empresa.",
    );
  });
});

const config = {
  baseUrl: "https://app.apigateway.cl/api/v2/",
  token: "token-de-prueba",
  timeoutMs: 5_000,
};

function respuestaOk() {
  return new Response(JSON.stringify({ data: [] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("auth_cache=0", () => {
  it("la cabecera de problema de sesión se registra y clasifica como sesión", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ detail: "No autorizado" }), {
        status: 401,
        headers: {
          "content-type": "application/json",
          "x-stats-navegadorsessionproblem": "1",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      requestApiGateway({
        config,
        modulo: "rcv_sales_documents",
        metodo: "POST",
        ruta: "sii/rcv/ventas",
        sinReintentos: true,
      }),
    ).rejects.toMatchObject({ code: "SESSION_INVALID" });
    vi.unstubAllGlobals();
  });

  it("se envía una sola vez, solo en el primer recurso", async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(String(url));
      return respuestaOk();
    });
    vi.stubGlobal("fetch", fetchMock);

    const adaptador = crearAdaptadorApiGateway({
      config,
      credenciales: {
        rutEmpresa: "779762289",
        rutUsuario: "779762289",
        claveTributaria: "clave-de-prueba",
      },
      registro: new RegistroConsumo(),
      sesionNueva: true,
    });
    await adaptador.fetchSalesRcv({ rut: "779762289", period: "2026-03" });
    await adaptador.fetchSalesRcv({ rut: "779762289", period: "2026-03" });

    expect(urls.length).toBeGreaterThan(1);
    const conCache0 = urls.filter((u) => u.includes("auth_cache=0"));
    expect(conCache0).toHaveLength(1);
    expect(urls[0]).toContain("auth_cache=0");
    vi.unstubAllGlobals();
  });

  it("no se envía cuando no se pidió sesión nueva", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(String(url));
      return respuestaOk();
    });
    const adaptador = crearAdaptadorApiGateway({
      config,
      credenciales: {
        rutEmpresa: "779762289",
        rutUsuario: "779762289",
        claveTributaria: "clave-de-prueba",
      },
      registro: new RegistroConsumo(),
    });
    await adaptador.fetchSalesRcv({ rut: "779762289", period: "2026-03" });
    expect(urls.some((u) => u.includes("auth_cache=0"))).toBe(false);
    vi.unstubAllGlobals();
  });
});
