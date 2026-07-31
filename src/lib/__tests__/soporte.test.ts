import { describe, expect, it } from "vitest";

import { prepararReporte, sanitizarTexto } from "@/lib/soporte";

describe("sanitizarTexto", () => {
  it("elimina la clave tributaria escrita por el usuario", () => {
    const s = sanitizarTexto("Mi clave: 1234abcd no funciona");
    expect(s).not.toContain("1234abcd");
    expect(s).toContain("[dato omitido por seguridad]");
  });

  it("elimina contraseñas, tokens y cabeceras de autenticación", () => {
    const s = sanitizarTexto(
      "password=secreto123 Authorization: Bearer abc.def cookie: sb-token=xyz",
    );
    expect(s).not.toContain("secreto123");
    expect(s).not.toContain("xyz");
    expect(s.toLowerCase()).not.toContain("bearer abc");
  });

  it("elimina tokens con forma de JWT", () => {
    const s = sanitizarTexto(
      "falló con eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdef en la sincronización",
    );
    expect(s).not.toContain("eyJhbGciOiJIUzI1NiJ9");
  });

  it("conserva el texto útil del usuario", () => {
    expect(sanitizarTexto("No me aparece el F29 de junio")).toBe(
      "No me aparece el F29 de junio",
    );
  });
});

describe("prepararReporte", () => {
  it("sanitiza mensaje y código antes de guardar", () => {
    const r = prepararReporte({
      companyId: "empresa-1",
      periodo: "2026-06",
      categoria: "conexion",
      mensaje: "clave tributaria: miClave2026 y falla",
      syncRunId: "run-1",
      codigoSanitizado: "token=abc123456",
    });
    expect(r.mensaje).not.toContain("miClave2026");
    expect(r.codigoSanitizado).not.toContain("abc123456");
    expect(r.syncRunId).toBe("run-1");
    expect(r.periodo).toBe("2026-06");
  });
});
