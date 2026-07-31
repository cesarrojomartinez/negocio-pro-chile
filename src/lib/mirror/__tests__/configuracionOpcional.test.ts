/**
 * Configuración tributaria opcional (Cierre Fase 6).
 *
 * Regla base: sin configuración declarada, el núcleo entrega exactamente el
 * mismo resultado que antes.
 */
import { describe, expect, it } from "vitest";

import {
  configuracionAporta,
  resolverConfiguracionOpcional,
  validarRegistroOpcional,
  type RegistroConfiguracionOpcional,
} from "../optionalConfig";
import { ejecutarMotorUnificado, montoUnificado } from "../unifiedTaxEngine";

function registro(
  parcial: Partial<RegistroConfiguracionOpcional> &
    Pick<RegistroConfiguracionOpcional, "concept">,
): RegistroConfiguracionOpcional {
  return {
    value: null,
    valueText: null,
    unit: "none",
    validFrom: "2026-01-01",
    validTo: null,
    source: "client_declared",
    status: "active",
    ...parcial,
  };
}

describe("configuración tributaria opcional", () => {
  it("sin registros no aporta antecedentes", () => {
    const config = resolverConfiguracionOpcional([], "2026-03");
    expect(config.appliedConcepts).toHaveLength(0);
    expect(configuracionAporta(config)).toBe(false);
    expect(config.ppmRate).toBeNull();
  });

  it("respeta la vigencia declarada y no aplica antes de su inicio", () => {
    const registros = [
      registro({ concept: "ppm_rate", value: 0.015, validFrom: "2026-04-01" }),
    ];
    expect(resolverConfiguracionOpcional(registros, "2026-03").ppmRate).toBeNull();
    expect(resolverConfiguracionOpcional(registros, "2026-04").ppmRate).toBe(0.015);
  });

  it("ante dos vigencias gana la más reciente y no se mezclan", () => {
    const registros = [
      registro({ concept: "ppm_rate", value: 0.01, validFrom: "2026-01-01" }),
      registro({ concept: "ppm_rate", value: 0.02, validFrom: "2026-05-01" }),
    ];
    expect(resolverConfiguracionOpcional(registros, "2026-06").ppmRate).toBe(0.02);
  });

  it("un registro reemplazado o revocado deja de aplicar", () => {
    const registros = [
      registro({ concept: "ppm_rate", value: 0.01, status: "superseded" }),
      registro({ concept: "withholdings_estimate", value: 50_000, status: "revoked" }),
    ];
    const config = resolverConfiguracionOpcional(registros, "2026-06");
    expect(config.ppmRate).toBeNull();
    expect(config.withholdingsEstimate).toBeNull();
  });

  it("rechaza valores fuera de rango en vez de corregirlos", () => {
    const errores = validarRegistroOpcional(
      registro({ concept: "ppm_rate", value: 3, unit: "fraction" }),
    );
    expect(errores.map((e) => e.code)).toContain("fuera_de_rango");
  });

  it("rechaza una vigencia invertida", () => {
    const errores = validarRegistroOpcional(
      registro({
        concept: "withholdings_estimate",
        value: 1000,
        validFrom: "2026-05-01",
        validTo: "2026-01-01",
      }),
    );
    expect(errores.map((e) => e.code)).toContain("vigencia_invertida");
  });

  it("sin configuración el núcleo entrega el mismo resultado que con configuración vacía", () => {
    const base = {
      period: "2026-03",
      facts: [],
      official: null,
      previousOfficial: null,
      calculatedAt: "2026-04-01T00:00:00.000Z",
    };
    const sin = ejecutarMotorUnificado(base);
    const conVacia = ejecutarMotorUnificado({
      ...base,
      optionalConfig: resolverConfiguracionOpcional([], "2026-03"),
    });
    expect(conVacia.components).toEqual(sin.components);
  });

  it("la tasa declarada se usa cuando no hay F29 y queda registrada como declarada", () => {
    const resultado = ejecutarMotorUnificado({
      period: "2026-03",
      facts: [],
      official: null,
      previousOfficial: null,
      optionalConfig: resolverConfiguracionOpcional(
        [registro({ concept: "ppm_rate", value: 0.02, validFrom: "2026-01-01" })],
        "2026-03",
      ),
      calculatedAt: "2026-04-01T00:00:00.000Z",
    });
    expect(montoUnificado(resultado, "ppm_rate")).toBe(0.02);
    const componente = resultado.components.find((c) => c.concept === "ppm_rate");
    expect(componente?.sources).toContain("client_declared:ppm_rate");
    expect(componente?.status).toBe("confirmed");
  });

  it("declarar que no hay cambio de sujeto marca el anticipo como no aplicable", () => {
    const resultado = ejecutarMotorUnificado({
      period: "2026-03",
      facts: [],
      official: null,
      previousOfficial: null,
      optionalConfig: resolverConfiguracionOpcional(
        [
          registro({
            concept: "vat_advance_regime",
            valueText: "no",
            validFrom: "2026-01-01",
          }),
        ],
        "2026-03",
      ),
      calculatedAt: "2026-04-01T00:00:00.000Z",
    });
    const componente = resultado.components.find(
      (c) => c.concept === "vat_advance_change_of_subject",
    );
    expect(componente?.status).toBe("not_applicable");
    // TAX_ZERO_JUSTIFIED: no aplicable no es un monto cero inventado.
    expect(componente?.amount).toBeNull();
  });
});
