import {
  actualizarPreferenciasSyncFn,
  obtenerPreferenciasSyncFn,
} from "@/lib/syncPreferences.functions";
import type { CambioPreferencias } from "@/lib/syncPreferences.server";
import type { SyncPreferences } from "@/lib/syncPreferences";

export class ErrorPreferencias extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorPreferencias";
  }
}

function desempaquetar<T>(r: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new ErrorPreferencias(r.error);
  return r.data;
}

/** Cliente de preferencias de actualización. Nunca transporta credenciales. */
export const syncPreferencesService = {
  async obtener(companyId: string): Promise<SyncPreferences> {
    return desempaquetar(await obtenerPreferenciasSyncFn({ data: { companyId } }));
  },
  async actualizar(cambio: CambioPreferencias): Promise<SyncPreferences> {
    return desempaquetar(await actualizarPreferenciasSyncFn({ data: cambio }));
  },
};
