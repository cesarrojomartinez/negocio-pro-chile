/**
 * Anticipo de IVA por cambio de sujeto (por ejemplo, el anticipo de la harina
 * en panaderías).
 *
 * El SII descuenta este anticipo DESPUÉS de determinar el IVA del mes: el
 * Registro de Compras y Ventas no lo informa, así que un motor que solo mira
 * el RCV sobreestima el impuesto exactamente en el monto imputado. Estos
 * anticipos aparecen únicamente en el Formulario 29:
 *
 *   556  anticipo del mes (retenido por el comprador)
 *   557  remanente de anticipo del mes anterior
 *   543  total de anticipo disponible (556 + 557)
 *   598  anticipo imputado al IVA del mes
 *   573  remanente de anticipo para el mes siguiente (543 − 598)
 *
 * Módulo puro: sin red, sin reloj, sin base de datos.
 */

export const CODIGOS_ANTICIPO_IVA = {
  delMes: "556",
  remanenteAnterior: "557",
  disponible: "543",
  imputado: "598",
  remanenteSiguiente: "573",
} as const;

export interface AnticipoIvaF29 {
  /** Anticipo retenido durante el mes (código 556). */
  delMes: number;
  /** Remanente de anticipo que venía del mes anterior (código 557). */
  remanenteAnterior: number;
  /** Total disponible para imputar (código 543). */
  disponible: number;
  /** Anticipo efectivamente imputado al IVA del mes (código 598). */
  imputado: number;
  /** Remanente de anticipo que queda para el mes siguiente (código 573). */
  remanenteSiguiente: number;
}

const numero = (valor: unknown): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

/**
 * Lee el bloque de anticipo de un F29 ya extraído. Devuelve `null` cuando el
 * formulario no tiene ningún código de anticipo con monto: la empresa no está
 * afecta a cambio de sujeto y no corresponde estimar nada.
 */
export function leerAnticipoF29(
  codigos: Record<string, number> | null | undefined,
): AnticipoIvaF29 | null {
  if (!codigos) return null;
  const delMes = numero(codigos[CODIGOS_ANTICIPO_IVA.delMes]);
  const remanenteAnterior = numero(codigos[CODIGOS_ANTICIPO_IVA.remanenteAnterior]);
  const disponibleLeido = numero(codigos[CODIGOS_ANTICIPO_IVA.disponible]);
  const imputado = numero(codigos[CODIGOS_ANTICIPO_IVA.imputado]);
  const remanenteSiguienteLeido = numero(codigos[CODIGOS_ANTICIPO_IVA.remanenteSiguiente]);

  const disponible = disponibleLeido > 0 ? disponibleLeido : delMes + remanenteAnterior;
  if (disponible === 0 && imputado === 0 && remanenteSiguienteLeido === 0) return null;

  const remanenteSiguiente =
    remanenteSiguienteLeido > 0
      ? remanenteSiguienteLeido
      : Math.max(0, disponible - imputado);

  return {
    delMes,
    remanenteAnterior,
    disponible,
    imputado,
    remanenteSiguiente,
  };
}

export interface MuestraAnticipo {
  /** Periodo del F29 leído, en formato AAAA-MM. */
  periodo: string;
  anticipo: AnticipoIvaF29;
}

export type FuenteAnticipo = "sin_datos" | "f29_historial";

export interface AnticipoEstimado {
  /** Remanente de anticipo que dejó el último F29 anterior (código 573). */
  remanenteAnterior: number;
  /** Anticipo del mes estimado con el historial (mediana de los códigos 556). */
  anticipoMesEstimado: number;
  /** Total que se puede imputar al IVA de este periodo. */
  disponible: number;
  /** Cantidad de F29 usados para estimar el anticipo del mes. */
  mesesConsiderados: number;
  fuente: FuenteAnticipo;
}

export const ANTICIPO_SIN_DATOS: AnticipoEstimado = {
  remanenteAnterior: 0,
  anticipoMesEstimado: 0,
  disponible: 0,
  mesesConsiderados: 0,
  fuente: "sin_datos",
};

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1
    ? ordenados[medio]
    : Math.round((ordenados[medio - 1] + ordenados[medio]) / 2);
}

/**
 * Estima cuánto anticipo de IVA hay disponible para un periodo que todavía no
 * tiene F29.
 *
 * - El remanente proviene del código 573 del F29 más reciente anterior: es un
 *   dato oficial, no una suposición.
 * - El anticipo del mes se estima con la mediana de los códigos 556 recientes
 *   (la mediana evita que un mes atípico distorsione la estimación).
 *
 * Si la empresa no tiene historial de anticipo, devuelve cero y `sin_datos`:
 * nunca se inventa un crédito.
 */
export function estimarAnticipoIva(
  muestras: MuestraAnticipo[],
  periodoObjetivo: string,
  opciones: { mesesPromedio?: number } = {},
): AnticipoEstimado {
  const mesesPromedio = opciones.mesesPromedio ?? 6;
  const previas = muestras
    .filter((m) => m.periodo < periodoObjetivo)
    .sort((a, b) => (a.periodo < b.periodo ? 1 : -1));
  if (previas.length === 0) return ANTICIPO_SIN_DATOS;

  const remanenteAnterior = Math.max(0, previas[0].anticipo.remanenteSiguiente);
  const anticipoMesEstimado = mediana(
    previas
      .slice(0, mesesPromedio)
      .map((m) => Math.max(0, m.anticipo.delMes))
      .filter((v) => v > 0),
  );

  const disponible = remanenteAnterior + anticipoMesEstimado;
  if (disponible === 0) return { ...ANTICIPO_SIN_DATOS, mesesConsiderados: previas.length };

  return {
    remanenteAnterior,
    anticipoMesEstimado,
    disponible,
    mesesConsiderados: Math.min(previas.length, mesesPromedio),
    fuente: "f29_historial",
  };
}

export interface AplicacionAnticipo {
  /** Anticipo disponible antes de imputar. */
  disponible: number;
  /** Anticipo imputado al IVA por pagar del periodo. */
  aplicado: number;
  /** IVA por pagar después de imputar el anticipo. */
  ivaPorPagar: number;
  /** Anticipo que quedaría para el periodo siguiente. */
  remanenteSiguiente: number;
}

/**
 * Imputa el anticipo disponible al IVA por pagar del periodo. El anticipo
 * nunca genera devolución: solo puede rebajar el IVA hasta cero y lo que sobra
 * queda como remanente para el mes siguiente.
 */
export function aplicarAnticipoIva(
  ivaPorPagar: number,
  disponible: number,
): AplicacionAnticipo {
  const iva = Math.max(0, Math.round(Number.isFinite(ivaPorPagar) ? ivaPorPagar : 0));
  const total = Math.max(0, Math.round(Number.isFinite(disponible) ? disponible : 0));
  const aplicado = Math.min(iva, total);
  return {
    disponible: total,
    aplicado,
    ivaPorPagar: iva - aplicado,
    remanenteSiguiente: total - aplicado,
  };
}
