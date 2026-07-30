/**
 * Vigencia temporal de los parámetros tributarios.
 *
 * Funciones puras. Regla única: un parámetro solo puede aplicarse a un periodo
 * cuya fecha de inicio sea posterior o igual a `effective_from`. Una tasa
 * confirmada en un mes futuro NUNCA puede usarse en un mes anterior.
 */

export interface FilaParametroVigencia {
  value: number | string;
  effective_from: string;
  effective_to?: string | null;
  confirmed?: boolean | null;
  source?: string | null;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
}

export interface ParametroVigente {
  valor: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  source: string | null;
  confirmedAt: string | null;
}

/** Primer día del periodo `YYYY-MM`. */
export function inicioDePeriodo(periodo: string): string {
  return `${periodo}-01`;
}

/**
 * Selecciona el parámetro vigente al inicio del periodo:
 *   effective_from <= period_start
 *   y (effective_to es null o effective_to >= period_start)
 * ordenado por effective_from descendente.
 */
export function seleccionarParametroVigente(
  filas: readonly FilaParametroVigencia[] | null | undefined,
  periodo: string,
  opciones: { soloConfirmados?: boolean } = {},
): ParametroVigente | null {
  const inicio = inicioDePeriodo(periodo);
  const candidatos = (filas ?? [])
    .filter((f) => (opciones.soloConfirmados === false ? true : f.confirmed !== false))
    .filter((f) => f.effective_from != null && String(f.effective_from) <= inicio)
    .filter((f) => f.effective_to == null || String(f.effective_to) >= inicio)
    .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)));

  const elegido = candidatos[0];
  if (!elegido) return null;
  const valor = Number(elegido.value);
  if (!Number.isFinite(valor)) return null;
  return {
    valor,
    effectiveFrom: String(elegido.effective_from),
    effectiveTo: elegido.effective_to == null ? null : String(elegido.effective_to),
    source: elegido.source ?? null,
    confirmedAt: elegido.confirmed_at ?? null,
  };
}

/** ¿La empresa tiene historial de vigencias para este parámetro? */
export function hayHistorialDeVigencias(
  filas: readonly FilaParametroVigencia[] | null | undefined,
): boolean {
  return (filas ?? []).length > 0;
}

export interface ConciliacionRemanente {
  /** Nuevo remanente calculado en el periodo inmediatamente anterior. */
  remanenteCalculadoPrevio: number;
  /** Remanente anterior declarado en el F29 del periodo actual. */
  remanenteDeclarado: number;
  /** declarado − calculado. Nunca se corrige automáticamente. */
  diferencia: number;
}

/**
 * Compara el remanente que dejó el periodo anterior con el remanente anterior
 * declarado en el periodo actual. Devuelve `null` si coinciden o si falta uno
 * de los dos. Ningún valor se modifica: la diferencia queda como antecedente
 * para revisión del contador.
 */
export function conciliarRemanente(
  remanenteCalculadoPrevio: number | null | undefined,
  remanenteDeclarado: number | null | undefined,
): ConciliacionRemanente | null {
  if (remanenteCalculadoPrevio == null || remanenteDeclarado == null) return null;
  const previo = Math.round(Number(remanenteCalculadoPrevio));
  const declarado = Math.round(Number(remanenteDeclarado));
  if (!Number.isFinite(previo) || !Number.isFinite(declarado)) return null;
  if (previo === declarado) return null;
  return {
    remanenteCalculadoPrevio: previo,
    remanenteDeclarado: declarado,
    diferencia: declarado - previo,
  };
}
