/**
 * Política interna de sincronización económica.
 *
 * Todo lo que hay aquí es automático y NO se expone en la interfaz: el cliente
 * sigue teniendo un único botón "Actualizar". Estas reglas solo deciden, puertas
 * adentro, qué vale la pena preguntarle al proveedor para no gastar créditos en
 * información que la aplicación ya tiene o que no muestra.
 *
 * Módulo puro: sin red, sin base de datos, sin reloj propio.
 */

/**
 * Estados de compras que participan del flujo normal. Los estados PENDIENTE,
 * RECLAMADO y NO_INCLUIR no forman parte del IVA crédito que muestra el panel
 * y quedan reservados para auditorías internas.
 * NO se expone en la interfaz.
 */
export const NORMAL_SYNC_PURCHASE_STATES = ["REGISTRO"] as const;

/** En la actualización normal no se descarga el detalle documento por documento. */
export const NORMAL_SYNC_FETCH_DOCUMENT_DETAIL = false;

/** Frescura del RCV del mes en curso. */
export const HORAS_FRESCURA_MES_EN_CURSO = 24;
/** Frescura del RCV de un mes ya terminado que todavía no tiene F29. */
export const HORAS_FRESCURA_MES_SIN_F29 = 72;
/** Espera obligatoria tras un fallo de descarga del PDF del F29. */
export const HORAS_ESPERA_FALLO_DESCARGA_F29 = 24;

export type MotivoActualizacion =
  | "sin_datos_previos"
  | "sin_documentos_rcv"
  | "mes_en_curso_vencido"
  | "mes_sin_f29_vencido"
  | "rcv_vigente"
  | "periodo_con_f29_vigente"
  | "periodo_cerrado";


export const MENSAJE_MOTIVO_ECONOMICO: Record<MotivoActualizacion, string> = {
  sin_datos_previos: "Es la primera vez que consultamos este periodo.",
  mes_en_curso_vencido: "El mes en curso se actualiza una vez al día.",
  mes_sin_f29_vencido: "Este mes todavía no tiene Formulario 29 y se revisa cada tres días.",
  rcv_vigente: "Ya tienes información reciente de este periodo.",
  periodo_con_f29_vigente:
    "Este periodo ya tiene su Formulario 29 leído: sus cifras no cambian.",
  periodo_cerrado: "Este periodo está cerrado y usa la información guardada.",
};

export interface EntradaDecisionPeriodo {
  /** Periodo consultado, siempre AAAA-MM. */
  periodo: string;
  /** Mes en curso en Chile, AAAA-MM. */
  periodoActual: string;
  ahora: Date;
  /** Última sincronización exitosa del RCV de ESTE periodo. */
  ultimaSincronizacionRcv: string | null;
  /** El periodo ya tiene una extracción válida del F29 vigente. */
  tieneF29Vigente: boolean;
  /** El periodo fue confirmado o cerrado por el usuario. */
  periodoCerrado: boolean;
}

export interface DecisionPeriodo {
  /** Consultar los resúmenes del RCV (ventas + compras REGISTRO). */
  consultarRcv: boolean;
  /** Revisar el listado anual de F29 (agrupado por año y con caché diaria). */
  revisarListadoF29: boolean;
  motivo: MotivoActualizacion;
  mensaje: string;
}

function horasEntre(ahora: Date, iso: string): number {
  return (ahora.getTime() - new Date(iso).getTime()) / 3_600_000;
}

/**
 * Decide, para UN periodo, si hace falta volver a consultar al proveedor.
 * Cada periodo se evalúa por separado: seleccionar varios meses no invalida
 * la caché de todos.
 */
export function decidirActualizacionPeriodo(
  entrada: EntradaDecisionPeriodo,
): DecisionPeriodo {
  const armar = (
    consultarRcv: boolean,
    revisarListadoF29: boolean,
    motivo: MotivoActualizacion,
  ): DecisionPeriodo => ({
    consultarRcv,
    revisarListadoF29,
    motivo,
    mensaje: MENSAJE_MOTIVO_ECONOMICO[motivo],
  });

  // Periodo cerrado por el usuario: no se consulta nada más.
  if (entrada.periodoCerrado) return armar(false, false, "periodo_cerrado");

  // Periodo con F29 leído y vigente: sus cifras son definitivas. Solo se revisa
  // el listado anual (que ya viene agrupado y con caché) por si hay una
  // rectificatoria con folio nuevo.
  if (entrada.tieneF29Vigente && entrada.periodo !== entrada.periodoActual)
    return armar(false, true, "periodo_con_f29_vigente");

  if (!entrada.ultimaSincronizacionRcv) return armar(true, true, "sin_datos_previos");

  const horas = horasEntre(entrada.ahora, entrada.ultimaSincronizacionRcv);
  const esMesEnCurso = entrada.periodo === entrada.periodoActual;
  const limite = esMesEnCurso ? HORAS_FRESCURA_MES_EN_CURSO : HORAS_FRESCURA_MES_SIN_F29;

  if (horas >= limite)
    return armar(true, true, esMesEnCurso ? "mes_en_curso_vencido" : "mes_sin_f29_vencido");

  return armar(false, true, "rcv_vigente");
}

/**
 * Tras un fallo de descarga del PDF no se vuelve a intentar hasta pasada la
 * espera: una descarga fallida igual consume créditos.
 */
export function puedeReintentarDescargaF29(
  ultimoFallo: string | null,
  ahora: Date,
): boolean {
  if (!ultimoFallo) return true;
  return horasEntre(ahora, ultimoFallo) >= HORAS_ESPERA_FALLO_DESCARGA_F29;
}

/**
 * Llave de idempotencia por empresa, periodo o año, módulo, recurso y tipo de
 * sincronización. Dos clics seguidos producen la misma llave y la segunda
 * ejecución no llama al proveedor.
 */
export function claveIdempotencia(partes: {
  companyId: string;
  periodoOAnio: string;
  modulo: string;
  recurso?: string;
  tipo?: string;
}): string {
  return [
    partes.companyId,
    partes.periodoOAnio,
    partes.modulo,
    partes.recurso ?? "principal",
    partes.tipo ?? "manual",
  ].join("|");
}

/** Mes en curso en Chile continental, en formato AAAA-MM. */
export function periodoEnCurso(ahora: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
  })
    .format(ahora)
    .slice(0, 7);
}
