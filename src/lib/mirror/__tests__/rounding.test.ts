import { describe, expect, it } from "vitest";

import {
  aplicarRedondeo,
  montoPorTasa,
  redondearAPeso,
  yaRedondeado,
} from "../rounding";
import { VERSIONED_TAX_RULES } from "../rules";

describe("política única de redondeo", () => {
  it("redondea medio peso alejándose de cero", () => {
    expect(redondearAPeso(100.49)).toBe(100);
    expect(redondearAPeso(100.5)).toBe(101);
    expect(redondearAPeso(-100.49)).toBe(-100);
    expect(redondearAPeso(-100.5)).toBe(-101);
    expect(redondearAPeso(-0.4)).toBe(0);
    expect(Object.is(redondearAPeso(-0.4), -0)).toBe(false);
  });

  it("la regla none conserva la precisión", () => {
    const r = aplicarRedondeo(0.00625, "none");
    expect(r.value).toBe(0.00625);
    expect(r.changed).toBe(false);
  });

  it("no redondea dos veces", () => {
    const primero = aplicarRedondeo(1234.5, "round_to_peso");
    const segundo = aplicarRedondeo(primero.value, "round_to_peso");
    expect(segundo.value).toBe(primero.value);
    expect(segundo.changed).toBe(false);
    expect(yaRedondeado(primero.value)).toBe(true);
  });

  it("un desconocido nunca se convierte en cero al redondear", () => {
    expect(aplicarRedondeo(null, "round_to_peso").value).toBeNull();
    expect(montoPorTasa(null, 0.006).value).toBeNull();
    expect(montoPorTasa(1_000_000, null).value).toBeNull();
  });

  it("aplica tasas de PPM con precisión completa y un solo redondeo", () => {
    expect(montoPorTasa(9_522_182, 0.006).value).toBe(57_133);
    expect(montoPorTasa(9_522_182, 0.01).value).toBe(95_222);
    expect(montoPorTasa(9_522_182, 0.025).value).toBe(238_055);
    expect(montoPorTasa(15_288_385, 0.001).value).toBe(15_288);
    expect(montoPorTasa(1_234_567, 0.03456).value).toBe(42_667);
  });

  it("respeta montos negativos y notas de crédito", () => {
    expect(montoPorTasa(-1_000_000, 0.006).value).toBe(-6_000);
    expect(aplicarRedondeo(-406_397.5, "round_to_peso").value).toBe(-406_398);
  });

  it("toda regla declara una política de redondeo conocida", () => {
    for (const r of VERSIONED_TAX_RULES) {
      expect(["none", "round_to_peso"]).toContain(r.roundingRule);
    }
  });

  it("las tasas no se redondean a peso", () => {
    const tasa = VERSIONED_TAX_RULES.find((r) => r.concept === "ppm_rate");
    expect(tasa?.roundingRule).toBe("none");
  });
});
