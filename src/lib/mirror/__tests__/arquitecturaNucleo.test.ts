import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Prueba arquitectónica de la Etapa 6.8: el cálculo tributario ocurre una
 * sola vez, dentro del núcleo unificado. Los módulos legados pueden seguir
 * existiendo, pero deben quedar marcados como adaptadores de compatibilidad
 * y no pueden introducir fórmulas nuevas.
 */

const raiz = process.cwd();
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");

const NUCLEO = "src/lib/mirror/unifiedTaxEngine.ts";
const LEGADOS = ["src/utils/taxCalculations.ts", "src/lib/taxContext.ts"];

describe("arquitectura del núcleo único", () => {
  it("el núcleo unificado existe y deriva su orden del grafo", () => {
    const src = leer(NUCLEO);
    expect(src).toContain("ordenTopologico");
    expect(src).toContain("aplicarRedondeo");
    expect(src).toMatch(/Dos reglas activas para/);
  });

  it("los módulos legados están marcados como adaptadores de compatibilidad", () => {
    for (const ruta of LEGADOS) {
      const src = leer(ruta);
      expect({ ruta, marcado: src.includes("@deprecated Use UnifiedTaxEngine") }).toEqual({
        ruta,
        marcado: true,
      });
    }
  });

  it("dashboardBuilder no implementa fórmulas tributarias", () => {
    const src = leer("src/lib/dashboardBuilder.ts");
    // Ninguna operación aritmética sobre conceptos tributarios.
    const prohibido = [
      /ivaDebito\s*[-+*]/,
      /ivaCredito\s*[-+*]/,
      /remanenteAnterior\s*[-+*]/,
      /basePpm\s*\*/,
      /tasaPpm\s*\*/,
      /retenciones\w*\s*\+/,
    ];
    for (const patron of prohibido) {
      expect({ patron: patron.source, encontrado: patron.test(src) }).toEqual({
        patron: patron.source,
        encontrado: false,
      });
    }
  });

  it("el núcleo no importa el motor antiguo", () => {
    const src = leer(NUCLEO);
    expect(src).not.toContain("taxCalculations");
    expect(src).not.toContain("taxContext");
    expect(src).not.toContain("dashboardBuilder");
  });

  it("el núcleo no convierte entradas faltantes en cero", () => {
    const src = leer(NUCLEO);
    const lineas = src.split("\n");
    const sospechosas = lineas.filter(
      (l, i) =>
        /(\?\?|\|\|)\s*0\b/.test(l) &&
        !l.includes("TAX_ZERO_JUSTIFIED") &&
        !(lineas[i - 1] ?? "").includes("TAX_ZERO_JUSTIFIED"),
    );
    expect(sospechosas).toEqual([]);
  });

  it("la conversión a cero solo ocurre en el borde de compatibilidad", () => {
    const src = leer("src/lib/mirror/legacyProjection.ts");
    expect(src).toContain("legacyFallbackApplied");
    expect(src).toContain("unknown_as_zero");
  });
});
