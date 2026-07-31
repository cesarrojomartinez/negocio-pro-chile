import { describe, expect, it } from "vitest";
import {
  aplicarAnticipoIva,
  estimarAnticipoIva,
  leerAnticipoF29,
} from "@/lib/anticipoIva";
import {
  evaluarCoherenciaPpmF29,
  interpretarAntecedenteF29,
  tasaPpmEfectivaF29,
} from "@/lib/f29Antecedent";

describe("leerAnticipoF29", () => {
  it("devuelve null cuando la empresa no tiene cambio de sujeto", () => {
    expect(leerAnticipoF29({ "538": 100000, "537": 50000 })).toBeNull();
    expect(leerAnticipoF29(null)).toBeNull();
  });

  it("lee el bloque completo del formulario", () => {
    const a = leerAnticipoF29({
      "556": 153082,
      "557": 1520188,
      "543": 1673270,
      "598": 96455,
      "573": 1576815,
    });
    expect(a).toEqual({
      delMes: 153082,
      remanenteAnterior: 1520188,
      disponible: 1673270,
      imputado: 96455,
      remanenteSiguiente: 1576815,
    });
  });

  it("completa el disponible y el remanente cuando faltan", () => {
    const a = leerAnticipoF29({ "556": 100, "557": 400, "598": 300 });
    expect(a?.disponible).toBe(500);
    expect(a?.remanenteSiguiente).toBe(200);
  });
});

describe("estimarAnticipoIva", () => {
  const muestras = [
    {
      periodo: "2026-05",
      anticipo: {
        delMes: 150,
        remanenteAnterior: 0,
        disponible: 150,
        imputado: 0,
        remanenteSiguiente: 900,
      },
    },
    {
      periodo: "2026-04",
      anticipo: {
        delMes: 100,
        remanenteAnterior: 0,
        disponible: 100,
        imputado: 0,
        remanenteSiguiente: 700,
      },
    },
  ];

  it("usa el remanente oficial del último F29 y la mediana del anticipo mensual", () => {
    const e = estimarAnticipoIva(muestras, "2026-06");
    expect(e.remanenteAnterior).toBe(900);
    expect(e.anticipoMesEstimado).toBe(125);
    expect(e.disponible).toBe(1025);
    expect(e.fuente).toBe("f29_historial");
  });

  it("ignora periodos posteriores al objetivo", () => {
    expect(estimarAnticipoIva(muestras, "2026-04").remanenteAnterior).toBe(0);
  });

  it("nunca inventa anticipo sin historial", () => {
    const e = estimarAnticipoIva([], "2026-06");
    expect(e.disponible).toBe(0);
    expect(e.fuente).toBe("sin_datos");
  });
});

describe("aplicarAnticipoIva", () => {
  it("rebaja el IVA hasta cero y deja el resto como remanente", () => {
    expect(aplicarAnticipoIva(100000, 250000)).toEqual({
      disponible: 250000,
      aplicado: 100000,
      ivaPorPagar: 0,
      remanenteSiguiente: 150000,
    });
  });

  it("nunca genera devolución ni montos negativos", () => {
    expect(aplicarAnticipoIva(0, 5000).aplicado).toBe(0);
    expect(aplicarAnticipoIva(5000, -100).ivaPorPagar).toBe(5000);
  });
});

describe("evaluarCoherenciaPpmF29", () => {
  it("acepta un formulario consistente", () => {
    expect(
      evaluarCoherenciaPpmF29({ "563": 10092569, "115": 0.03, "62": 302777 })
        .ppmCoherente,
    ).toBe(true);
  });

  it("rechaza una tasa que no cuadra con la base y el PPM declarado", () => {
    // Caso real: PDF mal leído con tasa 10 % y PPM de cinco dígitos.
    expect(
      evaluarCoherenciaPpmF29({ "563": 15288385, "115": 0.1, "62": 15288 })
        .ppmCoherente,
    ).toBe(false);
  });
});

describe("tasaPpmEfectivaF29 — lección de junio 2026", () => {
  it("deduce la tasa real del formulario cuando el código 115 es ilegible", () => {
    // Base 15.288.385 y PPM 15.288 ⇒ 0,1 %, aunque el 115 se leyó como 0,1 (10 %).
    const r = tasaPpmEfectivaF29({ "563": 15288385, "115": 0.1, "62": 15288 }, 0.1);
    expect(r.derivada).toBe(true);
    expect(r.tasa).toBe(0.001);
  });

  it("respeta la tasa leída cuando el formulario es coherente", () => {
    const r = tasaPpmEfectivaF29({ "563": 10092569, "115": 0.03, "62": 302777 }, 0.03);
    expect(r).toEqual({ tasa: 0.03, derivada: false });
  });

  it("no deduce nada cuando el formulario no trae base imponible", () => {
    // Sin base no hay contra qué validar: se conserva la tasa leída, sin deducir.
    expect(tasaPpmEfectivaF29({ "115": 0.1, "62": 15288 }, 0.1)).toEqual({
      tasa: 0.1,
      derivada: false,
    });
  });

  it("el antecedente entrega la tasa deducida para heredarla al mes siguiente", () => {
    const a = interpretarAntecedenteF29({
      declaration_status: "filed",
      declared_vat: 726868,
      declared_ppm: 15288,
      declared_withholdings: 6298,
      declared_total: 748454,
      vat_carryforward: 15046,
      source: "f29_pdf_extracted",
      raw_data: { ppm_rate: 0.1, codigos: { "563": 15288385, "115": 0.1, "62": 15288 } },
    });
    expect(a?.tasaPpm).toBe(0.001);
    expect(a?.tasaPpmDerivada).toBe(true);
    expect(a?.ppmCoherente).toBe(false);
  });
});
