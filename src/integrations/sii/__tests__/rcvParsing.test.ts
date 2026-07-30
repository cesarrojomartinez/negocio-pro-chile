/**
 * Pruebas del parser del RCV con las formas REALES de respuesta de API Gateway.
 * No consumen créditos: todas usan respuestas fijas escritas a mano a partir de
 * lo que informa el portal del SII para el periodo 2026-06 de la empresa
 * autorizada.
 */
import { describe, expect, it } from "vitest";

import { unwrapProviderCollection } from "../unwrapProviderCollection";
import { construirResumenRcv, sumarResumenes, tiposConDocumentos } from "../rcvSummary";
import { aDocumento } from "../apiGatewaySiiProviderAdapter";
import { normalizarVentas, totalesFirmados } from "../normalizeProviderData";
import { SiiProviderError, type ProviderSalesResult } from "../contracts";

describe("unwrapProviderCollection", () => {
  it("reconoce el arreglo directo, data.array y data.data", () => {
    expect(unwrapProviderCollection([{ a: 1 }]).forma).toBe("array");
    expect(unwrapProviderCollection({ data: [{ a: 1 }] }).forma).toBe("data.array");
    expect(unwrapProviderCollection({ data: { data: [{ a: 1 }] } }).forma).toBe("data.data");
  });

  it("trata la respuesta sin filas como vacía, no como error", () => {
    expect(unwrapProviderCollection({ data: { respEstado: { code: 0 } } }).items).toEqual([]);
    expect(unwrapProviderCollection(null).items).toEqual([]);
  });

  it("nunca devuelve vacío en silencio ante una envoltura desconocida", () => {
    expect(() => unwrapProviderCollection({ resultado: { filas: [{ a: 1 }] } })).toThrow(
      SiiProviderError,
    );
  });
});

describe("resumen del RCV de ventas 2026-06", () => {
  // Cifras exactas del portal del SII.
  const filas = [
    {
      rsmnTipoDocInteger: 33,
      dcvNombreTipoDoc: "Factura Electrónica",
      rsmnTotDoc: 3,
      rsmnMntNeto: 10840000,
      rsmnMntIVA: 2059600,
      rsmnMntExe: 0,
      rsmnMntTotal: 12899600,
    },
    {
      rsmnTipoDocInteger: 61,
      dcvNombreTipoDoc: "Nota de Crédito Electrónica",
      rsmnTotDoc: 1,
      rsmnMntNeto: 4820000,
      rsmnMntIVA: 915800,
      rsmnMntExe: 0,
      rsmnMntTotal: 5735800,
    },
  ];

  it("resta la nota de crédito y coincide con el resultado ajustado", () => {
    const resumen = construirResumenRcv(filas);
    expect(resumen.documentCount).toBe(4);
    expect(resumen.netAmount).toBe(6020000);
    expect(resumen.vatAmount).toBe(1143800);
    expect(resumen.totalAmount).toBe(7163800);
  });

  it("guía el detalle solo por los tipos informados", () => {
    expect(tiposConDocumentos(construirResumenRcv(filas))).toEqual([33, 61]);
  });
});

describe("resumen del RCV de compras 2026-06", () => {
  it("conserva el total oficial aunque no sea neto + IVA", () => {
    const resumen = construirResumenRcv([
      {
        rsmnTipoDocInteger: 33,
        rsmnTotDoc: 25,
        rsmnMntNeto: 887224,
        rsmnMntIVA: 168571,
        rsmnMntExe: 0,
        rsmnMntTotal: 1225687,
      },
    ]);
    expect(resumen.documentCount).toBe(25);
    // El total del SII se preserva tal cual: no se recalcula.
    expect(resumen.totalAmount).toBe(1225687);
    // La diferencia queda expuesta, no descartada.
    expect(resumen.unclassifiedAmount).toBe(1225687 - 887224 - 168571);
  });

  it("suma los cuatro estados en un solo resumen", () => {
    const uno = construirResumenRcv([
      { rsmnTipoDocInteger: 33, rsmnTotDoc: 25, rsmnMntTotal: 1225687 },
    ]);
    const dos = construirResumenRcv([
      { rsmnTipoDocInteger: 33, rsmnTotDoc: 2, rsmnMntTotal: 100 },
    ]);
    expect(sumarResumenes([uno, dos]).documentCount).toBe(27);
  });
});

describe("detalle del RCV", () => {
  const fila = {
    detTipoDoc: 33,
    detNroDoc: 1201,
    detFchDoc: "12/06/2026",
    detRutDoc: 76543210,
    detDvDoc: "K",
    detRznSoc: "Cliente Ejemplo SpA",
    detMntNeto: 3613333,
    detMntIVA: 686533,
    detMntExe: 0,
    detMntTotal: 4299866,
  };

  it("interpreta las filas det* y marca el efecto tributario", () => {
    const doc = aDocumento(fila, "sale", "registered");
    expect(doc?.folio).toBe(1201);
    expect(doc?.issueDate).toBe("2026-06-12");
    expect(doc?.counterpartyRut).toBe("76543210-K");
    expect(doc?.taxEffect).toBe(1);
    expect(aDocumento({ ...fila, detTipoDoc: 61 }, "sale", "registered")?.taxEffect).toBe(-1);
  });

  it("tolera montos y códigos entregados como texto", () => {
    const doc = aDocumento(
      { ...fila, detTipoDoc: "33", detNroDoc: "1201", detMntTotal: "4.299.866" },
      "sale",
      "registered",
    );
    expect(doc?.totalAmount).toBe(4299866);
  });

  it("descarta la fila del CSV, que no trae campos det*", () => {
    expect(
      aDocumento(
        { "Tipo Doc": 33, Folio: 1201 } as never,
        "sale",
        "registered",
      ),
    ).toBeNull();
  });

  it("aplica signo negativo a la nota de crédito al normalizar", () => {
    const resultado: ProviderSalesResult = {
      period: "2026-06",
      dataThroughDate: "2026-06-30",
      documents: [
        aDocumento(fila, "sale", "registered")!,
        aDocumento(
          { ...fila, detTipoDoc: 61, detNroDoc: 9, detMntTotal: 5735800, detMntNeto: 4820000, detMntIVA: 915800 },
          "sale",
          "registered",
        )!,
      ],
      summary: { documentCount: 2, totalAmount: 0, exemptAmount: 0 },
    };
    const n = normalizarVentas(resultado);
    const t = totalesFirmados(n.documentos);
    expect(n.documentos).toHaveLength(2);
    expect(t.total).toBe(4299866 - 5735800);
    expect(t.iva).toBe(686533 - 915800);
  });
});
