/**
 * Conciliación interna entre la estimación del motor y el Formulario 29 oficial.
 *
 * Módulo puro. Cuando el periodo tiene un F29 oficial (leído del PDF compacto o
 * confirmado por el contador), sus cifras mandan: la pantalla debe mostrar el
 * mismo monto que el formulario presentado. La comparación se guarda para poder
 * explicar cada diferencia, pero el valor visible siempre queda corregido.
 */
import type { ResumenMensual } from "@/types/tax";

export interface CifrasOficialesF29 {
  ivaDebito: number | null;
  ivaCredito: number | null;
  remanenteAnterior: number | null;
  ivaDeterminado: number | null;
  nuevoRemanente: number | null;
  ppm: number | null;
  retenciones: number | null;
  totalAPagar: number | null;
}

export interface DiferenciaF29 {
  /** Identificador estable del concepto. */
  id: string;
  concepto: string;
  /** Valor que había calculado el motor con el RCV. */
  estimado: number;
  /** Valor declarado en el Formulario 29 oficial. */
  oficial: number;
  diferencia: number;
}

export interface ConciliacionF29 {
  /** Hay un Formulario 29 oficial con cifras utilizables. */
  hayOficial: boolean;
  /** Se corrigió al menos un monto de la pantalla. */
  ajustado: boolean;
  /** Conceptos en que la estimación difería del formulario. */
  diferencias: DiferenciaF29[];
  /** Conceptos tomados directamente del formulario oficial. */
  conceptosOficiales: string[];
}

function limpio(valor: number | null | undefined): number | null {
  if (valor == null) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Tolerancia en pesos: bajo este monto la diferencia es solo redondeo. */
const TOLERANCIA = 1;

const CONCEPTOS: {
  id: keyof CifrasOficialesF29;
  concepto: string;
  campo: keyof ResumenMensual;
}[] = [
  { id: "ivaDebito", concepto: "IVA débito por ventas", campo: "ivaDebito" },
  { id: "ivaCredito", concepto: "IVA crédito por compras", campo: "ivaCredito" },
  { id: "remanenteAnterior", concepto: "Remanente anterior", campo: "remanenteAnterior" },
  { id: "ivaDeterminado", concepto: "IVA por pagar", campo: "ivaEstimado" },
  { id: "nuevoRemanente", concepto: "Nuevo remanente", campo: "nuevoRemanente" },
  { id: "ppm", concepto: "PPM", campo: "ppmEstimado" },
  { id: "retenciones", concepto: "Retenciones", campo: "retencionesEstimadas" },
];

/**
 * Ajusta el resumen visible a las cifras del Formulario 29 oficial y devuelve
 * el detalle de lo que cambió. Nunca inventa valores: si el formulario no trae
 * un concepto, se conserva la estimación del motor.
 */
export function conciliarConF29Oficial(
  resumen: ResumenMensual,
  oficiales: CifrasOficialesF29,
  opciones: { margenPorcentaje: number },
): { resumen: ResumenMensual; conciliacion: ConciliacionF29 } {
  const diferencias: DiferenciaF29[] = [];
  const conceptosOficiales: string[] = [];
  const ajustado: ResumenMensual = { ...resumen };

  for (const item of CONCEPTOS) {
    const oficial = limpio(oficiales[item.id]);
    if (oficial == null) continue;
    const estimado = Math.round(Number(resumen[item.campo] ?? 0));
    conceptosOficiales.push(item.concepto);
    if (Math.abs(oficial - estimado) > TOLERANCIA) {
      diferencias.push({
        id: String(item.id),
        concepto: item.concepto,
        estimado,
        oficial,
        diferencia: oficial - estimado,
      });
    }
    (ajustado as unknown as Record<string, number>)[item.campo] = oficial;
  }

  const hayOficial = conceptosOficiales.length > 0;
  if (!hayOficial) {
    return {
      resumen,
      conciliacion: {
        hayOficial: false,
        ajustado: false,
        diferencias: [],
        conceptosOficiales: [],
      },
    };
  }

  // El total del formulario manda; si no viene, se recompone con sus partes.
  const totalOficial = limpio(oficiales.totalAPagar);
  const totalCompuesto =
    ajustado.ivaEstimado + ajustado.ppmEstimado + ajustado.retencionesEstimadas;
  const totalFinal = totalOficial ?? Math.round(totalCompuesto);
  if (totalOficial != null) conceptosOficiales.push("Total a pagar");
  if (Math.abs(totalFinal - Math.round(resumen.totalTributarioEstimado)) > TOLERANCIA) {
    diferencias.push({
      id: "total",
      concepto: "Total tributario",
      estimado: Math.round(resumen.totalTributarioEstimado),
      oficial: totalFinal,
      diferencia: totalFinal - Math.round(resumen.totalTributarioEstimado),
    });
  }

  ajustado.totalTributarioEstimado = totalFinal;
  const margen = Math.round((totalFinal * opciones.margenPorcentaje) / 100);
  ajustado.margenPorcentaje = opciones.margenPorcentaje;
  ajustado.margenPreventivo = margen;
  ajustado.reservaRecomendada = totalFinal + margen;
  // Con cifras oficiales el escenario con compras pendientes deja de aplicar.
  ajustado.ivaEstimadoConPendientes = ajustado.ivaEstimado;
  ajustado.ppmPendiente = false;

  return {
    resumen: ajustado,
    conciliacion: {
      hayOficial: true,
      ajustado: diferencias.length > 0,
      diferencias,
      conceptosOficiales,
    },
  };
}
