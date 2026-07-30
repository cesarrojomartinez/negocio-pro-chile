import { describe, expect, it } from "vitest";
import { mapearError, esReintentable } from "../apiGatewayClient";
import { construirCuerpoAuth } from "../apiGatewaySiiProviderAdapter";
import { rutConGuion } from "@/lib/rut";

describe("formato de RUT para API Gateway", () => {
  it("entrega el RUT sin puntos y con guion", () => {
    expect(rutConGuion("77.976.228-9")).toBe("77976228-9");
    expect(rutConGuion("779762289")).toBe("77976228-9");
    expect(rutConGuion("12.345.678-k")).toBe("12345678-K");
  });

  it("arma el cuerpo exacto auth.pass.rut / auth.pass.clave", () => {
    const cuerpo = construirCuerpoAuth("11.111.111-1", "secreta");
    expect(cuerpo).toEqual({ auth: { pass: { rut: "11111111-1", clave: "secreta" } } });
    expect(Object.keys(cuerpo)).toEqual(["auth"]);
  });
});

describe("clasificación de errores HTTP 400", () => {
  it("un 400 con JSON de validación es INVALID_REQUEST, no MALFORMED_RESPONSE", () => {
    expect(mapearError(400, "El campo rut es requerido", true)).toBe("INVALID_REQUEST");
    expect(mapearError(400, "Solicitud rechazada", true)).toBe("INVALID_REQUEST");
  });

  it("un 400 con cuerpo que no es JSON sí es MALFORMED_RESPONSE", () => {
    expect(mapearError(400, "<html>error</html>", false)).toBe("MALFORMED_RESPONSE");
  });

  it("reconoce credenciales, acceso a la empresa y mantención", () => {
    expect(mapearError(400, "RUT o clave incorrectos", true)).toBe("INVALID_CREDENTIALS");
    expect(mapearError(400, "El usuario no tiene acceso a la empresa", true)).toBe(
      "COMPANY_ACCESS_DENIED",
    );
    expect(mapearError(503, "SII en mantención", true)).toBe("SII_MAINTENANCE");
  });

  it("nunca reintenta un 400 y sí reintenta caídas transitorias", () => {
    expect(esReintentable("INVALID_REQUEST", 400)).toBe(false);
    expect(esReintentable("INVALID_CREDENTIALS", 401)).toBe(false);
    expect(esReintentable("PROVIDER_UNAVAILABLE", 503)).toBe(true);
    expect(esReintentable("TIMEOUT", 408)).toBe(true);
  });
});
