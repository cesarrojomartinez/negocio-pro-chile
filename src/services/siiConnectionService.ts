import {
  conectarSiiFn,
  desconectarSiiFn,
  listarSincronizacionesFn,
  obtenerConexionSiiFn,
  sincronizarSiiFn,
} from "@/lib/sii.functions";
import type { ConexionSii, RegistroSincronizacion, ResultadoSincronizacion } from "@/lib/siiSync.server";
import type { TipoActivacion } from "@/lib/syncPolicy";

export class ErrorSii extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorSii";
  }
}

/**
 * Cliente de la conexión simulada con el SII.
 * Solo pide acciones al servidor: nunca calcula ni envía montos.
 */
export const siiConnectionService = {
  async obtenerConexion(companyId: string): Promise<ConexionSii | null> {
    const r = await obtenerConexionSiiFn({ data: { companyId } });
    if (!r.ok) throw new ErrorSii(r.error);
    return r.data;
  },

  async conectar(companyId: string): Promise<ConexionSii> {
    const r = await conectarSiiFn({ data: { companyId, consentimiento: true } });
    if (!r.ok) throw new ErrorSii(r.error);
    return r.data;
  },

  async desconectar(companyId: string): Promise<void> {
    const r = await desconectarSiiFn({ data: { companyId } });
    if (!r.ok) throw new ErrorSii(r.error);
  },

  async sincronizar(
    companyId: string,
    periodo: string,
    triggerType: TipoActivacion = "manual",
    idempotencyKey?: string,
  ): Promise<ResultadoSincronizacion> {
    const r = await sincronizarSiiFn({
      data: { companyId, periodo, triggerType, idempotencyKey: idempotencyKey ?? null },
    });
    if (!r.ok) throw new ErrorSii(r.error);
    return r.data;
  },

  async historial(companyId: string, limite = 10): Promise<RegistroSincronizacion[]> {
    const r = await listarSincronizacionesFn({ data: { companyId, limite } });
    if (!r.ok) throw new ErrorSii(r.error);
    return r.data;
  },
};
