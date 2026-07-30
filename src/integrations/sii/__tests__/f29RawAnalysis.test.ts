import { describe, expect, it } from "vitest";

import {
  analizarPayload,
  enmascararFolio,
  propiedadesDescartadas,
} from "../f29RawAnalysis";

describe("analizarPayload", () => {
  it("describe un listado F29 con la forma documentada", () => {
    const a = analizarPayload([
      { periodo: 202606, folio: "1234567890", fecha: "2026-07-12", estado: "VIGENTE" },
    ]);
    expect(a.tipoRaiz).toBe("array");
    expect(a.envoltura).toBe("(arreglo directo)");
    expect(a.propiedadesPrimerElemento).toEqual(["periodo", "folio", "fecha", "estado"]);
    // Nada tributario: ni PPM, ni remanente, ni códigos.
    expect(a.coincidencias.filter((c) => c.origen === "llave")).toHaveLength(0);
  });

  it("detecta conceptos tributarios cuando sí llegan", () => {
    const a = analizarPayload({
      data: [
        { folio: 1, codigo504: 114353, ppm: { tasa: 0.025, base: 6000000 }, totalAPagar: 863997 },
      ],
    });
    const llaves = a.coincidencias.filter((c) => c.origen === "llave").map((c) => c.ruta);
    expect(llaves).toContain("data[0].codigo504");
    expect(llaves).toContain("data[0].ppm.tasa");
    expect(a.propiedadesAnidadas).toContain("ppm.tasa");
    expect(a.envoltura).toBe("data");
  });

  it("marca las propiedades que el adaptador no conserva", () => {
    expect(
      propiedadesDescartadas(
        ["periodo", "folio", "fecha", "estado", "codigo538"],
        ["periodo", "folio", "fecha", "estado"],
      ),
    ).toEqual(["codigo538"]);
  });

  it("nunca muestra el folio completo", () => {
    expect(enmascararFolio("1234567890")).toBe("••••••7890");
    expect(enmascararFolio("12")).toBe("••••");
  });
});
