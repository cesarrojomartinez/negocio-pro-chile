/**
 * Backend del Centro de Configuración Global MASTER 2.0.
 * Operaciones protegidas con `exigirAdmin(userId)` y auditadas en `tax_activity_logs`.
 *
 * NO modifica el motor tributario, RLS, autenticación ni el Gateway SII.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ErrorNegocio, registrarActividad } from "@/lib/companies.server";
import { esAdministrador } from "@/lib/cuenta.server";
import {
  CONFIGURACION_POR_DEFECTO,
  type ConfiguracionGlobal,
  type GrupoConfiguracion,
  type RegistroHistorialConfig,
} from "@/lib/configuracion";
import { guardarBorradorLanding, landingAdmin } from "@/lib/landing.server";

async function exigirAdmin(userId: string) {
  if (!(await esAdministrador(userId))) {
    throw new ErrorNegocio("Esta sección es reservada exclusivamente para el equipo de administración.");
  }
}

async function auditar(
  userId: string,
  accion: string,
  metadata: Record<string, string | number | boolean | null | unknown> = {},
) {
  try {
    await registrarActividad(null, userId, accion, "master_settings", metadata as Record<string, string | number | boolean | null>);
  } catch (error) {
    console.error("[configuracion.server] Error registrando auditoría:", error);
  }
}

/** Obtiene la configuración completa unificando `master_settings` y defaults. */
export async function obtenerConfiguracionGlobalMaster(userId: string): Promise<ConfiguracionGlobal> {
  await exigirAdmin(userId);

  const base: ConfiguracionGlobal = JSON.parse(JSON.stringify(CONFIGURACION_POR_DEFECTO));

  try {
    // 1. Intentar cargar desde master_settings si existe la tabla
    const { data: filasSettings } = await (supabaseAdmin as any)
      .from("master_settings")
      .select("grupo, valor_json");

    if (filasSettings && Array.isArray(filasSettings)) {
      for (const fila of (filasSettings as any[])) {
        const grupo = fila.grupo as GrupoConfiguracion;
        if (grupo && base[grupo] && fila.valor_json) {
          base[grupo] = { ...base[grupo], ...(fila.valor_json as any) };
        }
      }
    }
  } catch {
    // Si la tabla master_settings no existe en la base de datos, se continúa sin interrumpir
  }

  try {
    // 2. Sincronizar datos de la landing si existen en tax_landing_content
    const landing = await landingAdmin(userId);
    if (landing.borrador) {
      base.landing = {
        ...base.landing,
        hero: {
          ...base.landing.hero,
          titulo: landing.borrador.hero.titulo,
          tituloDestacado: landing.borrador.hero.tituloDestacado,
          descripcion: landing.borrador.hero.descripcion,
          botonPrimario: landing.borrador.hero.botonPrimario,
          botonSecundario: landing.borrador.hero.botonSecundario,
        },
        footer: {
          ...base.landing.footer,
          descripcion: landing.borrador.footer.descripcion,
          soporte: landing.borrador.footer.soporte,
          terminos: landing.borrador.footer.terminos,
          privacidad: landing.borrador.footer.privacidad,
          legal: landing.borrador.footer.legal,
        },
      };
    }
  } catch {
    // Ignorar si landing no está disponible
  }

  return base;
}

/** Guarda la configuración de un grupo específico y registra auditoría completa. */
export async function guardarGrupoConfiguracionMaster(
  userId: string,
  grupo: GrupoConfiguracion,
  valores: unknown,
): Promise<{ ok: true; mensaje: string }> {
  await exigirAdmin(userId);

  const configActual = await obtenerConfiguracionGlobalMaster(userId);
  const valorAnterior = configActual[grupo];

  // 1. Si es grupo landing, actualizar también en tax_landing_content
  if (grupo === "landing") {
    try {
      await guardarBorradorLanding(userId, valores, `Actualizado desde Centro de Configuración por admin ${userId}`);
    } catch (e) {
      console.warn("[configuracion.server] No se pudo actualizar borrador landing:", e);
    }
  }

  // 2. Intentar guardar en tabla master_settings
  try {
    await (supabaseAdmin as any).from("master_settings").upsert(
      {
        grupo,
        clave: `config_${grupo}`,
        valor_json: valores,
        descripcion: `Configuración de ${grupo} actualizada por el panel Master.`,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: "grupo" },
    );
  } catch (err) {
    console.warn("[configuracion.server] master_settings no disponible o error al guardar:", err);
  }

  // 3. Auditoría obligatoria en tax_activity_logs
  await auditar(userId, `configuracion_actualizada_${grupo}`, {
    grupo,
    usuario_id: userId,
    fecha: new Date().toISOString(),
    valor_anterior: JSON.stringify(valorAnterior),
    valor_nuevo: JSON.stringify(valores),
  });

  return { ok: true, mensaje: `Configuración del grupo '${grupo}' guardada con éxito.` };
}

/** Restablece un grupo a los valores por defecto del sistema. */
export async function restablecerGrupoConfiguracionMaster(
  userId: string,
  grupo: GrupoConfiguracion,
): Promise<{ ok: true; mensaje: string }> {
  await exigirAdmin(userId);

  const valorPorDefecto = CONFIGURACION_POR_DEFECTO[grupo];
  return guardarGrupoConfiguracionMaster(userId, grupo, valorPorDefecto);
}

/** Obtiene el historial de cambios de configuración auditados. */
export async function obtenerHistorialConfiguracionMaster(
  userId: string,
): Promise<RegistroHistorialConfig[]> {
  await exigirAdmin(userId);

  try {
    const { data } = await supabaseAdmin
      .from("tax_activity_logs")
      .select("id, action, created_at, user_id, metadata")
      .eq("entity_type", "master_settings")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!data) return [];

    return data.map((d) => {
      const meta = (d.metadata as any) ?? {};
      return {
        id: d.id,
        usuarioEmail: (meta.usuario_id as string) ?? d.user_id ?? "Admin",
        grupo: (meta.grupo as string) ?? "general",
        accion: d.action,
        fecha: d.created_at,
        valorAnterior: meta.valor_anterior ?? null,
        valorNuevo: meta.valor_nuevo ?? null,
      };
    });
  } catch (err) {
    console.error("[configuracion.server] Error al leer historial de auditoría:", err);
    return [];
  }
}
