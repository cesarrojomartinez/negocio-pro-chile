import { describe, expect, it } from "vitest";

import {
  construirCamposNormalizados,
  evaluarExtraccion,
  extraerCodigos,
  extraerCodigosDesdeItems,
  validarF29,
  type ItemTextoPdf,
} from "@/lib/f29PdfParser";
import {
  base64ABytes,
  decodificarRespuestaPdf,
  listarDeclaraciones,
  rutaPdf,
  seleccionarDeclaracionVigente,
} from "@/lib/f29Declaration";

/** Construye una fila del formulario: código a la izquierda, valor a la derecha. */
function fila(codigo: string, valor: string, y: number): ItemTextoPdf[] {
  return [
    { texto: codigo, pagina: 1, x: 100, y, ancho: 20, alto: 8 },
    { texto: valor, pagina: 1, x: 300, y, ancho: 60, alto: 8 },
  ];
}

/** F29 sintético coherente: IVA, PPM y total cuadran entre sí. */
const ITEMS_COHERENTES: ItemTextoPdf[] = [
  ...fila("538", "2.489.260", 700),
  ...fila("537", "1.100.000", 690),
  ...fila("504", "100.000", 680),
  ...fila("89", "1.389.260", 660),
  ...fila("77", "0", 650),
  ...fila("563", "6.000.000", 640),
  ...fila("115", "2,5%", 630),
  ...fila("62", "150.000", 620),
  ...fila("91", "1.539.260", 600),
];

describe("lectura determinística del F29", () => {
  it("lee los códigos por posición y normaliza montos chilenos", () => {
    const codigos = extraerCodigosDesdeItems(ITEMS_COHERENTES);
    expect(codigos["538"].normalized_value).toBe(2489260);
    expect(codigos["504"].normalized_value).toBe(100000);
    expect(codigos["115"].normalized_value).toBeCloseTo(0.025, 6);
    expect(codigos["538"].extraction_method).toBe("positional");
  });

  it("normaliza los campos tributarios a partir de los códigos", () => {
    const campos = construirCamposNormalizados(extraerCodigosDesdeItems(ITEMS_COHERENTES));
    expect(campos.declared_vat_debit).toBe(2489260);
    expect(campos.declared_previous_carryforward).toBe(100000);
    expect(campos.declared_current_vat_credit).toBe(1000000);
    expect(campos.declared_vat_payable).toBe(1389260);
    expect(campos.declared_ppm).toBe(150000);
    expect(campos.declared_total_payable).toBe(1539260);
  });

  it("valida PPM, IVA y total, y marca la lectura como exitosa", () => {
    const codigos = extraerCodigosDesdeItems(ITEMS_COHERENTES);
    const campos = construirCamposNormalizados(codigos);
    const validaciones = validarF29(campos, {
      rutEmpresa: "77.976.228-9",
      rutDocumento: "77.976.228-9",
      periodoSolicitado: "2026-06",
      periodoDocumento: "2026-06",
      folioListado: "1234567890",
      folioDocumento: "1234567890",
    });
    expect(validaciones.filter((v) => v.estado === "error")).toHaveLength(0);
    const evaluacion = evaluarExtraccion({ codigos, campos, validaciones });
    expect(evaluacion.estado).toBe("success");
    expect(evaluacion.confianza).toBe("high");
  });

  it("marca revisión cuando el total declarado no cuadra", () => {
    const items = [
      ...ITEMS_COHERENTES.filter((i) => i.y !== 600),
      ...fila("91", "9.999.999", 600),
    ];
    const codigos = extraerCodigos({ items, texto: "" });
    const campos = construirCamposNormalizados(codigos);
    const validaciones = validarF29(campos, {
      rutEmpresa: null,
      rutDocumento: null,
      periodoSolicitado: "2026-06",
      periodoDocumento: null,
      folioListado: null,
      folioDocumento: null,
    });
    expect(validaciones.some((v) => v.id === "total" && v.estado !== "ok")).toBe(true);
    const evaluacion = evaluarExtraccion({ codigos, campos, validaciones });
    expect(["needs_review", "partial"]).toContain(evaluacion.estado);
  });

  it("reporta lectura parcial cuando faltan códigos críticos", () => {
    const items = [...fila("538", "1.000.000", 700)];
    const codigos = extraerCodigos({ items, texto: "" });
    const campos = construirCamposNormalizados(codigos);
    const evaluacion = evaluarExtraccion({
      codigos,
      campos,
      validaciones: validarF29(campos, {
        rutEmpresa: null,
        rutDocumento: null,
        periodoSolicitado: "2026-06",
        periodoDocumento: null,
        folioListado: null,
        folioDocumento: null,
      }),
    });
    expect(evaluacion.estado).toBe("partial");
    expect(evaluacion.advertencias.join(" ")).toMatch(/91|falt/i);
  });

  it("detecta que el documento pertenece a otro contribuyente o periodo", () => {
    const campos = construirCamposNormalizados(extraerCodigosDesdeItems(ITEMS_COHERENTES));
    const validaciones = validarF29(campos, {
      rutEmpresa: "77.976.228-9",
      rutDocumento: "76.111.222-3",
      periodoSolicitado: "2026-06",
      periodoDocumento: "2026-05",
      folioListado: "1",
      folioDocumento: "1",
    });
    expect(validaciones.find((v) => v.id === "rut")?.estado).toBe("error");
    expect(validaciones.find((v) => v.id === "periodo")?.estado).toBe("error");
  });
});

describe("selección de la declaración vigente", () => {
  const periodo = "2026-06";

  it("usa la única declaración del periodo", () => {
    const d = listarDeclaraciones([
      { periodo: 202606, folio: "111", fecha: "2026-07-12", estado: "VIGENTE" },
    ]);
    const s = seleccionarDeclaracionVigente(d, periodo);
    expect(s.estado).toBe("unica");
    expect(s.seleccionada?.folio).toBe("111");
  });

  it("elige la marcada como vigente cuando hay rectificatoria", () => {
    const d = listarDeclaraciones({
      data: [
        { periodo: "2026-06", folio: "111", estado: "RECTIFICADA", vigente: false },
        { periodo: "2026-06", folio: "222", estado: "VIGENTE", vigente: true, tipo: "RECTIFICATORIA" },
      ],
    });
    const s = seleccionarDeclaracionVigente(d, periodo);
    expect(s.estado).toBe("vigente");
    expect(s.seleccionada?.folio).toBe("222");
    expect(s.seleccionada?.esRectificatoria).toBe(true);
  });

  it("nunca adivina: sin marca de vigencia el resultado es ambiguo", () => {
    const d = listarDeclaraciones([
      { periodo: "2026-06", folio: "111" },
      { periodo: "2026-06", folio: "222" },
    ]);
    const s = seleccionarDeclaracionVigente(d, periodo);
    expect(s.estado).toBe("ambiguous");
    expect(s.seleccionada).toBeNull();
    expect(s.candidatas).toHaveLength(2);
  });

  it("informa cuando el periodo no tiene declaraciones", () => {
    expect(seleccionarDeclaracionVigente([], periodo).estado).toBe("ambiguous");
  });
});

describe("decodificación de la respuesta del PDF", () => {
  const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n");
  const base64 = btoa(String.fromCharCode(...pdf));

  it("acepta el PDF binario", () => {
    const r = decodificarRespuestaPdf({ contentType: "application/pdf", bytes: pdf });
    expect(r.ok && r.formato).toBe("binario");
  });

  it("acepta base64 plano", () => {
    const r = decodificarRespuestaPdf({
      contentType: "text/plain",
      bytes: new TextEncoder().encode(base64),
    });
    expect(r.ok && r.formato).toBe("base64");
  });

  it("acepta JSON con el PDF embebido", () => {
    const r = decodificarRespuestaPdf({
      contentType: "application/json",
      bytes: new TextEncoder().encode(JSON.stringify({ data: { archivo: base64 } })),
    });
    expect(r.ok && r.formato).toBe("json_envuelto");
  });

  it("rechaza contenido que no es un PDF", () => {
    const r = decodificarRespuestaPdf({
      contentType: "text/html",
      bytes: new TextEncoder().encode("<html>sesión expirada</html>"),
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe("F29_INVALID_PDF");
  });

  it("descarta base64 con caracteres inválidos", () => {
    expect(base64ABytes("no es base64 !!")).toBeNull();
  });

  it("guarda el archivo en una ruta privada por empresa y periodo", () => {
    expect(rutaPdf("empresa-1", "2026-06", "111")).toBe("empresa-1/2026/06/111.pdf");
  });
});
