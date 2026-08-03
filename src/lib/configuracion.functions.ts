/**
 * Server Functions protegidas para el Centro de Configuración Global MASTER 2.0.
 * Autenticadas con `requireSupabaseAuth` y restringidas al rol `admin`.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GrupoConfiguracion } from "@/lib/configuracion";
import {
  guardarGrupoConfiguracionMaster,
  obtenerConfiguracionGlobalMaster,
  obtenerHistorialConfiguracionMaster,
  restablecerGrupoConfiguracionMaster,
} from "@/lib/configuracion.server";

export const obtenerConfiguracionGlobalMasterFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const data = await obtenerConfiguracionGlobalMaster(context.userId);
      return { ok: true as const, data };
    } catch (e: any) {
      return { ok: false as const, error: e.message || "Error al obtener la configuración global." };
    }
  });

export const guardarGrupoConfiguracionMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { grupo: GrupoConfiguracion; valores: unknown }) => d)
  .handler(async ({ context, data: { grupo, valores } }) => {
    try {
      const res = await guardarGrupoConfiguracionMaster(context.userId, grupo, valores);
      return { ok: true as const, data: res };
    } catch (e: any) {
      return { ok: false as const, error: e.message || "Error al guardar la configuración." };
    }
  });

export const restablecerGrupoConfiguracionMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { grupo: GrupoConfiguracion }) => d)
  .handler(async ({ context, data: { grupo } }) => {
    try {
      const res = await restablecerGrupoConfiguracionMaster(context.userId, grupo);
      return { ok: true as const, data: res };
    } catch (e: any) {
      return { ok: false as const, error: e.message || "Error al restablecer la configuración." };
    }
  });

export const obtenerHistorialConfiguracionMasterFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const data = await obtenerHistorialConfiguracionMaster(context.userId);
      return { ok: true as const, data };
    } catch (e: any) {
      return { ok: false as const, error: e.message || "Error al obtener el historial de cambios." };
    }
  });
