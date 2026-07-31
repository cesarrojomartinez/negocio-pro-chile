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

/** Marca del F29 oficial descargado del SII y leído desde el PDF compacto. */
export const ORIGEN_F29_PDF = "f29_pdf_extracted";

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
  /** Débito fiscal declarado (código 538). */
  ivaDebitoDeclarado: number | null;
  /** Total de créditos declarados (código 537). */
  ivaCreditoDeclarado: number | null;
  /** Remanente para el periodo siguiente declarado (código 77). */
  nuevoRemanenteDeclarado: number | null;
  /** Todos los códigos leídos del formulario oficial, cuando existen. */
  codigos: Record<string, number>;
  /**
   * Incoherencias detectadas en el propio formulario (por ejemplo, un PPM que
   * no cuadra con su base y su tasa). Un F29 incoherente sigue guardándose,
   * pero no se usa como parámetro de cálculo.
   */
  incoherencias: string[];
  /** El bloque de PPM del formulario es aritméticamente consistente. */
  ppmCoherente: boolean;
  /**
   * La tasa de PPM no se leyó del código 115 sino que se dedujo dividiendo el
   * PPM declarado (62) por su base (563). Ocurre cuando el formulario informa
   * la tasa en una unidad ilegible o mal extraída del PDF.
   */
  tasaPpmDerivada: boolean;
}

/**
 * Verifica que el bloque de PPM del formulario cuadre: el PPM declarado
 * (código 62) debe ser, con tolerancia, la base (563) por la tasa (115).
 * Un PDF mal leído produce combinaciones imposibles —por ejemplo tasa 10 %
 * con un PPM de cinco dígitos sobre una base de quince millones— y esa tasa
 * jamás debe alimentar la estimación de los meses siguientes.
 */
export function evaluarCoherenciaPpmF29(codigos: Record<string, number>): {
  ppmCoherente: boolean;
  motivo: string | null;
} {
  const base = codigos["563"];
  const tasa = codigos["115"];
  const ppm = codigos["62"];
  if (base == null || tasa == null || ppm == null || base <= 0 || tasa <= 0)
    return { ppmCoherente: true, motivo: null };

  if (tasa > 0.5)
    return {
      ppmCoherente: false,
      motivo: "La tasa de PPM leída del formulario no es un valor posible.",
    };

  const esperado = base * tasa;
  const tolerancia = Math.max(1000, esperado * 0.05);
  if (Math.abs(esperado - ppm) > tolerancia)
    return {
      ppmCoherente: false,
      motivo:
        "El PPM declarado no coincide con la base y la tasa del mismo formulario.",
    };

  return { ppmCoherente: true, motivo: null };
}

/** Tasa máxima de PPM que puede considerarse posible en un F29 real. */
const TASA_PPM_MAXIMA = 0.5;

/**
 * Tasa de PPM realmente aplicada en el formulario.
 *
 * Junio 2026 dejó la lección: el código 115 se leyó como `0,1` (interpretado
 * como 10 %) mientras el propio formulario declaraba una base de 15.288.385 y
 * un PPM de 15.288, es decir 0,1 %. Antes se descartaba la tasa completa y el
 * motor seguía arrastrando el 2 % del mes anterior, sobreestimando el PPM en
 * casi $290.000. Ahora, cuando la tasa leída no cuadra, la tasa se DEDUCE del
 * propio formulario (código 62 ÷ código 563), que es un hecho declarado y no
 * una interpretación de unidades.
 */
export function tasaPpmEfectivaF29(
  codigos: Record<string, number>,
  tasaLeida: number | null,
): { tasa: number | null; derivada: boolean } {
  const { ppmCoherente } = evaluarCoherenciaPpmF29(codigos);
  if (ppmCoherente && tasaLeida != null && tasaLeida > 0)
    return { tasa: tasaLeida, derivada: false };

  const base = codigos["563"];
  const ppm = codigos["62"];
  if (base == null || ppm == null || base <= 0 || ppm < 0)
    return { tasa: ppmCoherente ? tasaLeida : null, derivada: false };

  const implicita = ppm / base;
  if (!Number.isFinite(implicita) || implicita < 0 || implicita > TASA_PPM_MAXIMA)
    return { tasa: null, derivada: false };

  // Las tasas de PPM se expresan con hasta dos decimales porcentuales.
  const redondeada = Math.round(implicita * 100000) / 100000;
  return { tasa: redondeada > 0 ? redondeada : implicita, derivada: true };
}



function numero(valor: unknown): number | null {
  if (valor == null) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function codigosDe(bruto: Record<string, unknown>): Record<string, number> {
  const fuente = bruto.codigos;
  if (!fuente || typeof fuente !== "object") return {};
  const salida: Record<string, number> = {};
  for (const [clave, valor] of Object.entries(fuente as Record<string, unknown>)) {
    const n = numero(valor);
    if (n != null) salida[clave] = n;
  }
  return salida;
}

/** Interpreta la fila del F29; devuelve `null` cuando no hay antecedente útil. */
export function interpretarAntecedenteF29(
  fila: FilaF29Persistida | null | undefined,
): AntecedenteF29 | null {
  if (!fila) return null;
  const bruto = (fila.raw_data ?? {}) as Record<string, unknown>;
  const codigos = codigosDe(bruto);
  const tieneCifrasLegibles = [
    fila.declared_vat,
    fila.declared_ppm,
    fila.declared_withholdings,
    fila.declared_total,
    fila.vat_carryforward,
    bruto.new_carryforward,
  ].some((valor) => numero(valor) != null) || Object.keys(codigos).length > 0;
  const confirmado =
    fila.declaration_status === "filed" &&
    tieneCifrasLegibles &&
    (fila.source === "accountant" ||
      fila.source === "f29_pdf_extracted" ||
      bruto.origin === ORIGEN_F29_CONTADOR ||
      bruto.origin === ORIGEN_F29_PDF);

  const coherencia = evaluarCoherenciaPpmF29(codigos);
  const tasaLeida = numero(bruto.ppm_rate);
  const efectiva = tasaPpmEfectivaF29(codigos, tasaLeida);

  return {
    confirmado,
    remanenteAnterior: numero(fila.vat_carryforward),
    // Si la tasa leída no cuadra con la base y el PPM del propio formulario, se
    // deduce del formulario en vez de descartarse: dejarla en blanco hacía que
    // el motor arrastrara la tasa del mes anterior y sobreestimara el PPM.
    tasaPpm: efectiva.tasa,
    basePpmDeclarada: numero(bruto.ppm_tax_base),
    ppmDeclarado: numero(fila.declared_ppm),
    retenciones: numero(fila.declared_withholdings),
    ivaDeclarado: numero(fila.declared_vat),
    totalDeclarado: numero(fila.declared_total),
    ivaDebitoDeclarado: numero(bruto.vat_debit) ?? codigos["538"] ?? null,
    ivaCreditoDeclarado: numero(bruto.vat_credit) ?? codigos["537"] ?? null,
    nuevoRemanenteDeclarado: numero(bruto.new_carryforward) ?? codigos["77"] ?? null,
    codigos,
    incoherencias: coherencia.motivo ? [coherencia.motivo] : [],
    ppmCoherente: coherencia.ppmCoherente,
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
  /**
   * La empresa tiene parámetros de PPM con vigencia registrada. Cuando existe
   * historial, la tasa global sin fecha de la configuración NO puede aplicarse:
   * sería una tasa de otro periodo viajando hacia atrás.
   */
  hayHistorialVigencias?: boolean;
  /** Tasa guardada en la configuración de la empresa. */
  tasaConfigurada: number | null;
  /** La tasa guardada fue confirmada (no es el valor por omisión). */
  configuracionConfirmada: boolean;
  /** Tasa de un F29 confirmado de un periodo anterior, si existe. */
  tasaConfirmadaPrevia: number | null;
}

/**
 * Prioridad de la tasa de PPM por periodo:
 * 1) F29 confirmado del periodo, 2) parámetro con vigencia que cubre el
 * periodo, 3) configuración confirmada sin fecha (solo si la empresa no tiene
 * historial de vigencias), 4) F29 confirmado de un periodo ANTERIOR,
 * 5) desconocida.
 * Ninguna tasa confirmada en un periodo posterior puede aplicarse hacia atrás.
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
    !entrada.hayHistorialVigencias &&
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
