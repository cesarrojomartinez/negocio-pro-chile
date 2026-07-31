/**
 * Listado anual de declaraciones de F29, agrupado y con caché.
 *
 * Antes se pedía un listado por cada mes actualizado. El recurso oficial acepta
 * el AÑO completo, así que actualizar mayo, junio y julio de 2026 necesita UNA
 * sola consulta. Además:
 *  - se reutiliza el listado guardado del mismo día (base de datos);
 *  - se reutiliza el listado dentro de la misma ejecución (memoria);
 *  - la clave de idempotencia impide que un doble clic consulte dos veces.
 *
 * Solo servidor. Nunca guarda ni registra la Clave Tributaria.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  requestApiGateway,
  type ApiGatewayConfig,
  type ApiGatewayCallLog,
  type RegistroConsumo,
} from "@/integrations/sii/apiGatewayClient";
import { recursoDe } from "@/integrations/sii/apiGatewayResourceMap";
import { sanitizarProfundo } from "@/integrations/sii/sanitize";
import { claveIdempotencia } from "@/lib/syncEconomica";
import type { ControlPlanEjecucion } from "@/lib/syncPlan";

/** Referencia con la que se guarda el listado anual en los respaldos. */
export function referenciaListadoAnual(anio: string): string {
  return `f29:listado-anual:${anio}`;
}

export interface ResultadoListadoF29 {
  crudo: unknown;
  /** Verdadero cuando NO se llamó al proveedor. */
  desdeCache: boolean;
  origen: "memoria" | "base_de_datos" | "proveedor";
  log: ApiGatewayCallLog | null;
  /** Ruta consultada (o que se habría consultado). */
  recurso: string;
}

/**
 * Caché en memoria de la ejecución en curso. Evita que dos periodos del mismo
 * año, o un doble clic, generen dos llamadas.
 */
const enVuelo = new Map<string, Promise<ResultadoListadoF29>>();

async function listadoDelDia(companyId: string, anio: string): Promise<unknown | null> {
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);
  const { data } = await supabaseAdmin
    .from("tax_provider_snapshots")
    .select("payload")
    .eq("company_id", companyId)
    .eq("module", "f29_periods")
    .eq("provider_reference", referenciaListadoAnual(anio))
    .gte("received_at", desde.toISOString())
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const payload = data?.payload as { contenido?: unknown } | null;
  return payload?.contenido ?? null;
}

export interface EntradaListadoF29 {
  companyId: string;
  /** Año en formato AAAA. */
  anio: string;
  config: ApiGatewayConfig;
  /** Cuerpo de autenticación ya construido. Nunca se guarda. */
  cuerpo: object;
  /** Contador único de la ejecución: el gasto queda en el registro principal. */
  registro: RegistroConsumo;
  tipo?: string;
  /** Portero del plan aprobado. Sin permiso no se consulta al proveedor. */
  control?: ControlPlanEjecucion;
}

/**
 * Devuelve el listado anual de declaraciones, consultando al proveedor como
 * máximo una vez por empresa, año y día.
 */
export async function obtenerListadoF29Anual(
  entrada: EntradaListadoF29,
): Promise<ResultadoListadoF29> {
  const clave = claveIdempotencia({
    companyId: entrada.companyId,
    periodoOAnio: entrada.anio,
    modulo: "f29_periods",
    recurso: "listado_anual",
    tipo: entrada.tipo,
  });
  const enCurso = enVuelo.get(clave);
  if (enCurso) return enCurso;

  const trabajo = (async (): Promise<ResultadoListadoF29> => {
    const recurso = recursoDe("f29_periods").path.replace("{periodo}", entrada.anio);

    const guardado = await listadoDelDia(entrada.companyId, entrada.anio);
    if (guardado) {
      entrada.control?.registrarCache(
        `f29_listado:${entrada.anio}`,
        "listado_anual_en_cache",
      );
      return {
        crudo: guardado,
        desdeCache: true,
        origen: "base_de_datos",
        log: null,
        recurso,
      };
    }

    entrada.control?.autorizar(`f29_listado:${entrada.anio}`);
    const { datos, log } = await requestApiGateway<object, unknown>({
      config: entrada.config,
      modulo: "f29_periods",
      metodo: "POST",
      ruta: recurso,
      body: entrada.cuerpo,
      registro: entrada.registro,
      sinReintentos: true,
    });
    const crudo = sanitizarProfundo(datos);
    const ahora = new Date().toISOString();
    await supabaseAdmin.from("tax_provider_snapshots").insert({
      company_id: entrada.companyId,
      provider: "api_gateway",
      module: "f29_periods",
      provider_reference: referenciaListadoAnual(entrada.anio),
      payload: sanitizarProfundo({ contenido: crudo }) as never,
      received_at: ahora,
      normalized_at: ahora,
    });
    return { crudo, desdeCache: false, origen: "proveedor", log, recurso };
  })();

  enVuelo.set(clave, trabajo);
  try {
    return await trabajo;
  } finally {
    // La memoria solo protege la ejecución en curso: la vigencia real la
    // controla el respaldo guardado del día.
    setTimeout(() => enVuelo.delete(clave), 0);
  }
}

/** Solo para pruebas: limpia la caché en memoria. */
export function limpiarCacheListadoF29(): void {
  enVuelo.clear();
}
