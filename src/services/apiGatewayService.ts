import {
  desconectarApiGatewayFn,
  diagnosticarApiGatewayFn,
  pruebaRealApiGatewayFn,
} from "@/lib/apiGateway.functions";
import type { DiagnosticoApiGateway } from "@/lib/apiGateway.server";
import type { ResultadoPruebaReal } from "@/lib/apiGatewayReal.server";

export class ErrorApiGateway extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorApiGateway";
  }
}

/**
 * Cliente de la prueba real controlada.
 * La Clave Tributaria solo se envía en la llamada y nunca se guarda en el
 * navegador (ni en estado persistente, ni en almacenamiento local).
 */
export const apiGatewayService = {
  async diagnosticar(probarProductos = false): Promise<DiagnosticoApiGateway> {
    const r = await diagnosticarApiGatewayFn({ data: { probarProductos } });
    if (!r.ok) throw new ErrorApiGateway(r.error);
    return r.data;
  },


  async ejecutarPrueba(entrada: {
    companyId: string;
    periodo: string;
    rutUsuario: string;
    claveTributaria: string;
  }): Promise<ResultadoPruebaReal> {
    const r = await pruebaRealApiGatewayFn({
      data: { ...entrada, consentimiento: true },
    });
    if (!r.ok) throw new ErrorApiGateway(r.error);
    return r.data;
  },

  async desconectar(companyId: string): Promise<void> {
    const r = await desconectarApiGatewayFn({ data: { companyId } });
    if (!r.ok) throw new ErrorApiGateway(r.error);
  },
};
