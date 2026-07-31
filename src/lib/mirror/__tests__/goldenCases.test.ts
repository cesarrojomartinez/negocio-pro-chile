import { describe, expect, it } from "vitest";

import { ejecutarMotorEspejo, montoDe } from "../engine";
import { CASOS_DORADOS } from "../fixtures/goldenCases";
import { construirContextoOficial } from "../officialContext";
import type { GoldenExpectedComponents, GoldenTaxCase, MirrorConcept } from "../types";

/**
 * Casos dorados por componente. Cada caso proviene de un F29 real y se evalúa
 * componente a componente: aprobar solo por el total está prohibido.
 */

const MAPA: Partial<Record<keyof GoldenExpectedComponents, MirrorConcept>> = {
  vatDebit: "vat_debit",
  recoverableVatCredit: "recoverable_vat_credit",
  vatNonRecoverable: "vat_non_recoverable",
  previousCarryforward: "previous_nominal_carryforward",
  nextCarryforward: "next_carryforward",
  vatDetermined: "vat_determined",
  ppmBase: "ppm_base",
  ppmRate: "ppm_rate",
  ppm: "ppm_amount",
  withholdings: "withholdings",
  vatAdvance: "vat_advance_change_of_subject",
  surcharges: "surcharges",
  officialSubtotal: "tax_total_before_surcharges",
  code91: "official_declared_total",
};

export function ejecutarCaso(caso: GoldenTaxCase) {
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

describe("casos dorados del Motor Espejo", () => {
  it("cubre al menos catorce F29 reales", () => {
    expect(CASOS_DORADOS.length).toBeGreaterThanOrEqual(14);
    expect(new Set(CASOS_DORADOS.map((c) => c.caseId)).size).toBe(CASOS_DORADOS.length);
  });

  for (const caso of CASOS_DORADOS) {
    describe(caso.caseId, () => {
      const resultado = ejecutarCaso(caso);

      for (const [clave, concepto] of Object.entries(MAPA) as [
        keyof GoldenExpectedComponents,
        MirrorConcept,
      ][]) {
        const esperado = caso.expectedComponents[clave];
        if (esperado === undefined) continue;
        it(`${clave}`, () => {
          const obtenido = montoDe(resultado, concepto);
          if (esperado === null) {
            expect(obtenido).toBeNull();
            return;
          }
          const tolerancia = caso.toleranceByComponent[clave] ?? 0.5;
          expect(obtenido).not.toBeNull();
          expect(Math.abs((obtenido as number) - (esperado as number))).toBeLessThanOrEqual(
            tolerancia,
          );
        });
      }

      it("la reconciliación oficial reproduce el código 91", () => {
        const codigo91 = caso.codes["91"];
        if (codigo91 === undefined) return;
        const declarado = montoDe(resultado, "official_declared_total");
        expect(declarado).toBe(codigo91);
        const subtotal = montoDe(resultado, "tax_total_before_surcharges");
        const recargos = montoDe(resultado, "surcharges");
        if (subtotal != null && recargos != null) {
          expect(subtotal + recargos).toBe(codigo91);
        }
      });

      it("cada componente registra regla y versión", () => {
        for (const c of resultado.components) {
          expect(c.ruleId.length).toBeGreaterThan(0);
          expect(c.ruleVersion.length).toBeGreaterThan(0);
          if (c.amount == null) {
            expect(["requires_confirmation", "unavailable", "unsupported", "not_applicable"]).toContain(
              c.status,
            );
          }
        }
      });

      it("un F29 presentado no acredita pago", () => {
        const pago = resultado.components.find((c) => c.concept === "confirmed_paid_total");
        expect(pago?.amount).toBeNull();
        expect(caso.expectedComponents.paymentStatus).toBe("unknown");
      });
    });
  }
});

describe("identidad oficial del F29", () => {
  it("547 = 89 − 598 + 62 + 151 en cada caso con datos completos", () => {
    for (const caso of CASOS_DORADOS) {
      const c = caso.codes;
      if (c["547"] == null || c["89"] == null || c["62"] == null) continue;
      const total = c["89"] - (c["598"] ?? 0) + c["62"] + (c["151"] ?? 0);
      expect({ caso: caso.caseId, total }).toEqual({ caso: caso.caseId, total: c["547"] });
    }
  });

  it("537 = 511 + 504 cuando ambos vienen informados", () => {
    for (const caso of CASOS_DORADOS) {
      const c = caso.codes;
      if (c["537"] == null || c["511"] == null) continue;
      expect({ caso: caso.caseId, v: c["511"] + (c["504"] ?? 0) }).toEqual({
        caso: caso.caseId,
        v: c["537"],
      });
    }
  });
});
