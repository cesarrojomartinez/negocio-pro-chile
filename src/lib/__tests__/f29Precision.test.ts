import { describe, expect, it } from "vitest";

import {
  calcularDesviacionF29,
  resumirPrecision,
  type FilaPrecision,
} from "@/lib/f29Precision";

function fila(
  periodo: string,
  estimado: number,
  oficial: number,
  origen: FilaPrecision["origen"] = "medida",
): FilaPrecision {
  const d = calcularDesviacionF29(estimado, oficial);
  if (!d) throw new Error("desviación no calculable");
  return { periodo, origen, ...d };
}

describe("calcularDesviacionF29", () => {
  it("mide la diferencia y el porcentaje respecto del F29", () => {
    const d = calcularDesviacionF29(828350, 863997);
    expect(d).not.toBeNull();
    expect(d?.diferencia).toBe(-35647);
    expect(d?.porcentaje).toBe(-4.1);
  });

  it("devuelve null cuando falta la estimación o el F29", () => {
    expect(calcularDesviacionF29(null, 1000)).toBeNull();
    expect(calcularDesviacionF29(1000, null)).toBeNull();
  });

  it("no calcula porcentaje si el F29 quedó en cero", () => {
    const d = calcularDesviacionF29(50000, 0);
    expect(d?.diferencia).toBe(50000);
    expect(d?.porcentaje).toBeNull();
  });
});

describe("resumirPrecision", () => {
  it("promedia solo los periodos con porcentaje y ordena del más nuevo al más viejo", () => {
    const r = resumirPrecision([
      fila("2026-01", 110, 100),
      fila("2026-03", 90, 100),
      fila("2026-02", 104, 100),
      fila("2026-04", 500, 0),
    ]);
    expect(r.filas[0].periodo).toBe("2026-04");
    expect(r.muestras).toBe(3);
    expect(r.promedioAbsoluto).toBe(8);
    expect(r.promedioConSigno).toBe(1.3);
    expect(r.peor).toBe(10);
    expect(r.mejor).toBe(4);
    expect(r.suficiente).toBe(true);
  });

  it("marca historial insuficiente con menos de tres periodos", () => {
    const r = resumirPrecision([fila("2026-01", 110, 100), fila("2026-02", 95, 100)]);
    expect(r.muestras).toBe(2);
    expect(r.suficiente).toBe(false);
  });

  it("distingue mediciones exactas de reconstruidas", () => {
    const r = resumirPrecision([
      fila("2026-01", 110, 100, "reconstruida"),
      fila("2026-02", 95, 100),
    ]);
    expect(r.muestrasMedidas).toBe(1);
  });

  it("sin datos no inventa promedios", () => {
    const r = resumirPrecision([]);
    expect(r.muestras).toBe(0);
    expect(r.promedioAbsoluto).toBeNull();
    expect(r.suficiente).toBe(false);
  });
});
