/**
 * Estado de frescura y caché por empresa y periodo.
 *
 * Guarda cuándo se consultó por última vez al proveedor, si la respuesta vino
 * de la caché y cuándo conviene volver a consultar. No calcula impuestos.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evaluarFrescura, type EstadoFrescura } from "@/lib/freshness";

export interface EstadoSincronizacionPeriodo {
  periodo: string;
  proveedor: string;
  ultimaSincronizacionExitosa: string | null;
  ultimoIntento: string | null;
  ultimaConsultaProveedor: string | null;
  ultimoUsoDeCache: string | null;
  datosHasta: string | null;
  estadoFrescura: EstadoFrescura;
  proximaActualizacionRecomendada: string | null;
  consultasProveedor: number;
  usosDeCache: number;
}

/** Verdadero cuando el mes indicado (AAAA-MM) ya terminó. */
export function periodoYaTermino(periodo: string = "2026-07", ahora: Date): boolean {
  if (!periodo || typeof periodo !== "string" || !periodo.includes("-")) return false;
  const [a, m] = periodo.split("-").map(Number);
  const finDelMes = Date.UTC(a, m, 1, 4, 0, 0);
  return ahora.getTime() >= finDelMes;
}

interface RegistroEntrada {
  companyId: string;
  periodId: string;
  periodo: string;
  proveedor: string;
  ahora: Date;
  ejecutada: boolean;
  exitosa: boolean;
  desdeCache: boolean;
  syncRunId?: string | null;
  triggerType?: string | null;
  datosHasta?: string | null;
  periodoConfirmado?: boolean;
}

/** Registra el resultado de un intento de sincronización. */
export async function registrarEstadoPeriodo(entrada: RegistroEntrada): Promise<void> {
  const { data: previo } = await supabaseAdmin
    .from("tax_period_sync_state")
    .select("*")
    .eq("company_id", entrada.companyId)
    .eq("tax_period_id", entrada.periodId)
    .eq("provider", entrada.proveedor)
    .maybeSingle();

  const ahoraIso = entrada.ahora.toISOString();
  const ultimaExitosa = entrada.exitosa
    ? ahoraIso
    : ((previo?.last_successful_sync_at as string | null) ?? null);

  const frescura = evaluarFrescura({
    ahora: entrada.ahora,
    ultimaSincronizacionExitosa: ultimaExitosa,
    periodoCerrado: periodoYaTermino(entrada.periodo, entrada.ahora),
    periodoConfirmado: entrada.periodoConfirmado,
  });

  await supabaseAdmin.from("tax_period_sync_state").upsert(
    {
      company_id: entrada.companyId,
      tax_period_id: entrada.periodId,
      provider: entrada.proveedor,
      last_successful_sync_at: ultimaExitosa,
      last_attempt_at: ahoraIso,
      last_provider_request_at: entrada.ejecutada
        ? ahoraIso
        : ((previo?.last_provider_request_at as string | null) ?? null),
      last_cache_hit_at: entrada.desdeCache
        ? ahoraIso
        : ((previo?.last_cache_hit_at as string | null) ?? null),
      last_sync_run_id: entrada.syncRunId ?? null,
      last_trigger_type: entrada.triggerType ?? null,
      data_through_date:
        entrada.datosHasta ?? ((previo?.data_through_date as string | null) ?? null),
      freshness_status: frescura.estado,
      next_recommended_sync_at: frescura.proximaActualizacionRecomendada,
      provider_request_count:
        (Number(previo?.provider_request_count ?? 0) || 0) + (entrada.ejecutada ? 1 : 0),
      cache_hit_count:
        (Number(previo?.cache_hit_count ?? 0) || 0) + (entrada.desdeCache ? 1 : 0),
    },
    { onConflict: "company_id,tax_period_id,provider" },
  );
}

/** Lee el estado guardado y lo reevalúa con el reloj actual. */
export async function leerEstadoPeriodo(
  companyId: string,
  periodId: string,
  periodo: string,
  ahora: Date,
  periodoConfirmado: boolean,
): Promise<EstadoSincronizacionPeriodo | null> {
  const { data } = await supabaseAdmin
    .from("tax_period_sync_state")
    .select("*")
    .eq("company_id", companyId)
    .eq("tax_period_id", periodId)
    .order("last_attempt_at", { ascending: false, nullsFirst: false })
    .limit(1);

  const fila = data?.[0];
  const frescura = evaluarFrescura({
    ahora,
    ultimaSincronizacionExitosa: (fila?.last_successful_sync_at as string) ?? null,
    periodoCerrado: periodoYaTermino(periodo, ahora),
    periodoConfirmado,
  });

  return {
    periodo,
    proveedor: (fila?.provider as string) ?? "mock",
    ultimaSincronizacionExitosa: (fila?.last_successful_sync_at as string) ?? null,
    ultimoIntento: (fila?.last_attempt_at as string) ?? null,
    ultimaConsultaProveedor: (fila?.last_provider_request_at as string) ?? null,
    ultimoUsoDeCache: (fila?.last_cache_hit_at as string) ?? null,
    datosHasta: (fila?.data_through_date as string) ?? null,
    estadoFrescura: frescura.estado,
    proximaActualizacionRecomendada: frescura.proximaActualizacionRecomendada,
    consultasProveedor: Number(fila?.provider_request_count ?? 0),
    usosDeCache: Number(fila?.cache_hit_count ?? 0),
  };
}
