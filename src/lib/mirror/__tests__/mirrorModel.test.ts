import { describe, expect, it } from "vitest";

import { ejecutarMotorEspejo, componente, montoDe } from "../engine";
import { construirContextoOficial, evaluarRectificatoria } from "../officialContext";
import { MIRROR_NORMALIZATION_VERSION, type NormalizedTaxFact } from "../types";
import { normalizarResumenRcv, deduplicarHechos, numeroONulo } from "../normalize";
import { resolverModoMotorEspejo, puedeEscribirResultadosProductivos } from "../flags";

const BASE = {
  period: "2026-07",
  facts: [] as NormalizedTaxFact[],
  official: null,
  previousOfficial: null,
  calculatedAt: "2026-07-31T00:00:00.000Z",
};

describe("null versus cero", () => {
  it("un código ausente queda en null, no en cero", () => {
    const r = ejecutarMotorEspejo({
      ...BASE,
      official: construirContextoOficial({ period: "2026-07", codes: { "89": 1000 } }),
    });
    expect(montoDe(r, "vat_determined")).toBe(1000);
    expect(montoDe(r, "withholdings")).toBeNull();
    expect(componente(r, "withholdings")?.missingInputs).toContain("withholdings_source");
  });

  it("un código explícitamente en cero se conserva como cero", () => {
    const r = ejecutarMotorEspejo({
      ...BASE,
      official: construirContextoOficial({ period: "2026-07", codes: { "89": 0, "151": 0, "528": 0 } }),
    });
    expect(montoDe(r, "vat_determined")).toBe(0);
    expect(montoDe(r, "withholdings")).toBe(0);
    expect(montoDe(r, "vat_non_recoverable")).toBe(0);
  });

  it("una tasa desconocida no se reemplaza por la del mes anterior sin marcarla", () => {
    const sinTasa = ejecutarMotorEspejo({ ...BASE });
    expect(montoDe(sinTasa, "ppm_rate")).toBeNull();

    const conAnterior = ejecutarMotorEspejo({
      ...BASE,
      previousOfficial: construirContextoOficial({ period: "2026-06", codes: { "115": 0.03 } }),
    });
    expect(montoDe(conAnterior, "ppm_rate")).toBe(0.03);
    expect(componente(conAnterior, "ppm_rate")?.status).toBe("estimated");
    expect(componente(conAnterior, "ppm_rate")?.warnings).toContain("tasa_ppm_de_periodo_anterior");
  });

  it("el remanente desconocido queda en null", () => {
    const r = ejecutarMotorEspejo({ ...BASE });
    expect(montoDe(r, "previous_nominal_carryforward")).toBeNull();
    expect(montoDe(r, "vat_determined")).toBeNull();
    expect(componente(r, "vat_determined")?.missingInputs).toContain("previous_carryforward");
  });

  it("el normalizador conserva null y cero explícito", () => {
    expect(numeroONulo(null)).toBeNull();
    expect(numeroONulo(0)).toBe(0);
    const hechos = normalizarResumenRcv(
      {
        lines: [
          {
            documentTypeCode: 33,
            documentCount: 2,
            netAmount: 1000,
            vatAmount: 190,
            exemptAmount: 0,
            vatCommonUse: null,
            vatNonRecoverable: null,
            totalAmount: 1190,
            taxEffect: 1,
          },
        ],
        netAmount: 1000,
        vatAmount: 190,
        exemptAmount: 0,
        totalAmount: 1190,
        unclassifiedAmount: 0,
      },
      "sales",
      { period: "2026-07", source: "rcv" },
    );
    expect(hechos).toHaveLength(2);
    expect(hechos[0].exemptAmount).toBe(0);
    expect(hechos[0].vatCommonUse).toBeNull();
    expect(hechos[0].normalizationVersion).toBe(MIRROR_NORMALIZATION_VERSION);
    expect(deduplicarHechos([...hechos, ...hechos])).toHaveLength(2);
  });
});

describe("remanente en modo sombra", () => {
  it("sin factor UTM el remanente reajustado queda sin soporte, nunca con factor 1", () => {
    const r = ejecutarMotorEspejo({
      ...BASE,
      official: construirContextoOficial({ period: "2026-07", codes: { "504": 100000 } }),
    });
    expect(montoDe(r, "previous_nominal_carryforward")).toBe(100000);
    expect(montoDe(r, "adjustment_factor")).toBeNull();
    expect(componente(r, "adjustment_factor")?.status).toBe("unsupported");
    expect(montoDe(r, "adjusted_previous_carryforward")).toBeNull();
    expect(componente(r, "adjusted_previous_carryforward")?.status).toBe("unsupported");
  });

  it("con factor informado el remanente reajustado se calcula", () => {
    const r = ejecutarMotorEspejo({
      ...BASE,
      official: construirContextoOficial({ period: "2026-07", codes: { "504": 100000 } }),
      utmAdjustmentFactor: 1.004,
    });
    expect(montoDe(r, "adjusted_previous_carryforward")).toBe(100400);
  });
});

describe("declarado versus pagado", () => {
  it("un F29 presentado informa el total declarado pero no el pago", () => {
    const r = ejecutarMotorEspejo({
      ...BASE,
      official: construirContextoOficial({
        period: "2026-07",
        codes: { "91": 748454, "547": 748454, "89": 1290475 },
        declarationStatus: "filed",
      }),
    });
    expect(componente(r, "official_declared_total")?.status).toBe("official");
    expect(montoDe(r, "official_declared_total")).toBe(748454);
    expect(montoDe(r, "confirmed_paid_total")).toBeNull();
    expect(componente(r, "confirmed_paid_total")?.status).toBe("unavailable");
  });

  it("con evidencia independiente el pago queda confirmado", () => {
    const r = ejecutarMotorEspejo({
      ...BASE,
      official: construirContextoOficial({ period: "2026-07", codes: { "91": 748454 } }),
      paymentEvidence: { amount: 748454 },
    });
    expect(componente(r, "confirmed_paid_total")?.status).toBe("confirmed");
    expect(montoDe(r, "confirmed_paid_total")).toBe(748454);
  });

  it("el contexto oficial nunca infiere pago desde el código 91", () => {
    const ctx = construirContextoOficial({
      period: "2026-07",
      codes: { "91": 748454 },
      declarationStatus: "filed",
    });
    expect(ctx.paymentStatus).toBe("unknown");
  });
});

describe("confianza de rectificatorias", () => {
  it("una extracción parcial queda como candidata y no reemplaza la vigente", () => {
    const candidato = construirContextoOficial({
      period: "2026-06",
      codes: { "91": 1 },
      folio: "999",
      declarationStatus: "filed",
      extractionStatus: "partial",
      confidence: "low",
    });
    const vigente = construirContextoOficial({
      period: "2026-06",
      codes: { "91": 748454 },
      folio: "9154699596",
      declarationStatus: "filed",
      extractionStatus: "valid",
      confidence: "medium",
    });
    const e = evaluarRectificatoria(candidato, vigente);
    expect(e.promotionStatus).toBe("candidate");
    expect(e.candidateFolio).toBe("999");
    expect(e.currentOfficialFolio).toBe("9154699596");
  });

  it("una extracción válida puede promoverse", () => {
    const candidato = construirContextoOficial({
      period: "2026-06",
      codes: { "91": 2 },
      folio: "1000",
      declarationStatus: "rectified",
      extractionStatus: "valid",
      confidence: "high",
    });
    expect(evaluarRectificatoria(candidato, null).promotionStatus).toBe("promoted");
  });
});

describe("bandera del motor espejo", () => {
  it("solo permite modo sombra", () => {
    expect(resolverModoMotorEspejo({ configured: "authoritative" }).modo).toBe("shadow_only");
    expect(resolverModoMotorEspejo({ configured: "replace_current_engine" }).modo).toBe("shadow_only");
    expect(resolverModoMotorEspejo({ isProduction: true }).habilitado).toBe(false);
    expect(resolverModoMotorEspejo({ isProduction: false }).habilitado).toBe(true);
    expect(puedeEscribirResultadosProductivos()).toBe(false);
  });
});
