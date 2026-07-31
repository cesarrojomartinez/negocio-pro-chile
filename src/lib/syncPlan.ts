/**
 * Plan de ejecución previo a cualquier llamada al proveedor.
 *
 * Módulo puro: no consulta la base de datos ni la red. Recibe lo que la
 * aplicación ya sabe de cada periodo y devuelve exactamente qué se va a pedir,
 * qué se reutiliza y cuántos créditos puede costar como máximo.
 *
 * El plan JAMÁS contiene la Clave Tributaria ni ningún dato de acceso.
 */
import {
  decidirActualizacionPeriodo,
  periodoEnCurso,
  puedeReintentarDescargaF29,
  type MotivoActualizacion,
} from "@/lib/syncEconomica";
/** Solo el tipo: la evaluación de la ampliación vive en `planAmendment`. */
import type { PropuestaAmpliacion } from "@/lib/planAmendment";

/** Ampliación ya aprobada por `evaluarAmpliacion`. */
export type AmpliacionAprobada = PropuestaAmpliacion;

/* --------------------------- Límites internos --------------------------- */

/** Máximo de llamadas al RCV por periodo que realmente lo necesita. */
export const MAX_RCV_POR_PERIODO = 2;
/** Máximo de listados de F29 por empresa y año en una misma ejecución. */
export const MAX_LISTADO_F29_POR_ANIO = 1;
/** Máximo de descargas de PDF por folio. */
export const MAX_PDF_POR_FOLIO = 1;
/** Costo estimado de referencia por tipo de recurso (solo para el rango). */
const COSTO_RCV = 0.06;
const COSTO_LISTADO_F29 = 0.05;
export const COSTO_PDF_F29 = 0.05;

export const CODIGO_GUARDA_CREDITOS = "INTERNAL_CREDIT_GUARD";
/** Se intentó consultar un recurso que el plan aprobado no contempla. */
export const CODIGO_LLAMADA_NO_PLANIFICADA = "UNPLANNED_PROVIDER_CALL";


/* ------------------------------- Entradas ------------------------------- */

export interface EstadoPeriodoConocido {
  periodo: string;
  /** Última sincronización exitosa del RCV de este periodo. */
  ultimaSincronizacionRcv: string | null;
  tieneDatosRcv: boolean;
  tieneF29Vigente: boolean;
  periodoCerrado: boolean;
  /** Folio del F29 ya conocido y leído para el periodo. */
  folioConocido: string | null;
  /** Último fallo de descarga del PDF, para respetar la espera de 24 horas. */
  ultimoFalloDescargaF29: string | null;
  /**
   * La lectura local del PDF falló pero el archivo está guardado: se
   * reprocesa sin costo y nunca se vuelve a descargar.
   */
  pdfGuardadoPendienteDeLectura?: boolean;
}

export interface EntradaPlan {
  companyId: string;
  requestedPeriods: string[];
  estados: EstadoPeriodoConocido[];
  ahora: Date;
  executionMode: "manual_secure" | "automated_authorized";
  /** Diagnóstico interno: permite el detalle documental. Nunca en flujo normal. */
  permitirDetalleDocumental?: boolean;
}

/* ------------------------------- Salidas -------------------------------- */

export interface RecursoOmitido {
  periodo: string;
  recurso: "rcv" | "f29_listado" | "f29_pdf" | "detalle_documental";
  motivo: MotivoActualizacion | "sin_folio_nuevo" | "espera_tras_fallo" | "diagnostico";
  mensaje: string;
}

export interface SyncExecutionPlan {
  companyId: string;
  requestedPeriods: string[];
  periodsUsingCache: string[];
  periodsRequiringRcv: string[];
  yearsRequiringF29List: string[];
  knownFolios: Record<string, string>;
  /** Periodos cuyo Formulario 29 puede necesitar descarga de PDF. */
  possibleNewFolios: string[];
  /** Mismo contenido que `possibleNewFolios`, con el nombre del contrato. */
  foliosRequiringDownload: string[];
  expectedProviderCalls: number;
  expectedRcvCalls: number;
  expectedF29Calls: number;
  expectedPdfDownloads: number;
  expectedCreditRange: { min: number; max: number };
  /** Recursos aprobados, con su cupo máximo de llamadas. */
  approvedResources: RecursoPlanificado[];
  skippedResources: RecursoOmitido[];
  skipReasons: string[];
  requiresCredentials: boolean;
  /**
   * Detalle documento por documento. Falso en la actualización normal: solo se
   * habilita cuando el propio plan lo autoriza de forma explícita.
   */
  allowsDocumentDetail: boolean;
  executionMode: "manual_secure" | "automated_authorized";
  /** Verdadero si durante la ejecución se aprobó una ampliación del plan. */
  planAmended?: boolean;
  /** Ampliaciones aprobadas, en orden. Nunca contienen datos de acceso. */
  amendments?: AmpliacionAprobada[];
}

/** Recurso aprobado por el plan. Nunca contiene datos de acceso. */
export interface RecursoPlanificado {
  /** Identificador estable: `rcv:2026-06`, `f29_listado:2026`, `f29_pdf:2026-06`. */
  id: string;
  recurso: "rcv" | "f29_listado" | "f29_pdf";
  referencia: string;
  /** Máximo de llamadas reales permitidas para este recurso. */
  cupo: number;
}


export interface GuardaCreditos {
  ok: boolean;
  codigo?: typeof CODIGO_GUARDA_CREDITOS;
  /** Mensaje simple para el cliente. */
  mensajeUsuario?: string;
  /** Detalle técnico, solo para el panel administrativo. */
  detalle?: string[];
}

/** Construye el plan. No realiza ninguna consulta. */
export function construirPlanEjecucion(entrada: EntradaPlan): SyncExecutionPlan {
  const actual = periodoEnCurso(entrada.ahora);
  const periodos = Array.from(new Set(entrada.requestedPeriods)).sort();
  const porPeriodo = new Map(entrada.estados.map((e) => [e.periodo, e]));

  const periodsUsingCache: string[] = [];
  const periodsRequiringRcv: string[] = [];
  const anios = new Set<string>();
  const knownFolios: Record<string, string> = {};
  const possibleNewFolios: string[] = [];
  const skippedResources: RecursoOmitido[] = [];
  const skipReasons = new Set<string>();

  for (const periodo of periodos) {
    const estado: EstadoPeriodoConocido = porPeriodo.get(periodo) ?? {
      periodo,
      ultimaSincronizacionRcv: null,
      tieneDatosRcv: false,
      tieneF29Vigente: false,
      periodoCerrado: false,
      folioConocido: null,
      ultimoFalloDescargaF29: null,
    };

    if (estado.folioConocido) knownFolios[periodo] = estado.folioConocido;

    const decision = decidirActualizacionPeriodo({
      periodo,
      periodoActual: actual,
      ahora: entrada.ahora,
      ultimaSincronizacionRcv: estado.ultimaSincronizacionRcv,
      tieneF29Vigente: estado.tieneF29Vigente,
      periodoCerrado: estado.periodoCerrado,
      tieneDatosRcv: estado.tieneDatosRcv,
    });

    if (decision.consultarRcv) periodsRequiringRcv.push(periodo);
    else {
      periodsUsingCache.push(periodo);
      skippedResources.push({
        periodo,
        recurso: "rcv",
        motivo: decision.motivo,
        mensaje: decision.mensaje,
      });
      skipReasons.add(decision.mensaje);
    }

    // El listado anual solo se pide si aporta algo: si el periodo ya tiene su
    // F29 leído y su RCV vigente, no hay nada nuevo que revisar.
    const listadoUtil =
      decision.revisarListadoF29 &&
      !(estado.tieneF29Vigente && !decision.consultarRcv);
    if (listadoUtil) anios.add(periodo.slice(0, 4));
    else
      skippedResources.push({
        periodo,
        recurso: "f29_listado",
        motivo: decision.revisarListadoF29 ? "sin_folio_nuevo" : decision.motivo,
        mensaje: decision.revisarListadoF29
          ? "Este periodo ya tiene su Formulario 29 leído."
          : decision.mensaje,
      });

    // PDF del F29: solo con folio nuevo posible, sin fallo reciente y sin
    // archivo ya guardado pendiente de una relectura local (costo cero).
    const esperaActiva = !puedeReintentarDescargaF29(
      estado.ultimoFalloDescargaF29,
      entrada.ahora,
    );
    if (estado.pdfGuardadoPendienteDeLectura) {
      skippedResources.push({
        periodo,
        recurso: "f29_pdf",
        motivo: "sin_folio_nuevo",
        mensaje: "El archivo ya está guardado: se vuelve a leer sin costo.",
      });
    } else if (esperaActiva) {
      skippedResources.push({
        periodo,
        recurso: "f29_pdf",
        motivo: "espera_tras_fallo",
        mensaje: "La descarga anterior falló: se reintenta después de 24 horas.",
      });
    } else if (listadoUtil && !estado.tieneF29Vigente) {
      possibleNewFolios.push(periodo);
    } else {
      skippedResources.push({
        periodo,
        recurso: "f29_pdf",
        motivo: "sin_folio_nuevo",
        mensaje: "Este periodo ya tiene su Formulario 29 leído.",
      });
    }

    if (!entrada.permitirDetalleDocumental)
      skippedResources.push({
        periodo,
        recurso: "detalle_documental",
        motivo: "diagnostico",
        mensaje:
          "El detalle documento por documento queda disponible solo para diagnóstico interno.",
      });
  }

  const yearsRequiringF29List = Array.from(anios).sort();
  const llamadasRcv = periodsRequiringRcv.length * MAX_RCV_POR_PERIODO;
  const llamadasListado = yearsRequiringF29List.length * MAX_LISTADO_F29_POR_ANIO;
  const llamadasPdf = possibleNewFolios.length * MAX_PDF_POR_FOLIO;

  const expectedProviderCalls = llamadasRcv + llamadasListado + llamadasPdf;
  const min = Number(
    (periodsRequiringRcv.length * COSTO_RCV + llamadasListado * COSTO_LISTADO_F29).toFixed(4),
  );
  const max = Number(
    (
      llamadasRcv * COSTO_RCV +
      llamadasListado * COSTO_LISTADO_F29 +
      llamadasPdf * COSTO_PDF_F29
    ).toFixed(4),
  );

  const approvedResources: RecursoPlanificado[] = [
    ...periodsRequiringRcv.map((p) => ({
      id: `rcv:${p}`,
      recurso: "rcv" as const,
      referencia: p,
      cupo: MAX_RCV_POR_PERIODO,
    })),
    ...yearsRequiringF29List.map((a) => ({
      id: `f29_listado:${a}`,
      recurso: "f29_listado" as const,
      referencia: a,
      cupo: MAX_LISTADO_F29_POR_ANIO,
    })),
    ...possibleNewFolios.map((p) => ({
      id: `f29_pdf:${p}`,
      recurso: "f29_pdf" as const,
      referencia: p,
      cupo: MAX_PDF_POR_FOLIO,
    })),
  ];

  return {
    companyId: entrada.companyId,
    requestedPeriods: periodos,
    periodsUsingCache,
    periodsRequiringRcv,
    yearsRequiringF29List,
    knownFolios,
    possibleNewFolios,
    foliosRequiringDownload: possibleNewFolios.slice(),
    expectedProviderCalls,
    expectedRcvCalls: llamadasRcv,
    expectedF29Calls: llamadasListado,
    expectedPdfDownloads: llamadasPdf,
    expectedCreditRange: { min, max },
    approvedResources,
    skippedResources,
    skipReasons: Array.from(skipReasons),
    requiresCredentials: expectedProviderCalls > 0,
    allowsDocumentDetail: entrada.permitirDetalleDocumental === true,
    executionMode: entrada.executionMode,
  };
}


/**
 * Guarda de consumo: si el plan pide más de lo permitido, se cancela ANTES de
 * llamar al proveedor. Una ejecución que ya se sabe anormal no debe cobrarse.
 */
export function verificarLimitesPlan(plan: SyncExecutionPlan): GuardaCreditos {
  const detalle: string[] = [];

  const maximoRcv = plan.periodsRequiringRcv.length * MAX_RCV_POR_PERIODO;
  const maximoListado = plan.yearsRequiringF29List.length * MAX_LISTADO_F29_POR_ANIO;
  const maximoPdf = plan.possibleNewFolios.length * MAX_PDF_POR_FOLIO;
  const tope = maximoRcv + maximoListado + maximoPdf;

  if (plan.expectedProviderCalls > tope)
    detalle.push(
      `El plan estima ${plan.expectedProviderCalls} llamadas y el tope interno es ${tope}.`,
    );

  const aniosDuplicados =
    new Set(plan.yearsRequiringF29List).size !== plan.yearsRequiringF29List.length;
  if (aniosDuplicados)
    detalle.push("Hay más de un listado anual de F29 para el mismo año.");

  const foliosDuplicados =
    new Set(plan.possibleNewFolios).size !== plan.possibleNewFolios.length;
  if (foliosDuplicados) detalle.push("Hay más de una descarga para el mismo folio.");

  if (
    plan.allowsDocumentDetail !== true &&
    plan.skippedResources.some((r) => r.recurso === "detalle_documental") === false &&
    plan.requestedPeriods.length > 0
  )
    detalle.push("El plan incluye detalle documental en una actualización normal.");

  if (detalle.length === 0) return { ok: true };

  return {
    ok: false,
    codigo: CODIGO_GUARDA_CREDITOS,
    mensajeUsuario:
      "Detuvimos la actualización por precaución antes de consultar al SII. No se consumieron créditos. Intenta nuevamente con menos periodos.",
    detalle,
  };
}

/* ---------------- Control del plan durante la ejecución ---------------- */

/** Error de gobernanza del plan. Nunca contiene datos de acceso. */
export class ErrorPlanEjecucion extends Error {
  readonly codigo: string;
  readonly recursoId: string;
  constructor(codigo: string, recursoId: string, mensaje: string) {
    super(mensaje);
    this.name = "ErrorPlanEjecucion";
    this.codigo = codigo;
    this.recursoId = recursoId;
  }
}

export interface LlamadaControlada {
  planResourceId: string;
  planned: boolean;
  providerCalled: boolean;
  result: "ejecutada" | "bloqueada";
  skipReason: string | null;
}

/**
 * Portero de la ejecución: cada llamada real al proveedor debe pedir permiso.
 * Si el recurso no está en el plan aprobado, o ya agotó su cupo, la llamada se
 * detiene ANTES de salir a la red y no se consumen créditos.
 */
export class ControlPlanEjecucion {
  readonly plan: SyncExecutionPlan;
  private readonly cupos = new Map<string, number>();
  private readonly usos = new Map<string, number>();
  readonly llamadas: LlamadaControlada[] = [];
  bloqueadas = 0;

  constructor(plan: SyncExecutionPlan) {
    this.plan = plan;
    for (const r of plan.approvedResources) this.cupos.set(r.id, r.cupo);
  }

  /** Llamadas reales autorizadas hasta el momento. */
  get llamadasReales(): number {
    return this.llamadas.filter((l) => l.providerCalled).length;
  }

  estaPlanificado(recursoId: string): boolean {
    return this.cupos.has(recursoId);
  }

  /** Llamadas ya autorizadas para un recurso concreto. */
  consumoDeRecurso(recursoId: string): number {
    return this.usos.get(recursoId) ?? 0;
  }

  /** Autoriza una llamada real. Lanza `ErrorPlanEjecucion` si no corresponde. */
  autorizar(recursoId: string): void {
    const cupo = this.cupos.get(recursoId);
    const usadas = this.usos.get(recursoId) ?? 0;
    if (cupo == null || usadas >= cupo) {
      this.bloqueadas += 1;
      this.llamadas.push({
        planResourceId: recursoId,
        planned: cupo != null,
        providerCalled: false,
        result: "bloqueada",
        skipReason:
          cupo == null ? "recurso_fuera_del_plan" : "cupo_del_plan_agotado",
      });
      throw new ErrorPlanEjecucion(
        CODIGO_LLAMADA_NO_PLANIFICADA,
        recursoId,
        "Detuvimos una consulta que no estaba prevista en la actualización. Tus datos guardados no cambiaron.",
      );
    }
    this.usos.set(recursoId, usadas + 1);
    this.llamadas.push({
      planResourceId: recursoId,
      planned: true,
      providerCalled: true,
      result: "ejecutada",
      skipReason: null,
    });
  }

  /**
   * Incorpora un recurso al plan SOLO a partir de una ampliación ya aprobada
   * (PlanAmendment). No existe ningún otro camino: el portero jamás autoriza
   * por tipo de recurso, por folio nuevo, por rectificatoria ni por rol.
   */
  aplicarAmpliacion(ampliacion: AmpliacionAprobada): void {
    if (this.cupos.has(ampliacion.recursoId)) return;
    this.cupos.set(ampliacion.recursoId, ampliacion.llamadasAdicionales);
    this.plan.approvedResources.push({
      id: ampliacion.recursoId,
      recurso: "f29_pdf",
      referencia: ampliacion.periodo,
      cupo: ampliacion.llamadasAdicionales,
    });
    if (!this.plan.foliosRequiringDownload.includes(ampliacion.periodo))
      this.plan.foliosRequiringDownload.push(ampliacion.periodo);
    this.plan.expectedPdfDownloads += ampliacion.llamadasAdicionales;
    this.plan.expectedProviderCalls += ampliacion.llamadasAdicionales;
    this.plan.expectedCreditRange = {
      min: this.plan.expectedCreditRange.min,
      max: Number(
        (this.plan.expectedCreditRange.max + ampliacion.creditoAdicionalMax).toFixed(4),
      ),
    };
    this.plan.planAmended = true;
    this.plan.amendments = [...(this.plan.amendments ?? []), ampliacion];
  }

  /** Registra que un recurso planificado se resolvió con caché, sin costo. */
  registrarCache(recursoId: string, motivo: string): void {
    this.llamadas.push({
      planResourceId: recursoId,
      planned: this.estaPlanificado(recursoId),
      providerCalled: false,
      result: "ejecutada",
      skipReason: motivo,
    });
  }
}

export type EstadoPlan =
  | "planned"
  | "approved"
  | "cache_only"
  | "completed_as_planned"
  | "completed_below_plan"
  | "stopped_by_guard"
  | "diverged"
  | "failed";

export interface ResumenPlanVsReal {
  plannedCalls: number;
  actualCalls: number;
  plannedCreditMin: number;
  plannedCreditMax: number;
  actualCredits: number;
  callsAvoidedByCache: number;
  unplannedCallsBlocked: number;
  planStatus: EstadoPlan;
}

/** Compara lo planificado con lo realmente ejecutado. */
export function resumenPlanVsReal(
  control: ControlPlanEjecucion,
  actualCredits: number,
  fallo = false,
): ResumenPlanVsReal {
  const plan = control.plan;
  const actualCalls = control.llamadasReales;
  const base: Omit<ResumenPlanVsReal, "planStatus"> = {
    plannedCalls: plan.expectedProviderCalls,
    actualCalls,
    plannedCreditMin: plan.expectedCreditRange.min,
    plannedCreditMax: plan.expectedCreditRange.max,
    actualCredits: Number(actualCredits.toFixed(4)),
    callsAvoidedByCache: plan.periodsUsingCache.length,
    unplannedCallsBlocked: control.bloqueadas,
  };

  let planStatus: EstadoPlan;
  if (fallo) planStatus = "failed";
  else if (control.bloqueadas > 0) planStatus = "stopped_by_guard";
  else if (plan.expectedProviderCalls === 0 && actualCalls === 0)
    planStatus = "cache_only";
  else if (actualCalls > plan.expectedProviderCalls) planStatus = "diverged";
  else if (actualCalls < plan.expectedProviderCalls)
    planStatus = "completed_below_plan";
  else planStatus = "completed_as_planned";

  return { ...base, planStatus };
}
