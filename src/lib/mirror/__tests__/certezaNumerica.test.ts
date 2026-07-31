import { describe, expect, it } from "vitest";

import { interpretarFilaLegada, interpretarValorLegado } from "../legacy";
import {
  coincidenEnPesos,
  multiplicarConocidos,
  pisoCero,
  restarConocidos,
  sumarConocidos,
} from "../numeric";

describe("aritmética tributaria segura", () => {
  it("un operando obligatorio ausente anula la suma", () => {
    const r = sumarConocidos([
      { key: "iva", amount: 1000 },
      { key: "ppm", amount: null },
    ]);
    expect(r.amount).toBeNull();
    expect(r.missingInputs).toEqual(["ppm"]);
    expect(r.complete).toBe(false);
  });

  it("un operando opcional ausente se omite y se registra", () => {
    const r = sumarConocidos([
      { key: "iva", amount: 1000 },
      { key: "anticipo", amount: null, optional: true },
    ]);
    expect(r.amount).toBe(1000);
    expect(r.omittedOptionalInputs).toEqual(["anticipo"]);
    expect(r.complete).toBe(false);
  });

  it("la resta respeta la ausencia del sustraendo", () => {
    expect(
      restarConocidos({ key: "debito", amount: 5000 }, [{ key: "credito", amount: null }]).amount,
    ).toBeNull();
    expect(
      restarConocidos({ key: "debito", amount: 5000 }, [{ key: "credito", amount: 2000 }]).amount,
    ).toBe(3000);
  });

  it("el producto exige ambos factores", () => {
    expect(multiplicarConocidos({ key: "base", amount: 1000 }, { key: "tasa", amount: null }).amount)
      .toBeNull();
    expect(
      multiplicarConocidos({ key: "base", amount: 1000000 }, { key: "tasa", amount: 0.03 }).amount,
    ).toBe(30000);
  });

  it("el piso en cero no crea montos desde la nada", () => {
    expect(pisoCero(sumarConocidos([{ key: "x", amount: null }])).amount).toBeNull();
    expect(pisoCero(sumarConocidos([{ key: "x", amount: -500 }])).amount).toBe(0);
  });

  it("la comparación en pesos devuelve nulo si falta un lado", () => {
    expect(coincidenEnPesos(100, null)).toBeNull();
    expect(coincidenEnPesos(100, 100.4)).toBe(true);
    expect(coincidenEnPesos(100, 130)).toBe(false);
  });
});

describe("interpretación de valores legados", () => {
  const base = { columnDefaultsToZero: true, wasCalculated: true, hasBackingSource: false };

  it("cero nunca calculado es desconocido", () => {
    const r = interpretarValorLegado({ ...base, raw: 0, wasCalculated: false });
    expect(r.amount).toBeNull();
    expect(r.interpretation).toBe("never_calculated");
  });

  it("cero calculado sin fuente sigue siendo desconocido", () => {
    const r = interpretarValorLegado({ ...base, raw: 0 });
    expect(r.amount).toBeNull();
    expect(r.interpretation).toBe("unknown_zero");
    expect(r.trustworthy).toBe(false);
  });

  it("cero respaldado por una fuente es un cero real", () => {
    const r = interpretarValorLegado({ ...base, raw: 0, hasBackingSource: true });
    expect(r.amount).toBe(0);
    expect(r.interpretation).toBe("explicit_zero");
    expect(r.trustworthy).toBe(true);
  });

  it("cero en una columna que admite nulos se respeta", () => {
    const r = interpretarValorLegado({ ...base, raw: 0, columnDefaultsToZero: false });
    expect(r.amount).toBe(0);
  });

  it("valor distinto de cero se conserva", () => {
    expect(interpretarValorLegado({ ...base, raw: 748454 }).amount).toBe(748454);
  });

  it("nulo es ausencia, no cero", () => {
    const r = interpretarValorLegado({ ...base, raw: null });
    expect(r.amount).toBeNull();
    expect(r.interpretation).toBe("absent");
  });

  it("interpreta varias columnas de una fila", () => {
    const r = interpretarFilaLegada({
      iva: { ...base, raw: 0, hasBackingSource: true },
      ppm: { ...base, raw: 0 },
    });
    expect(r.iva.amount).toBe(0);
    expect(r.ppm.amount).toBeNull();
  });
});
