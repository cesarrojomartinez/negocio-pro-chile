/**
 * Antecedentes del Formulario 29 confirmados por el contador.
 *
 * Funciones puras: interpretan una fila de `tax_f29_history` y entregan los
 * parámetros tributarios del periodo (remanente anterior, tasa de PPM y
 * retenciones). Ningún valor queda escrito en los componentes visuales: todo
 * proviene de este antecedente persistido.
 */
import type { CarryforwardSource, PpmSource, WithholdingsSource } from "@/types/engine";
import type { FuentePeriodo } from "@/types/tax";

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
export function descripcionOrigenEstimacion(fuente: FuentePeriodo): string {
  switch (fuente) {
    case "mock":
      return "Estimación al día de hoy, calculada con tus datos demostrativos.";
    case "rcv_real_plus_accountant":
      return "Estimación calculada con información del Registro de Compras y Ventas obtenida mediante API Gateway / SII y antecedentes del F29 confirmados por el contador.";
    case "accountant_confirmed":
      return "Estimación calculada con antecedentes del F29 confirmados por el contador.";
    case "rcv_real":
      return "Estimación calculada con información del Registro de Compras y Ventas obtenida mediante API Gateway / SII.";
    default:
      return MENSAJE_PERIODO_SIN_SINCRONIZAR;
  }
}

/** Texto único para un periodo sin información importada. */
export const MENSAJE_PERIODO_SIN_SINCRONIZAR =
  "Este periodo todavía no fue sincronizado con el SII ni confirmado por tu contador.";

export interface EntradaTasaPpm {
  /** Empresa demostrativa o modo demostración. */
  esDemo: boolean;
  /** Antecedente del F29 del propio periodo. */
  antecedentePeriodo: AntecedenteF29 | null;
  /** Parámetro tributario vigente de la empresa para el periodo. */
  tasaParametroVigente?: number | null;
  /** Tasa guardada en la configuración de la empresa. */
  tasaConfigurada: number | null;
  /** La tasa guardada fue confirmada (no es el valor por omisión). */
  configuracionConfirmada: boolean;
  /** Tasa de un F29 confirmado de un periodo anterior, si existe. */
  tasaConfirmadaPrevia: number | null;
}

/**
 * Prioridad de la tasa de PPM por periodo:
 * 1) F29 confirmado del periodo, 2) parámetro tributario vigente de la empresa,
 * 3) configuración confirmada, 4) F29 confirmado anterior, 5) desconocida.
 * En una empresa real nunca se usa la tasa demostrativa por omisión.
 */
export function resolverTasaPpm(entrada: EntradaTasaPpm): {
  tasaPpm: number | null;
  fuentePpm: PpmSource;
} {
  const propio = entrada.antecedentePeriodo;
  if (propio?.confirmado && propio.tasaPpm != null && propio.tasaPpm > 0)
    return { tasaPpm: propio.tasaPpm, fuentePpm: ORIGEN_F29_CONTADOR };

  if (entrada.esDemo)
    return entrada.tasaConfigurada && entrada.tasaConfigurada > 0
      ? { tasaPpm: entrada.tasaConfigurada, fuentePpm: "mock" }
      : { tasaPpm: null, fuentePpm: "unknown" };

  if (entrada.tasaParametroVigente != null && entrada.tasaParametroVigente > 0)
    return { tasaPpm: entrada.tasaParametroVigente, fuentePpm: "configured" };

  if (
    entrada.configuracionConfirmada &&
    entrada.tasaConfigurada != null &&
    entrada.tasaConfigurada > 0
  )
    return { tasaPpm: entrada.tasaConfigurada, fuentePpm: "configured" };

  if (entrada.tasaConfirmadaPrevia != null && entrada.tasaConfirmadaPrevia > 0)
    return { tasaPpm: entrada.tasaConfirmadaPrevia, fuentePpm: "previous_f29" };

  return { tasaPpm: null, fuentePpm: "unknown" };
}

export interface EntradaRemanente {
  esDemo: boolean;
  /** F29 confirmado del propio periodo: declara el remanente anterior. */
  antecedentePeriodo: AntecedenteF29 | null;
  /** Nuevo remanente calculado en el periodo anterior, si existe resumen. */
  remanenteCalculadoPrevio: number | null;
  /** El periodo anterior tiene antecedentes confirmados. */
  periodoAnteriorConfirmado: boolean;
}

/**
 * Prioridad del remanente anterior:
 * 1) F29 confirmado del periodo, 2) resumen del periodo anterior,
 * 3) datos demostrativos, 4) desconocido.
 * Un remanente desconocido nunca se presenta como cero confirmado: se calcula
 * con cero y el periodo queda marcado como incompleto.
 */
export function resolverRemanenteAnterior(entrada: EntradaRemanente): {
  remanenteAnterior: number;
  fuenteRemanente: CarryforwardSource;
  conocido: boolean;
} {
  const propio = entrada.antecedentePeriodo;
  if (propio?.confirmado && propio.remanenteAnterior != null)
    return {
      remanenteAnterior: Math.max(0, propio.remanenteAnterior),
      fuenteRemanente: ORIGEN_F29_CONTADOR,
      conocido: true,
    };

  if (entrada.remanenteCalculadoPrevio != null)
    return {
      remanenteAnterior: Math.max(0, entrada.remanenteCalculadoPrevio),
      fuenteRemanente: entrada.esDemo ? "mock" : "previous_period",
      conocido: entrada.esDemo || entrada.periodoAnteriorConfirmado,
    };

  return { remanenteAnterior: 0, fuenteRemanente: "unknown", conocido: false };
}

/** Etiqueta breve del origen del periodo, para el encabezado. */
export function etiquetaFuentePeriodo(fuente: FuentePeriodo): string {
  switch (fuente) {
    case "mock":
      return "Datos demostrativos";
    case "rcv_real":
      return "Periodo con datos reales del RCV";
    case "accountant_confirmed":
      return "Periodo con F29 confirmado";
    case "rcv_real_plus_accountant":
      return "RCV real + F29 confirmado";
    default:
      return "Periodo sin sincronizar";
  }
}
