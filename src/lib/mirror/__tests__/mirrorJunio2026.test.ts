import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { compararMotores } from "../comparison";
import { componente, ejecutarMotorEspejo, montoDe } from "../engine";
import { casoDorado } from "../fixtures/goldenCases";
import { construirContextoOficial } from "../officialContext";
import { VERSIONED_TAX_RULES } from "../rules";

const CASO = casoDorado("panaderia-2026-06")!;

function correrCaso() {
  return ejecutarMotorEspejo({
    period: CASO.period,
    facts: [],
    official: construirContextoOficial({
      period: CASO.period,
      codes: CASO.codes,
      folio: CASO.f29Folio,
      declarationStatus: "filed",
      extractionStatus: "valid",
      confidence: "medium",
      source: CASO.source,
    }),
    previousOfficial: null,
    calculatedAt: "2026-07-31T00:00:00.000Z",
  });
}

describe("panadería junio 2026 — diferencia explicada por componente", () => {
  const r = correrCaso();

  it("el anticipo por cambio de sujeto es un componente propio", () => {
    const c = componente(r, "vat_advance_change_of_subject");
    expect(c?.concept).toBe("vat_advance_change_of_subject");
    expect(c?.amount).toBe(563607);
    expect(c?.status).toBe("official");
    expect(c?.sources).toContain("f29:598");
  });

  it("no se esconde dentro del crédito, del remanente ni de un ajuste genérico", () => {
    expect(montoDe(r, "recoverable_vat_credit")).toBe(1584565);
    expect(montoDe(r, "previous_nominal_carryforward")).toBe(15046);
    expect(montoDe(r, "vat_determined")).toBe(1290475);
  });

  it("el total reproduce exactamente el código 91", () => {
    expect(montoDe(r, "official_declared_total")).toBe(748454);
    expect(montoDe(r, "tax_total_before_surcharges")).toBe(748454);
    expect(montoDe(r, "surcharges")).toBe(0);
    const iva = montoDe(r, "vat_determined")!;
    const anticipo = montoDe(r, "vat_advance_change_of_subject")!;
    const ppm = montoDe(r, "ppm_amount")!;
    const ret = montoDe(r, "withholdings")!;
    expect(iva - anticipo + ppm + ret).toBe(748454);
  });

  it("la tasa de PPM leída queda marcada como incoherente", () => {
    const c = componente(r, "ppm_rate");
    expect(c?.amount).toBe(0.1);
    expect(c?.warnings).toContain("tasa_ppm_incoherente_con_base_y_monto");
  });

  it("la diferencia del motor actual queda atribuida al anticipo", () => {
    // El motor productivo estimó 1.038.944 antes de conocer el F29.
    const comparacion = compararMotores({
      period: CASO.period,
      mirror: r,
      currentEngine: { vat_determined: 1290475, ppm_amount: 15288, withholdings: 6298 },
      official: {
        vat_determined: 1290475,
        vat_advance_change_of_subject: 563607,
        tax_total_before_surcharges: 748454,
      },
      currentEngineTotal: 1038944,
      officialTotal: 748454,
    });
    expect(comparacion.mirrorVsOfficialDifference).toBe(0);
    expect(comparacion.currentVsOfficialDifference).toBe(290490);
    const anticipo = comparacion.componentDifferences.find(
      (d) => d.concept === "vat_advance_change_of_subject",
    );
    expect(anticipo?.mirrorEngine).toBe(563607);
    expect(anticipo?.currentEngine).toBeNull();
    expect(anticipo?.status).toBe("exact");
    expect(comparacion.comparisonStatus).toBe("exact");
  });

  it("no existe ninguna regla fija para junio de 2026 ni para el monto del anticipo", () => {
    const fuente = readFileSync("src/lib/mirror/rules.ts", "utf8");
    expect(fuente).not.toContain("557309");
    expect(fuente).not.toContain("563607");
    expect(fuente).not.toMatch(/period\s*[=!]==?\s*["'`]20\d\d-/);
    for (const regla of VERSIONED_TAX_RULES) {
      expect(regla.validFrom).toBe("2020-01");
      expect(regla.validTo).toBeNull();
    }
  });

  it("sin códigos de anticipo el concepto queda como no aplicable", () => {
    const sinAnticipo = ejecutarMotorEspejo({
      period: "2026-06",
      facts: [],
      official: construirContextoOficial({
        period: "2026-06",
        codes: { "89": 100000, "62": 5000, "151": 0, "547": 105000, "91": 105000 },
      }),
      previousOfficial: null,
      calculatedAt: "2026-07-31T00:00:00.000Z",
    });
    expect(componente(sinAnticipo, "vat_advance_change_of_subject")?.status).toBe("not_applicable");
    expect(montoDe(sinAnticipo, "tax_total_before_surcharges")).toBe(105000);
  });

  it("sin F29 ni historial el anticipo exige confirmación en vez de inventarse", () => {
    const sinDatos = ejecutarMotorEspejo({
      period: "2026-07",
      facts: [],
      official: null,
      previousOfficial: null,
      calculatedAt: "2026-07-31T00:00:00.000Z",
    });
    const c = componente(sinDatos, "vat_advance_change_of_subject");
    expect(c?.amount).toBeNull();
    expect(c?.status).toBe("requires_confirmation");
    expect(c?.missingInputs).toContain("vat_advance_history");
  });

  it("con historial el anticipo se estima con el remanente oficial y la mediana", () => {
    const conHistorial = ejecutarMotorEspejo({
      period: "2026-07",
      facts: [],
      official: null,
      previousOfficial: null,
      vatAdvanceHistory: [
        { period: "2026-04", monthAdvance: 192052, nextRemainder: 192052 },
        { period: "2026-05", monthAdvance: 200864, nextRemainder: 395360 },
        { period: "2026-06", monthAdvance: 167388, nextRemainder: 0 },
      ],
      calculatedAt: "2026-07-31T00:00:00.000Z",
    });
    const c = componente(conHistorial, "vat_advance_change_of_subject");
    expect(c?.status).toBe("estimated");
    expect(c?.amount).toBe(192052);
    expect(c?.warnings).toContain("anticipo_estimado_sin_f29");
  });
});
