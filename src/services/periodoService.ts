import {
  cambiarRecordatorioSemanalFn,
  cerrarPeriodoFn,
  confirmarF29Fn,
  elegirModoActualizacionFn,
  obtenerModoActualizacionFn,
  obtenerResumenPeriodoFn,
  reabrirPeriodoFn,
  solicitarRevisionFn,
} from "@/lib/periodo.functions";
import type {
  EntradaConfirmacionF29,
  ModoActualizacion,
  ModoActualizacionEmpresa,
  ResumenPeriodo,
} from "@/lib/periodLifecycle.server";

export class ErrorPeriodo extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorPeriodo";
  }
}

function desempaquetar<T>(r: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new ErrorPeriodo(r.error);
  return r.data;
}

/**
 * Cliente del ciclo de vida del periodo y del modo de actualización.
 * Nunca calcula impuestos ni envía credenciales: solo pide acciones.
 */
export const periodoService = {
  async modoActualizacion(companyId: string): Promise<ModoActualizacionEmpresa> {
    return desempaquetar(await obtenerModoActualizacionFn({ data: { companyId } }));
  },
  async elegirModo(
    companyId: string,
    modo: ModoActualizacion,
  ): Promise<ModoActualizacionEmpresa> {
    return desempaquetar(await elegirModoActualizacionFn({ data: { companyId, modo } }));
  },
  async recordatorioSemanal(companyId: string, activo: boolean): Promise<boolean> {
    return desempaquetar(await cambiarRecordatorioSemanalFn({ data: { companyId, activo } }));
  },
  async resumen(companyId: string, periodo: string): Promise<ResumenPeriodo> {
    return desempaquetar(await obtenerResumenPeriodoFn({ data: { companyId, periodo } }));
  },
  async pedirRevision(companyId: string, periodo: string): Promise<ResumenPeriodo> {
    return desempaquetar(await solicitarRevisionFn({ data: { companyId, periodo } }));
  },
  async confirmarF29(entrada: EntradaConfirmacionF29): Promise<ResumenPeriodo> {
    return desempaquetar(await confirmarF29Fn({ data: entrada }));
  },
  async cerrar(companyId: string, periodo: string): Promise<ResumenPeriodo> {
    return desempaquetar(await cerrarPeriodoFn({ data: { companyId, periodo } }));
  },
  async reabrir(
    companyId: string,
    periodo: string,
    motivo: string,
  ): Promise<ResumenPeriodo> {
    return desempaquetar(await reabrirPeriodoFn({ data: { companyId, periodo, motivo } }));
  },
};
