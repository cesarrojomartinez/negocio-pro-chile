/**
 * Antecedentes del Formulario 29 confirmados por el contador.
 *
 * Funciones puras: interpretan una fila de `tax_f29_history` y entregan los
 * parámetros tributarios del periodo (remanente anterior, tasa de PPM y
 * retenciones). Ningún valor queda escrito en los componentes visuales: todo
 * proviene de este antecedente persistido.
 */
import type { CarryforwardSource, PpmSource, WithholdingsSource } from "@/types/engine";

/** Marca usada en `tax_f29_history.raw_data` para el F29 confirmado. */
export const ORIGEN_F29_CONTADOR = "accountant_confirmed_f29";

export interface FilaF29Persistida {
  declaration_status: string | null;
  declared_vat: number | null;
  declared_ppm: number | null;
  declared_withholdings: number | null;
  declared_total: number | null;
  vat_carryforward: number | null;
  source: string | null;
  raw_data: unknown;
}

export interface AntecedenteF29 {
  /** El contador confirmó el formulario y sus cifras pueden usarse como base. */
  confirmado: boolean;
  /** Remanente del periodo ANTERIOR declarado en este F29. */
  remanenteAnterior: number | null;
  tasaPpm: number | null;
  basePpmDeclarada: number | null;
  ppmDeclarado: number | null;
  retenciones: number | null;
  ivaDeclarado: number | null;
  totalDeclarado: number | null;
}

function numero(valor: unknown): number | null {
  if (valor == null) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** Interpreta la fila del F29; devuelve `null` cuando no hay antecedente útil. */
export function interpretarAntecedenteF29(
  fila: FilaF29Persistida | null | undefined,
): AntecedenteF29 | null {
  if (!fila) return null;
  const bruto = (fila.raw_data ?? {}) as Record<string, unknown>;
  const confirmado =
    fila.declaration_status === "filed" &&
    (fila.source === "accountant" || bruto.origin === ORIGEN_F29_CONTADOR);

  return {
    confirmado,
    remanenteAnterior: numero(fila.vat_carryforward),
    tasaPpm: numero(bruto.ppm_rate),
    basePpmDeclarada: numero(bruto.ppm_tax_base),
    ppmDeclarado: numero(fila.declared_ppm),
    retenciones: numero(fila.declared_withholdings),
    ivaDeclarado: numero(fila.declared_vat),
    totalDeclarado: numero(fila.declared_total),
  };
}

export interface ParametrosTributarios {
  remanenteAnterior: number;
  fuenteRemanente: CarryforwardSource;
  tasaPpm: number | null;
  fuentePpm: PpmSource;
  retenciones: number;
  fuenteRetenciones: WithholdingsSource;
}

/**
 * Combina los antecedentes confirmados con los valores por omisión del
 * periodo. El F29 confirmado por el contador siempre tiene prioridad.
 */
export function aplicarAntecedenteF29(
  base: ParametrosTributarios,
  antecedente: AntecedenteF29 | null,
): ParametrosTributarios {
  if (!antecedente?.confirmado) return base;
  const resultado: ParametrosTributarios = { ...base };

  if (antecedente.remanenteAnterior != null) {
    resultado.remanenteAnterior = Math.max(0, antecedente.remanenteAnterior);
    resultado.fuenteRemanente = ORIGEN_F29_CONTADOR;
  }
  if (antecedente.tasaPpm != null && antecedente.tasaPpm > 0) {
    resultado.tasaPpm = antecedente.tasaPpm;
    resultado.fuentePpm = ORIGEN_F29_CONTADOR;
  }
  if (antecedente.retenciones != null) {
    resultado.retenciones = Math.max(0, antecedente.retenciones);
    resultado.fuenteRetenciones = ORIGEN_F29_CONTADOR;
  }
  return resultado;
}

/** Texto para la interfaz sobre el remanente utilizado. */
export function textoRemanente(
  monto: number,
  fuente: CarryforwardSource,
  formatear: (n: number) => string,
): string {
  if (fuente === ORIGEN_F29_CONTADOR)
    return `Remanente anterior: ${formatear(monto)}, confirmado según el F29 del periodo.`;
  if (fuente === "f29") return "Remanente informado en el F29 del periodo anterior.";
  if (fuente === "previous_period")
    return "Remanente estimado a partir del periodo anterior.";
  if (fuente === "mock") return "Remanente de los datos demostrativos.";
  return "No registramos remanente confirmado del periodo anterior.";
}

/** Descripción del origen de la estimación mostrada en pantalla. */
export function descripcionOrigenEstimacion(entrada: {
  esDemo: boolean;
  fuentePpm: PpmSource;
  fuenteRemanente: CarryforwardSource;
}): string {
  if (entrada.esDemo)
    return "Estimación al día de hoy, calculada con tus datos demostrativos.";
  const conF29 =
    entrada.fuentePpm === ORIGEN_F29_CONTADOR ||
    entrada.fuenteRemanente === ORIGEN_F29_CONTADOR;
  if (conF29)
    return "Estimación calculada con información del Registro de Compras y Ventas obtenida mediante API Gateway / SII y antecedentes del F29 confirmados por el contador.";
  return "Estimación calculada con información del Registro de Compras y Ventas obtenida mediante API Gateway / SII.";
}
