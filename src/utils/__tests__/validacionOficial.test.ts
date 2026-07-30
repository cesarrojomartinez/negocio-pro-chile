import { describe, expect, it } from "vitest";

import type { MapaCodigos, ValorCodigo } from "@/lib/f29PdfParser";
import {
  codigosFaltantes,
  documentosRequeridos,
  esPeriodoValido,
  etiquetaPeriodo,
  planDeValidacion,
  totalOficialDeclarado,
} from "@/lib/validacionOficial";

describe("validación oficial universal", () => {
  it("acepta cualquier periodo con formato AAAA-MM y rechaza inválidos", () => {
    expect(esPeriodoValido("2024-01")).toBe(true);
    expect(esPeriodoValido("2026-12")).toBe(true);
    expect(esPeriodoValido("2026-13")).toBe(false);
    expect(esPeriodoValido("202603")).toBe(false);
  });

  it("describe el periodo en español", () => {
    expect(etiquetaPeriodo("2026-03")).toContain("arzo de 2026");
  });

  it("pide documentos solo cuando el tipo lo requiere", () => {
    expect(documentosRequeridos("f29")).toEqual({ venta: false, compra: false });
    expect(documentosRequeridos("f29_both")).toEqual({ venta: true, compra: true });
  });

  it("no cobra créditos cuando todo está archivado", () => {
    const plan = planDeValidacion({
      tipo: "f29_sale",
      f29Archivado: true,
      listadoEnCache: true,
      documentos: [
        { direccion: "sale", archivos: [{ tipoArchivo: "pdf", yaArchivado: true }] },
      ],
    });
    expect(plan.llamadasEstimadas).toBe(0);
    expect(plan.creditosEstimados).toBe(0);
    expect(plan.llamadasEvitadasPorCache).toBeGreaterThan(0);
  });

  it("estima consultas y créditos cuando falta información", () => {
    const plan = planDeValidacion({
      tipo: "f29_both",
      f29Archivado: false,
      listadoEnCache: false,
      documentos: [
        { direccion: "sale", archivos: [{ tipoArchivo: "pdf", yaArchivado: false }] },
        { direccion: "purchase", archivos: [{ tipoArchivo: "xml", yaArchivado: false }] },
      ],
    });
    expect(plan.llamadasEstimadas).toBeGreaterThan(0);
    expect(plan.creditosEstimados).toBeGreaterThan(0);
  });

  it("prioriza el código 91 como total oficial y detecta faltantes", () => {
    const valor = (code: string, monto: number): ValorCodigo => ({
      code,
      raw_value: String(monto),
      normalized_value: monto,
      value_type: "money",
      page: 1,
      extraction_method: "positional",
      confidence: 1,
      anchor: null,
      coordinates: null,
    });
    const codigos: MapaCodigos = { "91": valor("91", 1125729), "94": valor("94", 5000) };
    expect(totalOficialDeclarado(codigos).valor).toBe(1125729);
    expect(codigosFaltantes({ "91": valor("91", 1125729) })).toContain("538");
  });
});
