import { describe, expect, it } from "vitest";

import {
  codigoDteDeDocumento,
  compararConRegistro,
  decodificarRespuestaXml,
  estimarCreditos,
  leerXmlDte,
  rutaArchivoDte,
} from "@/lib/dteXmlParser";
import {
  moduloArchivoDte,
  RECURSOS_DTE,
  rutaRecursoDte,
} from "@/integrations/sii/apiGatewayResourceMap";

const XML_FACTURA = `<?xml version="1.0" encoding="ISO-8859-1"?>
<DTE version="1.0">
  <Documento ID="F123T33">
    <Encabezado>
      <IdDoc><TipoDTE>33</TipoDTE><Folio>123</Folio><FchEmis>2026-07-15</FchEmis></IdDoc>
      <Emisor><RUTEmisor>77976228-9</RUTEmisor><RznSoc>EXPLOTACION DE MADERA JMC SPA</RznSoc></Emisor>
      <Receptor><RUTRecep>76192083-9</RUTRecep><RznSocRecep>CLIENTE EJEMPLO</RznSocRecep></Receptor>
      <Totales><MntNeto>100000</MntNeto><MntExe>0</MntExe><IVA>19000</IVA><MntTotal>119000</MntTotal></Totales>
    </Encabezado>
    <TED version="1.0"><DD></DD></TED>
  </Documento>
</DTE>`;

const REGISTRO = {
  tipoDte: 33,
  folio: 123,
  fecha: "2026-07-15",
  neto: 100000,
  iva: 19000,
  exento: 0,
  total: 119000,
};

describe("lectura del XML de un documento tributario", () => {
  it("lee el encabezado completo", () => {
    const campos = leerXmlDte(XML_FACTURA);
    expect(campos.tipoDte).toBe(33);
    expect(campos.folio).toBe(123);
    expect(campos.fechaEmision).toBe("2026-07-15");
    expect(campos.rutEmisor).toBe("77976228-9");
    expect(campos.rutReceptor).toBe("76192083-9");
    expect(campos.montoTotal).toBe(119000);
    expect(campos.tieneTimbre).toBe(true);
  });

  it("acepta el XML entregado en base64 o dentro de un JSON", () => {
    const base64 = btoa(XML_FACTURA);
    const plano = decodificarRespuestaXml({
      contentType: "text/plain",
      bytes: new TextEncoder().encode(base64),
    });
    expect(plano.ok).toBe(true);

    const envuelto = decodificarRespuestaXml({
      contentType: "application/json",
      bytes: new TextEncoder().encode(JSON.stringify({ data: { xml: base64 } })),
    });
    expect(envuelto.ok).toBe(true);
    if (envuelto.ok) expect(leerXmlDte(envuelto.texto).folio).toBe(123);
  });

  it("rechaza contenido que no es un documento", () => {
    const r = decodificarRespuestaXml({
      contentType: "text/html",
      bytes: new TextEncoder().encode("<html><body>Portal del SII</body></html>"),
    });
    expect(r.ok).toBe(false);
  });

  it("confirma cuando el documento coincide con el registro", () => {
    const validaciones = compararConRegistro(leerXmlDte(XML_FACTURA), REGISTRO);
    expect(validaciones.every((v) => v.estado === "ok")).toBe(true);
  });

  it("informa la diferencia sin modificar el registro", () => {
    const validaciones = compararConRegistro(leerXmlDte(XML_FACTURA), {
      ...REGISTRO,
      total: 150000,
    });
    const total = validaciones.find((v) => v.id === "total");
    expect(total?.estado).toBe("warning");
    expect(REGISTRO.total).toBe(119000);
  });

  it("acepta notas de crédito guardadas con signo negativo", () => {
    const validaciones = compararConRegistro(leerXmlDte(XML_FACTURA), {
      ...REGISTRO,
      neto: -100000,
      iva: -19000,
      total: -119000,
    });
    expect(validaciones.filter((v) => v.estado === "error")).toHaveLength(0);
  });
});

describe("recursos y rutas de archivos", () => {
  it("usa el recurso oficial según la dirección del documento", () => {
    expect(moduloArchivoDte("sale", "pdf")).toBe("dte_pdf_issued");
    expect(moduloArchivoDte("purchase", "xml")).toBe("dte_xml_received");
    expect(Object.values(RECURSOS_DTE).every((r) => r.documented)).toBe(true);
  });

  it("arma la ruta de un documento recibido con emisor y receptor correctos", () => {
    const ruta = rutaRecursoDte({
      modulo: "dte_xml_received",
      rutEmpresa: "77976228-9",
      rutContraparte: "76192083-9",
      dteCode: 33,
      folio: 123,
      fechaEmision: "2026-07-15",
    });
    expect(ruta).toBe(
      "sii/mipyme/recibidos/xml/77976228-9/76192083-9/33/123?fecha_emision=2026-07-15",
    );
  });

  it("guarda cada archivo en la carpeta privada de su empresa y periodo", () => {
    expect(
      rutaArchivoDte({
        companyId: "empresa",
        periodo: "2026-07",
        direccion: "sale",
        dteCode: 33,
        folio: 123,
        tipoArchivo: "pdf",
      }),
    ).toBe("empresa/2026/07/emitidos/33-123.pdf");
  });

  it("reconoce el código de DTE del identificador del proveedor", () => {
    expect(
      codigoDteDeDocumento({ external_id: "apigw:sale:61:987:77976228-9", document_type: "notaCredito" }),
    ).toBe(61);
    expect(codigoDteDeDocumento({ external_id: null, document_type: "boleta" })).toBe(39);
  });

  it("estima el costo con el valor declarado por el proveedor", () => {
    expect(estimarCreditos(10, "pdf")).toBe(0.1);
    expect(estimarCreditos(10, "xml")).toBe(0.05);
  });
});
