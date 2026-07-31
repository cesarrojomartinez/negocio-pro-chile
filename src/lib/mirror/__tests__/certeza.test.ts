import { describe, expect, it } from "vitest";

import {
  aValorTributario,
  clasificarAusenciaTributaria,
  evaluarCertezaPeriodo,
  evaluarCero,
  resolverProcedencia,
  valoresTributarios,
} from "../certainty";
import { ejecutarMotorEspejo } from "../engine";
import { CASOS_DORADOS } from "../fixtures/goldenCases";
import { construirContextoOficial } from "../officialContext";
import { auditarCeros, politicaCero, validarPoliticaCero } from "../zeroPolicy";
import type { ComponentCalculation, MirrorConcept } from "../types";

function componente(p: Partial<ComponentCalculation>): ComponentCalculation {
  return {
    concept: "vat_debit",
    amount: null,
    status: "requires_confirmation",
    ruleId: "VAT_DEBIT_FROM_RCV_SUMMARY",
    ruleVersion: "1.0.0",
    sources: [],
    calculationDescription: "",
    inputValues: {},
    missingInputs: [],
    warnings: [],
    confidence: "unknown",
    calculatedAt: "2026-07-31T00:00:00.000Z",
    ...p,
  };
}

describe("clasificación de ausencias tributarias", () => {
  it("antecedente faltante", () => {
    expect(
      clasificarAusenciaTributaria({
        amount: null,
        status: "requires_confirmation",
        missingInputs: ["ppm_rate"],
      }).absenceReason,
    ).toBe("MISSING_INPUT");
  });

  it("componente no soportado", () => {
    expect(
      clasificarAusenciaTributaria({ amount: null, status: "unsupported" }).absenceReason,
    ).toBe("UNSUPPORTED_INPUT");
  });

  it("componente no aplicable", () => {
    expect(
      clasificarAusenciaTributaria({ amount: null, status: "not_applicable" }).absenceReason,
    ).toBe("NOT_APPLICABLE");
  });

  it("antecedentes contradictorios aunque exista monto", () => {
    expect(
      clasificarAusenciaTributaria({
        amount: 0.1,
        status: "official",
        warnings: ["tasa_ppm_incoherente_con_base_y_monto"],
      }).absenceReason,
    ).toBe("CONFLICTING_INPUT");
  });

  it("un monto sano no tiene ausencia", () => {
    expect(
      clasificarAusenciaTributaria({ amount: 1000, status: "official" }).absenceReason,
    ).toBeNull();
  });
});

describe("cero explícito frente a cero inventado", () => {
  it("el cero del F29 es un cero real", () => {
    const v = aValorTributario(
      componente({ amount: 0, status: "official", sources: ["f29:89"] }),
    );
    expect(v.explicitlyReportedZero).toBe(true);
    expect(v.zeroKind).toBe("explicit_source_zero");
    expect(v.sourceStatus).toBe("official_form");
  });

  it("el cero calculado con antecedentes completos es válido", () => {
    const v = aValorTributario(
      componente({
        concept: "vat_determined",
        amount: 0,
        status: "estimated",
        ruleId: "VAT_POSITION",
        sources: ["mirror:vat_debit"],
      }),
    );
    expect(v.zeroKind).toBe("calculated_zero");
    expect(validarPoliticaCero(v)).toEqual([]);
  });

  it("un cero con antecedentes faltantes no es un cero real", () => {
    const v = aValorTributario(
      componente({
        amount: 0,
        status: "estimated",
        sources: ["mirror:vat_debit"],
        missingInputs: ["previous_carryforward"],
      }),
    );
    expect(v.explicitlyReportedZero).toBe(false);
    expect(validarPoliticaCero(v).length).toBeGreaterThan(0);
  });

  it("la tasa de PPM en cero nunca es válida", () => {
    const v = aValorTributario(
      componente({
        concept: "ppm_rate",
        ruleId: "PPM_RATE",
        amount: 0,
        status: "official",
        sources: ["f29:115"],
      }),
    );
    expect(politicaCero("PPM_RATE")).toBe("zero_forbidden");
    expect(validarPoliticaCero(v)).toContain("cero_no_valido_para_PPM_RATE");
  });

  it("evaluarCero exige respaldo de la procedencia", () => {
    expect(evaluarCero({ amount: 0, status: "estimated", missingInputs: [] }, "missing")).toEqual({
      explicitlyReportedZero: false,
      zeroKind: null,
    });
  });

  it("un monto distinto de cero nunca se marca como cero explícito", () => {
    expect(
      evaluarCero({ amount: 15, status: "official", missingInputs: [] }, "official_form")
        .explicitlyReportedZero,
    ).toBe(false);
  });
});

describe("procedencia real del dato", () => {
  const casos: [string[], string][] = [
    [["f29:538"], "official_form"],
    [["previous_f29:77"], "inherited_official"],
    [["f29_history:573"], "statistical_estimate"],
    [["payment_evidence"], "confirmed_by_person"],
    [["utm"], "configured"],
    [["mirror:vat_debit"], "deterministic_calculation"],
  ];
  for (const [sources, esperado] of casos) {
    it(`${sources[0]} → ${esperado}`, () => {
      expect(
        resolverProcedencia({ amount: 1, status: "official", sources, warnings: [] }),
      ).toBe(esperado);
    });
  }

  it("sin fuente y sin monto la procedencia es ausente", () => {
    expect(
      resolverProcedencia({ amount: null, status: "requires_confirmation", sources: [], warnings: [] }),
    ).toBe("missing");
  });
});

describe("certeza del periodo", () => {
  it("un periodo sin antecedentes no puede presentar total", () => {
    const r = ejecutarMotorEspejo({
      period: "2026-07",
      facts: [],
      official: null,
      previousOfficial: null,
      calculatedAt: "2026-07-31T00:00:00.000Z",
    });
    const certeza = evaluarCertezaPeriodo("2026-07", valoresTributarios(r));
    expect(certeza.canPresentTotal).toBe(false);
    expect(certeza.completeness).toBe("blocked");
    expect(certeza.blockingConcepts).toContain("vat_debit");
    expect(certeza.confidence).toBe("unknown");
  });

  it("un F29 real entrega un periodo presentable y sin ceros inventados", () => {
    const caso = CASOS_DORADOS[0];
    const r = ejecutarMotorEspejo({
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
    const valores = [...valoresTributarios(r).values()];
    const certeza = evaluarCertezaPeriodo(caso.period, valores);
    expect(certeza.canPresentTotal).toBe(true);
    for (const auditoria of auditarCeros(valores)) {
      expect({ c: auditoria.concept, v: auditoria.violations }).toEqual({
        c: auditoria.concept,
        v: [],
      });
    }
  });

  it("todos los casos dorados: ningún componente con monto queda sin procedencia", () => {
    for (const caso of CASOS_DORADOS) {
      const r = ejecutarMotorEspejo({
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
      for (const v of valoresTributarios(r).values()) {
        if (v.amount == null) {
          expect({ c: v.concept, r: v.absenceReason }).not.toEqual({
            c: v.concept,
            r: null,
          });
        } else {
          expect({ c: v.concept, s: v.sourceStatus }).not.toEqual({
            c: v.concept,
            s: "missing",
          });
        }
      }
    }
  });

  it("un componente sin monto nunca puede mostrarse como cifra", () => {
    const v = aValorTributario(componente({ amount: null }));
    expect(v.canBeShownAsAmount).toBe(false);
    expect(v.completeness).toBe("incomplete");
  });

  it("los conceptos críticos se informan como bloqueantes", () => {
    const certeza = evaluarCertezaPeriodo("2026-07", [
      aValorTributario(componente({ concept: "vat_debit" as MirrorConcept, amount: null })),
    ]);
    expect(certeza.blockingConcepts).toContain("ppm_amount");
    expect(certeza.reason).toContain("Faltan componentes esenciales");
  });
});
