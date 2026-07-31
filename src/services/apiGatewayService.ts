import {
  auditarF29RealFn,
  desconectarApiGatewayFn,
  diagnosticarApiGatewayFn,
  pruebaRealApiGatewayFn,
} from "@/lib/apiGateway.functions";
import type { DiagnosticoApiGateway } from "@/lib/apiGateway.server";
import type { ResultadoPruebaReal } from "@/lib/apiGatewayReal.server";
import type { ResultadoAuditoriaF29 } from "@/lib/f29Audit.server";

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
  async diagnosticar(
    companyId: string,
    probarProductos = false,
  ): Promise<DiagnosticoApiGateway> {
    const r = await diagnosticarApiGatewayFn({ data: { companyId, probarProductos } });
    if (!r.ok) throw new ErrorApiGateway(r.error);
    return r.data;
  },


  async ejecutarPrueba(entrada: {
    companyId: string;
    periodo: string;
    rutUsuario: string;
    claveTributaria: string;
    /** Solo tras un error de sesión: fuerza `auth_cache=0` una vez. */
    sesionNueva?: boolean;
  }): Promise<ResultadoPruebaReal> {
    const r = await pruebaRealApiGatewayFn({
      data: { ...entrada, consentimiento: true },
    });
    if (!r.ok) throw new ErrorApiGateway(r.error);
    return r.data;
  },

  /**
   * Auditoría controlada del F29: como máximo dos consultas reales.
   * La clave se envía solo en esta llamada y no se guarda en el navegador.
   */
  async auditarF29(entrada: {
    companyId: string;
    periodo: string;
    rutUsuario: string;
    claveTributaria: string;
  }): Promise<ResultadoAuditoriaF29> {
    const r = await auditarF29RealFn({
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
