import {
  extraerF29CompactoFn,
  obtenerExtraccionF29Fn,
  urlFirmadaF29Fn,
} from "@/lib/f29Pdf.functions";
import type {
  ExtraccionF29,
  ResultadoExtraccionF29,
} from "@/lib/f29PdfExtraction.server";

export class ErrorF29Pdf extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorF29Pdf";
  }
}

/**
 * Cliente de la descarga y lectura del F29 oficial.
 * La Clave Tributaria se envía solo en la llamada y nunca se guarda en el
 * navegador.
 */
export const f29PdfService = {
  async extraer(entrada: {
    companyId: string;
    periodo: string;
    rutUsuario: string;
    claveTributaria: string;
    folioConfirmado?: string | null;
  }): Promise<ResultadoExtraccionF29> {
    const r = await extraerF29CompactoFn({
      data: { ...entrada, consentimiento: true },
    });
    if (!r.ok) throw new ErrorF29Pdf(r.error);
    return r.data;
  },

  async obtener(companyId: string, periodo: string): Promise<ExtraccionF29 | null> {
    const r = await obtenerExtraccionF29Fn({ data: { companyId, periodo } });
    if (!r.ok) throw new ErrorF29Pdf(r.error);
    return r.data;
  },

  async urlFirmada(companyId: string, periodo: string): Promise<string> {
    const r = await urlFirmadaF29Fn({ data: { companyId, periodo } });
    if (!r.ok) throw new ErrorF29Pdf(r.error);
    return r.data;
  },
};
