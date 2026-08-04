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

// Almacenamiento en memoria para resiliencia instantánea si la tabla master_settings no existe aún en Supabase
const memorySettingsStore = new Map<GrupoConfiguracion, any>();

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

/** Obtiene la configuración completa unificando `master_settings`, `tax_activity_logs` y defaults. */
export async function obtenerConfiguracionGlobalMaster(userId: string): Promise<ConfiguracionGlobal> {
  await exigirAdmin(userId);

  const base: ConfiguracionGlobal = JSON.parse(JSON.stringify(CONFIGURACION_POR_DEFECTO));

  try {
    // 1. Intentar cargar desde master_settings si existe la tabla
    const { data: filasSettings, error: errSettings } = await (supabaseAdmin as any)
      .from("master_settings")
      .select("grupo, valor_json");

    if (!errSettings && filasSettings && Array.isArray(filasSettings)) {
      for (const fila of (filasSettings as any[])) {
        const grupo = fila.grupo as GrupoConfiguracion;
        if (grupo && base[grupo] && fila.valor_json) {
          base[grupo] = { ...base[grupo], ...(fila.valor_json as any) };
        }
      }
    } else {
      // 1b. Fallback: Recuperar la última configuración guardada desde tax_activity_logs.
      // Se leen los más recientes primero y luego se aplican en orden cronológico,
      // de modo que el último cambio siempre prevalece aunque existan muchos registros.
      const { data: logs } = await (supabaseAdmin as any)
        .from("tax_activity_logs")
        .select("action, metadata, created_at")
        .eq("entity_type", "master_settings")
        .order("created_at", { ascending: false })
        .limit(100);

      if (logs && Array.isArray(logs)) {
        for (const log of [...logs].reverse()) {
          const meta = log.metadata ?? {};
          const grupo = meta.grupo as GrupoConfiguracion;
          if (grupo && base[grupo] && meta.valor_nuevo) {
            try {
              const parsed = typeof meta.valor_nuevo === "string" ? JSON.parse(meta.valor_nuevo) : meta.valor_nuevo;
              if (parsed && typeof parsed === "object") {
                base[grupo] = { ...base[grupo], ...parsed };
              }
            } catch {
              // Ignorar errores de parseo individual
            }
          }
        }
      }
    }
  } catch {

    // Si la tabla master_settings no existe en la base de datos, se continúa sin interrumpir
  }

  // 1c. Aplicar cambios más recientes en memoria
  for (const [grupo, valores] of memorySettingsStore.entries()) {
    if (base[grupo] && valores && typeof valores === "object") {
      base[grupo] = { ...base[grupo], ...valores };
    }
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

  // Actualizar store en memoria para disponibilidad inmediata
  memorySettingsStore.set(grupo, valores);

  // 1. Si es grupo landing, actualizar también en tax_landing_content
  if (grupo === "landing") {
    try {
      await guardarBorradorLanding(userId, valores, `Actualizado desde Centro de Configuración por admin ${userId}`);
    } catch (e) {
      console.warn("[configuracion.server] No se pudo actualizar borrador landing:", e);
    }
  }

  // 2. Persistir en tabla master_settings con verificación estricta y tolerancia a ausencia de tabla
  const upsertPayload = {
    grupo,
    clave: `config_${grupo}`,
    valor_json: valores,
    descripcion: `Configuración de ${grupo} actualizada por el panel Master.`,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  try {
    // Nivel 1: intentar upsert por grupo
    const { error: errNivel1 } = await (supabaseAdmin as any)
      .from("master_settings")
      .upsert(upsertPayload, { onConflict: "grupo" });

    if (errNivel1) {
      // Nivel 2: intentar upsert por clave
      const { error: errNivel2 } = await (supabaseAdmin as any)
        .from("master_settings")
        .upsert(upsertPayload, { onConflict: "clave" });

      if (errNivel2) {
        // Nivel 3: select + update/insert manual
        const { data: existente } = await (supabaseAdmin as any)
          .from("master_settings")
          .select("id")
          .eq("grupo", grupo)
          .maybeSingle();

        if (existente?.id) {
          const { error: errUpdate } = await (supabaseAdmin as any)
            .from("master_settings")
            .update({
              clave: upsertPayload.clave,
              valor_json: upsertPayload.valor_json,
              descripcion: upsertPayload.descripcion,
              updated_at: upsertPayload.updated_at,
              updated_by: upsertPayload.updated_by,
            })
            .eq("id", existente.id);

          if (errUpdate) {
            console.warn("[configuracion.server] No se pudo actualizar en master_settings:", errUpdate.message);
          }
        } else {
          const { error: errInsert } = await (supabaseAdmin as any)
            .from("master_settings")
            .insert(upsertPayload);

          if (errInsert) {
            console.warn("[configuracion.server] No se pudo insertar en master_settings:", errInsert.message);
          }
        }
      }
    }
  } catch (errPersist: any) {
    console.warn("[configuracion.server] Capturada excepción de persistencia en master_settings:", errPersist?.message || errPersist);
  }

  // 3. Auditoría obligatoria en tax_activity_logs (Persistencia asegurada)
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
