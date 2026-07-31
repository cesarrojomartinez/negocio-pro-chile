import { describe, expect, it } from "vitest";

import { ejecutarMotorEspejo } from "../engine";
import { CASOS_DORADOS } from "../fixtures/goldenCases";
import { normalizarResumenRcv } from "../normalize";
import { construirContextoOficial } from "../officialContext";
import { proyectarDashboardEspejo } from "../projection";

function conF29(caso: (typeof CASOS_DORADOS)[number]) {
  return ejecutarMotorEspejo({
    period: caso.period,
    facts: [],
    official: construirContextoOficial({
      period: caso.period,
      codes: caso.codes,
      folio: caso.f29Folio,
      declarationStatus: caso.declarationStatus,
      extractionStatus: caso.extractionStatus,
      confidence: "medium",
      source: caso.source,
    }),
    previousOfficial: null,
    calculatedAt: "2026-07-31T00:00:00.000Z",
  });
}

describe("proyección de dashboard en modo sombra", () => {
  it("un periodo vacío no muestra ninguna cifra inventada", () => {
    const p = proyectarDashboardEspejo(
      ejecutarMotorEspejo({
        period: "2026-07",
        facts: [],
        official: null,
        previousOfficial: null,
        calculatedAt: "2026-07-31T00:00:00.000Z",
      }),
    );
    for (const card of p.cards) {
      expect({ c: card.concept, a: card.amount }).toEqual({ c: card.concept, a: null });
      expect(card.placeholder).not.toBeNull();
    }
    expect(p.certainty.canPresentTotal).toBe(false);
  });

  it("con un F29 real se proyectan cifras oficiales y ningún cero espurio", () => {
    const p = proyectarDashboardEspejo(conF29(CASOS_DORADOS[0]));
    const total = p.cards.find((c) => c.concept === "tax_total_before_surcharges");
    expect(total?.presentation).toBe("amount");
    expect(p.zeroAudit.every((z) => z.violations.length === 0)).toBe(true);
  });

  it("solo el RCV: el total no se presenta si falta el remanente", () => {
    const ventas = normalizarResumenRcv(
      {
        lines: [
          {
            documentTypeCode: 33,
            documentCount: 5,
            netAmount: 1000000,
            vatAmount: 190000,
            exemptAmount: 0,
            totalAmount: 1190000,
            taxEffect: 1,
          },
        ],
      },
      "sales",
      { period: "2026-07", source: "rcv" },
    );
    const p = proyectarDashboardEspejo(
      ejecutarMotorEspejo({
        period: "2026-07",
        facts: ventas,
        official: null,
        previousOfficial: null,
        calculatedAt: "2026-07-31T00:00:00.000Z",
      }),
    );
    expect(p.cards.find((c) => c.concept === "vat_debit")?.amount).toBe(190000);
    expect(p.hiddenAmounts).toContain("tax_total_before_surcharges");
    expect(p.certainty.canPresentTotal).toBe(false);
    expect(p.certainty.reason).toContain("Faltan componentes esenciales");
  });

  it("cada tarjeta sin monto explica por qué", () => {
    const p = proyectarDashboardEspejo(
      ejecutarMotorEspejo({
        period: "2026-07",
        facts: [],
        official: null,
        previousOfficial: null,
        calculatedAt: "2026-07-31T00:00:00.000Z",
      }),
    );
    for (const card of p.cards) {
      expect(card.detail.length).toBeGreaterThan(0);
    }
  });

  it("una tasa de PPM incoherente en el F29 anterior no se arrastra", () => {
    const r = ejecutarMotorEspejo({
      period: "2026-07",
      facts: [],
      official: null,
      previousOfficial: construirContextoOficial({
        period: "2026-06",
        // Tasa 10 % con base 15.288.385 y PPM declarado de 15.288: incoherente.
        codes: { "115": 0.1, "563": 15288385, "62": 15288 },
        declarationStatus: "filed",
        extractionStatus: "valid",
        confidence: "medium",
      }),
      calculatedAt: "2026-07-31T00:00:00.000Z",
    });
    const p = proyectarDashboardEspejo(r);
    const tasa = p.cards.find((c) => c.concept === "ppm_rate");
    expect(tasa?.amount).toBeNull();
    expect(tasa?.presentation).toBe("requires_confirmation");
  });
});
