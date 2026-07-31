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
const COSTO_PDF_F29 = 0.05;

export const CODIGO_GUARDA_CREDITOS = "INTERNAL_CREDIT_GUARD";

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
  possibleNewFolios: string[];
  expectedProviderCalls: number;
  expectedCreditRange: { min: number; max: number };
  skippedResources: RecursoOmitido[];
  skipReasons: string[];
  requiresCredentials: boolean;
  executionMode: "manual_secure" | "automated_authorized";
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

    if (decision.revisarListadoF29) anios.add(periodo.slice(0, 4));
    else
      skippedResources.push({
        periodo,
        recurso: "f29_listado",
        motivo: decision.motivo,
        mensaje: decision.mensaje,
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
    } else if (decision.revisarListadoF29 && !estado.tieneF29Vigente) {
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

  return {
    companyId: entrada.companyId,
    requestedPeriods: periodos,
    periodsUsingCache,
    periodsRequiringRcv,
    yearsRequiringF29List,
    knownFolios,
    possibleNewFolios,
    expectedProviderCalls,
    expectedCreditRange: { min, max },
    skippedResources,
    skipReasons: Array.from(skipReasons),
    requiresCredentials: expectedProviderCalls > 0,
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
