import { describe, expect, it } from "vitest";

import {
  aPeriodoCompacto,
  esPeriodoValido,
  etiquetaPeriodo,
  mismoPeriodo,
  normalizarPeriodo,
  periodoAnterior,
  periodoSiguiente,
} from "@/lib/periodo";

/**
 * El periodo tributario nunca se convierte a fecha. Estas pruebas no consultan
 * API Gateway ni ningún servicio externo.
 */
describe("periodo tributario como texto inmutable", () => {
  it("enero no se transforma en diciembre", () => {
    expect(normalizarPeriodo("2026-01")).toBe("2026-01");
    expect(aPeriodoCompacto("2026-01")).toBe("202601");
  });

  it("marzo no se transforma en febrero", () => {
    expect(normalizarPeriodo("2026-03")).toBe("2026-03");
    expect(aPeriodoCompacto("2026-03")).toBe("202603");
  });

  it("diciembre no cambia de año", () => {
    expect(aPeriodoCompacto("2025-12")).toBe("202512");
    expect(periodoSiguiente("2025-12")).toBe("2026-01");
    expect(periodoAnterior("2026-01")).toBe("2025-12");
  });

  it("el periodo permanece igual entre frontend y backend", () => {
    const delSelector = "2026-01"; // valor de <input type="month">
    const enviado = normalizarPeriodo(delSelector);
    const proveedor = aPeriodoCompacto(enviado!);
    expect(enviado).toBe("2026-01");
    expect(proveedor).toBe("202601");
    expect(mismoPeriodo(enviado, proveedor)).toBe(true);
  });

  it("America/Santiago no modifica el periodo tributario", () => {
    const original = process.env.TZ;
    for (const zona of ["America/Santiago", "UTC", "Pacific/Kiritimati"]) {
      process.env.TZ = zona;
      expect(normalizarPeriodo("2026-01")).toBe("2026-01");
      expect(aPeriodoCompacto("2026-01")).toBe("202601");
      expect(periodoAnterior("2026-01")).toBe("2025-12");
    }
    process.env.TZ = original;
  });

  it("recorre 24 meses sin desplazarse", () => {
    let p = "2025-01";
    const vistos: string[] = [];
    for (let i = 0; i < 24; i += 1) {
      vistos.push(p);
      p = periodoSiguiente(p);
    }
    expect(vistos[0]).toBe("2025-01");
    expect(vistos[11]).toBe("2025-12");
    expect(vistos[12]).toBe("2026-01");
    expect(p).toBe("2027-01");
    vistos.forEach((v) => expect(esPeriodoValido(v)).toBe(true));
  });

  it("acepta formatos equivalentes y rechaza basura", () => {
    expect(normalizarPeriodo("202601")).toBe("2026-01");
    expect(normalizarPeriodo("2026-01-01")).toBe("2026-01");
    expect(normalizarPeriodo(" 2026-01 ")).toBe("2026-01");
    expect(normalizarPeriodo("2026-13")).toBeNull();
    expect(normalizarPeriodo("enero")).toBeNull();
    expect(normalizarPeriodo(null)).toBeNull();
  });

  it("etiqueta legible sin fechas", () => {
    expect(etiquetaPeriodo("2026-01")).toBe("enero de 2026");
    expect(etiquetaPeriodo("2025-12")).toBe("diciembre de 2025");
  });
});
