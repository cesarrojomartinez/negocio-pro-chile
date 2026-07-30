import { describe, expect, it } from "vitest";

import {
  ORIGEN_F29_CONTADOR,
  interpretarAntecedenteF29,
  resolverTasaPpm,
} from "@/lib/f29Antecedent";
import { determinarFuentePeriodo } from "@/lib/dashboardBuilder";

const F29_CONFIRMADO = {
  declaration_status: "filed",
  declared_vat: 1764974,
  declared_ppm: 248957,
  declared_withholdings: 0,
  declared_total: 2013931,
  vat_carryforward: 0,
  source: "accountant",
  raw_data: { ppm_rate: 0.025, ppm_tax_base: 9958279 },
};

describe("fuente del periodo por empresa y periodo", () => {
  it("mayo 2026 con F29 confirmado y sin RCV real es accountant_confirmed", () => {
    expect(
      determinarFuentePeriodo({
        esDemo: false,
        hayDocumentos: false,
        f29Confirmado: true,
      }),
    ).toBe("accountant_confirmed");
  });

  it("mayo 2026 pasa a rcv_real_plus_accountant al importar el RCV", () => {
    expect(
      determinarFuentePeriodo({ esDemo: false, hayDocumentos: true, f29Confirmado: true }),
    ).toBe("rcv_real_plus_accountant");
  });

  it("junio 2026 con RCV real y F29 confirmado es rcv_real_plus_accountant", () => {
    expect(
      determinarFuentePeriodo({ esDemo: false, hayDocumentos: true, f29Confirmado: true }),
    ).toBe("rcv_real_plus_accountant");
  });

  it("empresa real sin información queda como not_synchronized, nunca mock", () => {
    const fuente = determinarFuentePeriodo({
      esDemo: false,
      hayDocumentos: false,
      f29Confirmado: false,
    });
    expect(fuente).toBe("not_synchronized");
    expect(fuente).not.toBe("mock");
  });

  it("solo la empresa demostrativa entrega fuente mock", () => {
    expect(
      determinarFuentePeriodo({ esDemo: true, hayDocumentos: true, f29Confirmado: true }),
    ).toBe("mock");
  });
});

describe("tasa de PPM por periodo", () => {
  const antecedente = interpretarAntecedenteF29(F29_CONFIRMADO);

  it("usa la tasa del F29 confirmado del propio periodo", () => {
    expect(
      resolverTasaPpm({
        esDemo: false,
        antecedentePeriodo: antecedente,
        tasaConfigurada: 0.006,
        configuracionConfirmada: false,
        tasaConfirmadaPrevia: null,
      }),
    ).toEqual({ tasaPpm: 0.025, fuentePpm: ORIGEN_F29_CONTADOR });
  });

  it("nunca usa la tasa demostrativa de 0,6% en una empresa real", () => {
    const r = resolverTasaPpm({
      esDemo: false,
      antecedentePeriodo: null,
      tasaConfigurada: 0.006,
      configuracionConfirmada: false,
      tasaConfirmadaPrevia: null,
    });
    expect(r).toEqual({ tasaPpm: null, fuentePpm: "unknown" });
  });

  it("hereda la tasa confirmada del periodo anterior y la etiqueta", () => {
    expect(
      resolverTasaPpm({
        esDemo: false,
        antecedentePeriodo: null,
        tasaConfigurada: 0.006,
        configuracionConfirmada: false,
        tasaConfirmadaPrevia: 0.025,
      }),
    ).toEqual({ tasaPpm: 0.025, fuentePpm: "previous_f29" });
  });

  it("respeta una configuración tributaria confirmada", () => {
    expect(
      resolverTasaPpm({
        esDemo: false,
        antecedentePeriodo: null,
        tasaConfigurada: 0.02,
        configuracionConfirmada: true,
        tasaConfirmadaPrevia: 0.025,
      }),
    ).toEqual({ tasaPpm: 0.02, fuentePpm: "configured" });
  });

  it("la empresa demostrativa sí puede usar la tasa demostrativa", () => {
    expect(
      resolverTasaPpm({
        esDemo: true,
        antecedentePeriodo: null,
        tasaConfigurada: 0.006,
        configuracionConfirmada: false,
        tasaConfirmadaPrevia: null,
      }),
    ).toEqual({ tasaPpm: 0.006, fuentePpm: "mock" });
  });
});
