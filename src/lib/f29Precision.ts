/**
 * Precisión de la estimación frente al Formulario 29 oficial.
 *
 * Módulo puro. Mide cuánto se desvió el total estimado por el motor respecto
 * del total realmente declarado en el F29, para poder informar al usuario con
 * datos propios en vez de supuestos. No corrige ni recalcula nada.
 */

export interface DesviacionF29 {
  /** Total tributario estimado por el motor antes de conocer el F29. */
  estimado: number;
  /** Total declarado en el Formulario 29 oficial. */
  oficial: number;
  /** estimado - oficial. Positivo: la app estimó de más. */
  diferencia: number;
  /** Diferencia porcentual respecto del total oficial. Null si el oficial es 0. */
  porcentaje: number | null;
}

export type OrigenMedicion = "medida" | "reconstruida";

export interface FilaPrecision extends DesviacionF29 {
  periodo: string;
  /**
   * "medida": la estimación se guardó antes de aplicar el F29.
   * "reconstruida": se recompuso sumando los componentes guardados, por lo que
   * es solo una aproximación de lo que el motor había estimado.
   */
  origen: OrigenMedicion;
}

export interface ResumenPrecision {
  filas: FilaPrecision[];
  /** Cantidad de periodos con desviación calculable. */
  muestras: number;
  /** Periodos con medición exacta (no reconstruida). */
  muestrasMedidas: number;
  /** Promedio de la desviación absoluta en porcentaje. Null si no hay datos. */
  promedioAbsoluto: number | null;
  /** Promedio con signo: negativo significa que la app suele estimar de menos. */
  promedioConSigno: number | null;
  peor: number | null;
  mejor: number | null;
  /** Verdadero cuando hay al menos 3 periodos para dar una lectura útil. */
  suficiente: boolean;
}

const MINIMO_MUESTRAS = 3;

function redondear(valor: number): number {
  return Math.round(Number.isFinite(valor) ? valor : 0);
}

function redondearPct(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/** Calcula la desviación entre la estimación previa y el total del F29. */
export function calcularDesviacionF29(
  estimado: number | null | undefined,
  oficial: number | null | undefined,
): DesviacionF29 | null {
  if (estimado == null || oficial == null) return null;
  const est = redondear(Number(estimado));
  const ofi = redondear(Number(oficial));
  if (!Number.isFinite(est) || !Number.isFinite(ofi)) return null;
  const diferencia = est - ofi;
  return {
    estimado: est,
    oficial: ofi,
    diferencia,
    porcentaje: ofi === 0 ? null : redondearPct((diferencia / ofi) * 100),
  };
}

/**
 * Resume el historial de desviaciones. Solo entran los periodos con porcentaje
 * calculable: un F29 en cero no aporta información de precisión relativa.
 */
export function resumirPrecision(filas: FilaPrecision[]): ResumenPrecision {
  const ordenadas = [...filas].sort((a, b) => (a.periodo < b.periodo ? 1 : -1));
  const conPct = ordenadas.filter((f) => f.porcentaje != null);
  const pcts = conPct.map((f) => f.porcentaje as number);

  if (pcts.length === 0) {
    return {
      filas: ordenadas,
      muestras: 0,
      muestrasMedidas: ordenadas.filter((f) => f.origen === "medida").length,
      promedioAbsoluto: null,
      promedioConSigno: null,
      peor: null,
      mejor: null,
      suficiente: false,
    };
  }

  const absolutos = pcts.map(Math.abs);
  const promedio = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  return {
    filas: ordenadas,
    muestras: pcts.length,
    muestrasMedidas: conPct.filter((f) => f.origen === "medida").length,
    promedioAbsoluto: redondearPct(promedio(absolutos)),
    promedioConSigno: redondearPct(promedio(pcts)),
    peor: redondearPct(Math.max(...absolutos)),
    mejor: redondearPct(Math.min(...absolutos)),
    suficiente: pcts.length >= MINIMO_MUESTRAS,
  };
}
