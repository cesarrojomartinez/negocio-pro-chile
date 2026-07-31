/**
 * Ampliación controlada del plan de ejecución (PlanAmendment).
 *
 * Cuando el listado oficial de F29 —ya aprobado por el plan— revela un folio
 * nuevo o una rectificatoria, ese PDF NO se descarga de inmediato. Se crea una
 * propuesta de ampliación, se revalida todo (permisos, bloqueo, idempotencia,
 * límites y presupuesto) y solo si queda aprobada el recurso entra al plan.
 *
 * Módulo puro: no consulta la base de datos, la red ni el proveedor. Nunca
 * recibe ni contiene la Clave Tributaria.
 */
import {
  COSTO_PDF_F29,
  MAX_PDF_POR_FOLIO,
  type SyncExecutionPlan,
} from "@/lib/syncPlan";

/** Motivo por el que se propone ampliar un plan ya aprobado. */
export type MotivoAmpliacion = "NEW_F29_FOLIO" | "RECTIFICATORY_F29";

/** Toda ampliación rechazada usa este código. Nunca se llama al proveedor. */
export const CODIGO_AMPLIACION_RECHAZADA = "PLAN_AMENDMENT_REJECTED";

export type MotivoRechazoAmpliacion =
  | "sin_permisos"
  | "bloqueo_no_vigente"
  | "folio_ya_descargado"
  | "ampliacion_duplicada"
  | "limite_pdf_por_folio"
  | "limite_global_del_plan"
  | "presupuesto_insuficiente"
  | "tope_de_consultas";

export interface PropuestaAmpliacion {
  planId: string;
  companyId: string;
  periodo: string;
  folioNuevo: string;
  folioAnterior: string | null;
  motivo: MotivoAmpliacion;
  /** Recurso requerido, con el mismo identificador que usa el portero. */
  recursoId: string;
  llamadasAdicionales: number;
  creditoAdicionalMin: number;
  creditoAdicionalMax: number;
}

export interface ContextoAmpliacion {
  /** El usuario sigue teniendo rol autorizado sobre la empresa. */
  permisosOk: boolean;
  /** El bloqueo de sincronización de esta empresa sigue activo. */
  bloqueoVigente: boolean;
  /** El folio ya está descargado y leído: no se paga dos veces. */
  folioYaDescargado: boolean;
  /** Ya existe una ampliación registrada para este plan, periodo y folio. */
  ampliacionPrevia: boolean;
  /** Descargas ya autorizadas para este folio dentro de la ejecución. */
  descargasDelFolio: number;
  /** Llamadas reales ya realizadas en la ejecución. */
  llamadasRealizadas: number;
  /** MAX_REAL_PROVIDER_REQUESTS_PER_SYNC. */
  maximoLlamadasPorEjecucion: number;
  /** El presupuesto mensual del usuario ya está agotado. */
  presupuestoBloqueado: boolean;
  /** Créditos que el presupuesto todavía admite. Null: sin tope definido. */
  creditoDisponible: number | null;
}

export type ResultadoAmpliacion =
  | { aprobada: true; propuesta: PropuestaAmpliacion }
  | {
      aprobada: false;
      codigo: typeof CODIGO_AMPLIACION_RECHAZADA;
      motivo: MotivoRechazoAmpliacion;
      mensajeUsuario: string;
    };

const MENSAJE_RECHAZO: Record<MotivoRechazoAmpliacion, string> = {
  sin_permisos: "No tienes permisos para descargar esta nueva declaración.",
  bloqueo_no_vigente:
    "La actualización ya había terminado, así que no descargamos la nueva declaración.",
  folio_ya_descargado: "Esta declaración ya estaba descargada y leída.",
  ampliacion_duplicada: "Esta nueva declaración ya se había considerado.",
  limite_pdf_por_folio: "Ya se descargó el máximo permitido para esta declaración.",
  limite_global_del_plan:
    "La actualización alcanzó su tope de consultas y no descargamos la nueva declaración.",
  presupuesto_insuficiente:
    "Detectamos una nueva declaración, pero tu presupuesto mensual no alcanza para descargarla. Tus datos anteriores siguen disponibles.",
  tope_de_consultas:
    "La actualización alcanzó su tope de consultas y no descargamos la nueva declaración.",
};

/** Identificador del recurso de descarga del PDF de un periodo. */
export function recursoPdfF29(periodo: string): string {
  return `f29_pdf:${periodo}`;
}

/** Arma la propuesta. No autoriza nada por sí sola. */
export function construirPropuestaAmpliacionF29(entrada: {
  planId: string;
  companyId: string;
  periodo: string;
  folioNuevo: string;
  folioAnterior: string | null;
}): PropuestaAmpliacion {
  return {
    planId: entrada.planId,
    companyId: entrada.companyId,
    periodo: entrada.periodo,
    folioNuevo: entrada.folioNuevo,
    folioAnterior: entrada.folioAnterior,
    motivo:
      entrada.folioAnterior && entrada.folioAnterior !== entrada.folioNuevo
        ? "RECTIFICATORY_F29"
        : "NEW_F29_FOLIO",
    recursoId: recursoPdfF29(entrada.periodo),
    llamadasAdicionales: MAX_PDF_POR_FOLIO,
    creditoAdicionalMin: 0,
    creditoAdicionalMax: Number((MAX_PDF_POR_FOLIO * COSTO_PDF_F29).toFixed(4)),
  };
}

function rechazo(motivo: MotivoRechazoAmpliacion): ResultadoAmpliacion {
  return {
    aprobada: false,
    codigo: CODIGO_AMPLIACION_RECHAZADA,
    motivo,
    mensajeUsuario: MENSAJE_RECHAZO[motivo],
  };
}

/**
 * Revalida la propuesta completa. Cualquier duda rechaza: nunca se aprueba
 * "por ser rectificatoria" ni por ningún otro atributo del recurso.
 */
export function evaluarAmpliacion(
  plan: SyncExecutionPlan,
  propuesta: PropuestaAmpliacion,
  contexto: ContextoAmpliacion,
): ResultadoAmpliacion {
  if (!contexto.permisosOk) return rechazo("sin_permisos");
  if (!contexto.bloqueoVigente) return rechazo("bloqueo_no_vigente");
  if (contexto.folioYaDescargado) return rechazo("folio_ya_descargado");
  if (contexto.ampliacionPrevia) return rechazo("ampliacion_duplicada");
  if (contexto.descargasDelFolio >= MAX_PDF_POR_FOLIO)
    return rechazo("limite_pdf_por_folio");

  const totalPrevisto = plan.expectedProviderCalls + propuesta.llamadasAdicionales;
  if (totalPrevisto > contexto.maximoLlamadasPorEjecucion)
    return rechazo("limite_global_del_plan");
  if (
    contexto.llamadasRealizadas + propuesta.llamadasAdicionales >
    contexto.maximoLlamadasPorEjecucion
  )
    return rechazo("tope_de_consultas");

  if (contexto.presupuestoBloqueado) return rechazo("presupuesto_insuficiente");
  if (
    contexto.creditoDisponible != null &&
    contexto.creditoDisponible < propuesta.creditoAdicionalMax
  )
    return rechazo("presupuesto_insuficiente");

  return { aprobada: true, propuesta };
}
