import {
  ejecutarValidacionFn,
  listarValidacionesFn,
  previsualizarValidacionFn,
} from "@/lib/validacionOficial.functions";
import type {
  EntradaValidacion,
  PrevisualizacionValidacion,
  RegistroValidacion,
} from "@/lib/validacionOficial.server";
import type { TipoValidacion } from "@/lib/validacionOficial";
import type { TipoArchivoDte } from "@/lib/dteXmlParser";

export class ErrorValidacionOficial extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorValidacionOficial";
  }
}

/**
 * Cliente del panel de validación. La Clave Tributaria se envía únicamente en
 * la llamada de ejecución y nunca se guarda en el navegador.
 */
export const validacionOficialService = {
  async previsualizar(entrada: {
    companyId: string;
    periodo: string;
    tipo: TipoValidacion;
    documentoVentaId?: string | null;
    documentoCompraId?: string | null;
    archivos?: TipoArchivoDte[];
  }): Promise<PrevisualizacionValidacion> {
    const r = await previsualizarValidacionFn({ data: entrada });
    if (!r.ok) throw new ErrorValidacionOficial(r.error);
    return r.data;
  },

  async ejecutar(entrada: EntradaValidacion): Promise<RegistroValidacion> {
    const r = await ejecutarValidacionFn({ data: { ...entrada, consentimiento: true } });
    if (!r.ok) throw new ErrorValidacionOficial(r.error);
    return r.data;
  },

  async listar(companyId: string, limite = 10): Promise<RegistroValidacion[]> {
    const r = await listarValidacionesFn({ data: { companyId, limite } });
    if (!r.ok) throw new ErrorValidacionOficial(r.error);
    return r.data;
  },
};
