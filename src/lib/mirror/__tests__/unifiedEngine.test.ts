import { describe, expect, it } from "vitest";

import { ejecutarMotorEspejo, montoDe } from "../engine";
import { CASOS_DORADOS } from "../fixtures/goldenCases";
import { construirContextoOficial } from "../officialContext";
import {
  clasificarDivergencia,
  proyectarCompatibilidad,
} from "../legacyProjection";
import { ejecutarMotorUnificado, montoUnificado } from "../unifiedTaxEngine";
import {
  MODOS_UNIFICADOS_PERMITIDOS,
  resolverModoUnificado,
  rollbackAModoSombra,
} from "../unifiedEngineMode";
import type { GoldenTaxCase } from "../types";

function entrada(caso: GoldenTaxCase) {
  return {
    period: caso.period,
    facts: [],
    official: construirContextoOficial({
      period: caso.period,
      codes: caso.codes,
      folio: caso.f29Folio,
      declarationStatus: caso.declarationStatus,
      extractionStatus: caso.extractionStatus,
      confidence: "medium" as const,
      source: caso.source,
    }),
    previousOfficial: null,
    calculatedAt: "2026-07-31T00:00:00.000Z",
  };
}

describe("núcleo único de cálculo", () => {
  it("reproduce el Motor Espejo componente a componente en los 15 casos dorados", () => {
    for (const caso of CASOS_DORADOS) {
      const espejo = ejecutarMotorEspejo(entrada(caso));
      const unificado = ejecutarMotorUnificado(entrada(caso));
      for (const c of espejo.components) {
        expect({
          caso: caso.caseId,
          concepto: c.concept,
          monto: montoUnificado(unificado, c.concept),
        }).toEqual({
          caso: caso.caseId,
          concepto: c.concept,
          monto: montoDe(espejo, c.concept),
        });
      }
    }
  });

  it("cada componente deja traza de regla, versión, redondeo y fuentes", () => {
    const u = ejecutarMotorUnificado(entrada(CASOS_DORADOS[0]));
    expect(u.calculationTrace.length).toBe(u.components.length);
    for (const t of u.calculationTrace) {
      expect(t.ruleId.length).toBeGreaterThan(0);
      expect(t.ruleVersion.length).toBeGreaterThan(0);
      expect(["none", "round_to_peso"]).toContain(t.roundingRule);
      for (const f of t.sources) expect(f.length).toBeLessThanOrEqual(64);
    }
  });

  it("respeta el orden del grafo: una dependencia se calcula antes", () => {
    const u = ejecutarMotorUnificado(entrada(CASOS_DORADOS[0]));
    const orden = u.calculationTrace.map((t) => t.concept);
    expect(orden.indexOf("vat_debit")).toBeLessThan(orden.indexOf("vat_determined"));
    expect(orden.indexOf("ppm_base")).toBeLessThan(orden.indexOf("ppm_amount"));
    expect(orden.indexOf("vat_determined")).toBeLessThan(
      orden.indexOf("tax_total_before_surcharges"),
    );
  });

  it("no inventa ceros: sin antecedentes los montos quedan en null", () => {
    const u = ejecutarMotorUnificado({
      period: "2026-07",
      facts: [],
      official: null,
      previousOfficial: null,
      calculatedAt: "2026-07-31T00:00:00.000Z",
    });
    expect(montoUnificado(u, "vat_debit")).toBeNull();
    expect(montoUnificado(u, "tax_total_before_surcharges")).toBeNull();
    expect(u.certainty.canPresentTotal).toBe(false);
    expect(u.certainty.blockingConcepts.length).toBeGreaterThan(0);
  });
});

describe("proyección de compatibilidad", () => {
  it("entrega números para el contrato antiguo y registra cada fallback", () => {
    const u = ejecutarMotorUnificado({
      period: "2026-07",
      facts: [],
      official: null,
      previousOfficial: null,
      calculatedAt: "2026-07-31T00:00:00.000Z",
    });
    const p = proyectarCompatibilidad(u);
    expect(p.values.ivaDebito).toBe(0);
    expect(p.values.totalTributarioEstimado).toBe(0);
    expect(p.legacyFallbackApplied).toBe(true);
    expect(p.legacyFallbacks.map((f) => f.concept)).toContain("vat_debit");
    // El núcleo no se altera: sigue declarando el desconocido.
    expect(montoUnificado(u, "vat_debit")).toBeNull();
  });

  it("panadería junio 2026: conserva las cifras oficiales y aísla el anticipo", () => {
    const caso = CASOS_DORADOS.find(
      (c) => c.period === "2026-06" && c.codes["91"] === 748454,
    );
    expect(caso).toBeDefined();
    const u = ejecutarMotorUnificado(entrada(caso!));
    expect(caso!.codes["538"]).toBe(2_890_086);
    expect(caso!.codes["537"]).toBe(1_599_611);
    expect(caso!.codes["504"]).toBe(15_046);
    expect(caso!.codes["89"]).toBe(1_290_475);
    expect(caso!.codes["62"]).toBe(15_288);
    expect(montoUnificado(u, "vat_advance_change_of_subject")).not.toBeNull();
    const p = proyectarCompatibilidad(u);
    expect(p.officialDeclaredTotal).toBe(748_454);
    expect(p.values.ivaEstimado).toBe(1_290_475);
    expect(p.values.ppmEstimado).toBe(15_288);
  });

  it("clasifica las divergencias sin reproducir errores del motor antiguo", () => {
    expect(
      clasificarDivergencia({
        concept: "vat_debit",
        legacyValue: 100,
        unifiedValue: 100,
      }).kind,
    ).toBe("expected_legacy_compatibility");

    expect(
      clasificarDivergencia({
        concept: "ppm_amount",
        legacyValue: 1001,
        unifiedValue: 1000,
      }).kind,
    ).toBe("rounding_difference");

    expect(
      clasificarDivergencia({
        concept: "recoverable_vat_credit",
        legacyValue: 2_000_000,
        unifiedValue: 1_900_000,
      }).kind,
    ).toBe("intentional_rule_improvement");

    expect(
      clasificarDivergencia({
        concept: "withholdings",
        legacyValue: 0,
        unifiedValue: null,
      }).kind,
    ).toBe("known_legacy_bug");

    expect(
      clasificarDivergencia({
        concept: "withholdings",
        legacyValue: 0,
        unifiedValue: null,
        legacyFallbackApplied: true,
      }).kind,
    ).toBe("missing_input_handling");
  });
});

describe("modos del núcleo unificado", () => {
  it("parte en el modo seguro y nunca escala a authoritative", () => {
    expect(resolverModoUnificado(null)).toBe("shadow");
    expect(resolverModoUnificado("authoritative")).toBe("shadow");
    expect(MODOS_UNIFICADOS_PERMITIDOS).not.toContain("authoritative");
  });

  it("el rollback devuelve el control al modo sombra", () => {
    expect(resolverModoUnificado("shadow")).toBe("shadow");
    expect(rollbackAModoSombra()).toBe("shadow");
  });
});
