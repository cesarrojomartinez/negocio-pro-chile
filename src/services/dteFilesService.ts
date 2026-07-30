import {
  descargarArchivoDteFn,
  descargarLoteArchivosDteFn,
  listarDocumentosPeriodoFn,
  urlFirmadaArchivoDteFn,
} from "@/lib/dteFiles.functions";
import type {
  ListadoDocumentos,
  ResultadoDescargaArchivo,
  ResultadoLote,
} from "@/lib/dteFiles.server";
import type { TipoArchivoDte } from "@/lib/dteXmlParser";

export class ErrorDocumentos extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorDocumentos";
  }
}

interface Credenciales {
  rutUsuario: string;
  claveTributaria: string;
}

/**
 * Cliente del centro documental. La Clave Tributaria se envía solo en la
 * llamada y nunca queda guardada en el navegador.
 */
export const dteFilesService = {
  async listar(companyId: string, periodo: string): Promise<ListadoDocumentos> {
    const r = await listarDocumentosPeriodoFn({ data: { companyId, periodo } });
    if (!r.ok) throw new ErrorDocumentos(r.error);
    return r.data;
  },

  async descargar(
    entrada: {
      companyId: string;
      periodo: string;
      documentoId: string;
      tipoArchivo: TipoArchivoDte;
    } & Credenciales,
  ): Promise<ResultadoDescargaArchivo> {
    const r = await descargarArchivoDteFn({
      data: { ...entrada, consentimiento: true },
    });
    if (!r.ok) throw new ErrorDocumentos(r.error);
    return r.data;
  },

  async descargarLote(
    entrada: {
      companyId: string;
      periodo: string;
      documentoIds: string[];
      tipoArchivo: TipoArchivoDte;
    } & Credenciales,
  ): Promise<ResultadoLote> {
    const r = await descargarLoteArchivosDteFn({
      data: { ...entrada, consentimiento: true },
    });
    if (!r.ok) throw new ErrorDocumentos(r.error);
    return r.data;
  },

  async urlFirmada(companyId: string, archivoId: string): Promise<string> {
    const r = await urlFirmadaArchivoDteFn({ data: { companyId, archivoId } });
    if (!r.ok) throw new ErrorDocumentos(r.error);
    return r.data;
  },
};
