import { describe, expect, it } from "vitest";

import { componente, ejecutarMotorEspejo, montoDe } from "../engine";
import { normalizarResumenRcv } from "../normalize";
import type { NormalizedTaxFact } from "../types";

function comprasConIva(opciones: {
  vat: number;
  commonUse?: number | null;
  nonRecoverable?: number | null;
}): NormalizedTaxFact[] {
  return normalizarResumenRcv(
    {
      lines: [
        {
          documentTypeCode: 33,
          documentCount: 10,
          netAmount: Math.round(opciones.vat / 0.19),
          vatAmount: opciones.vat,
          exemptAmount: 0,
          vatCommonUse: opciones.commonUse ?? null,
          vatNonRecoverable: opciones.nonRecoverable ?? null,
          totalAmount: null,
          taxEffect: 1,
        },
      ],
    },
    "purchases_registry",
    { period: "2026-07", source: "rcv" },
  );
}

function correr(facts: NormalizedTaxFact[], ratio?: number | null) {
  return ejecutarMotorEspejo({
    period: "2026-07",
    facts,
    official: null,
    previousOfficial: null,
    commonUseRecoveryRatio: ratio ?? null,
    calculatedAt: "2026-07-31T00:00:00.000Z",
  });
}

describe("crédito fiscal en modo sombra", () => {
  it("IVA total sin uso común ni no recuperable", () => {
    const r = correr(comprasConIva({ vat: 100000, commonUse: 0, nonRecoverable: 0 }));
    expect(montoDe(r, "vat_total_purchases")).toBe(100000);
    expect(montoDe(r, "vat_common_use")).toBe(0);
    expect(montoDe(r, "vat_non_recoverable")).toBe(0);
    expect(montoDe(r, "recoverable_vat_credit")).toBe(100000);
    expect(componente(r, "recoverable_vat_credit")?.status).toBe("estimated");
  });

  it("IVA con no recuperable: el no recuperable se resta y se conserva aparte", () => {
    const r = correr(comprasConIva({ vat: 100000, commonUse: 0, nonRecoverable: 20000 }));
    expect(montoDe(r, "vat_total_purchases")).toBe(120000);
    expect(montoDe(r, "vat_non_recoverable")).toBe(20000);
    expect(montoDe(r, "recoverable_vat_credit")).toBe(100000);
  });

  it("IVA con uso común y proporción confirmada", () => {
    const r = correr(comprasConIva({ vat: 100000, commonUse: 40000, nonRecoverable: 0 }), 0.6);
    expect(montoDe(r, "vat_total_purchases")).toBe(140000);
    expect(montoDe(r, "recoverable_vat_credit")).toBe(124000);
    expect(componente(r, "recoverable_vat_credit")?.status).toBe("confirmed");
  });

  it("IVA con uso común sin proporción: no se asume recuperación completa", () => {
    const r = correr(comprasConIva({ vat: 100000, commonUse: 40000, nonRecoverable: 0 }));
    const c = componente(r, "recoverable_vat_credit");
    expect(c?.status).toBe("requires_confirmation");
    expect(c?.amount).toBe(100000);
    expect(c?.missingInputs).toContain("common_use_recovery_ratio");
    expect(c?.warnings).toContain("uso_comun_sin_proporcion_confirmada");
  });

  it("combinación de uso común y no recuperable", () => {
    const r = correr(comprasConIva({ vat: 100000, commonUse: 40000, nonRecoverable: 20000 }));
    expect(montoDe(r, "vat_total_purchases")).toBe(160000);
    expect(montoDe(r, "recoverable_vat_credit")).toBe(100000);
    expect(componente(r, "recoverable_vat_credit")?.status).toBe("requires_confirmation");
  });

  it("el IVA determinado hereda la falta de confirmación del crédito", () => {
    const facts = [
      ...comprasConIva({ vat: 100000, commonUse: 40000, nonRecoverable: 0 }),
      ...normalizarResumenRcv(
        {
          lines: [
            {
              documentTypeCode: 33,
              documentCount: 3,
              netAmount: 1000000,
              vatAmount: 190000,
              exemptAmount: 0,
              vatCommonUse: null,
              vatNonRecoverable: null,
              totalAmount: 1190000,
              taxEffect: 1,
            },
          ],
        },
        "sales",
        { period: "2026-07", source: "rcv" },
      ),
    ];
    const r = ejecutarMotorEspejo({
      period: "2026-07",
      facts,
      official: null,
      previousOfficial: null,
      utmAdjustmentFactor: null,
      calculatedAt: "2026-07-31T00:00:00.000Z",
    });
    expect(montoDe(r, "vat_debit")).toBe(190000);
    // Sin remanente conocido no hay IVA determinado: no se rellena con cero.
    expect(montoDe(r, "vat_determined")).toBeNull();
    expect(componente(r, "vat_determined")?.missingInputs).toContain("previous_carryforward");
  });

  it("el IVA retenido por el comprador (DTE 46) no es débito del vendedor", () => {
    const ventas = normalizarResumenRcv(
      {
        lines: [
          {
            documentTypeCode: 33,
            documentCount: 1,
            netAmount: 1000000,
            vatAmount: 190000,
            exemptAmount: 0,
            totalAmount: 1190000,
            taxEffect: 1,
          },
          {
            documentTypeCode: 46,
            documentCount: 1,
            netAmount: 79025,
            vatAmount: 15015,
            exemptAmount: 0,
            totalAmount: 79025,
            taxEffect: 1,
          },
        ],
      },
      "sales",
      { period: "2026-07", source: "rcv" },
    );
    const r = correr(ventas);
    expect(montoDe(r, "vat_debit")).toBe(190000);
    expect(componente(r, "vat_debit")?.inputValues.iva_retenido_por_comprador).toBe(15015);
  });
});
