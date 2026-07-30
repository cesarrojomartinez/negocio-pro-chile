/**
 * Política de actualización y caché de la sincronización con el SII.
 *
 * Funciones puras: reciben el instante actual y el estado guardado, y
 * devuelven la decisión. Así pueden probarse sin base de datos ni reloj real.
 *
 * Reglas (todas en horario de Chile continental, America/Santiago):
 * - Regla al ingresar: el periodo en curso se consulta una vez por día
 *   calendario. El primer ingreso del día consulta; el resto usa caché.
 * - Regla semanal: los periodos ya cerrados se consultan una vez por semana
 *   calendario, que comienza el lunes.
 * - Regla manual: el usuario puede forzar, con un mínimo de 10 minutos entre
 *   consultas para no gastar llamadas del proveedor.
 * - Frecuencia por módulo: el historial de F29 se consulta como máximo una vez
 *   por semana, aunque el resto de los módulos se refresque a diario.
 */
export type TipoActivacion =
  | "manual"
  | "login_refresh"
  | "weekly_refresh"
  | "scheduled"
  | "demo_connect"
  | "retry";

export type MotivoSincronizacion =
  | "sin_datos_previos"
  | "conexion_nueva"
  | "vencio_ventana_diaria"
  | "vencio_ventana_semanal"
  | "solicitud_manual"
  | "reintento"
  | "cache_vigente"
  | "espera_minima_manual";

export const ZONA_HORARIA = "America/Santiago";
export const MINUTOS_MINIMOS_MANUAL = 10;

const FORMATO_DIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const FORMATO_DIA_SEMANA = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_HORARIA,
  weekday: "short",
});

const DIAS_SEMANA: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/** Día calendario chileno en formato AAAA-MM-DD. */
export function diaCivil(fecha: Date): string {
  return FORMATO_DIA.format(fecha);
}

/** Lunes de la semana chilena a la que pertenece la fecha (AAAA-MM-DD). */
export function lunesDeLaSemana(fecha: Date): string {
  const desplazamiento = DIAS_SEMANA[FORMATO_DIA_SEMANA.format(fecha)] ?? 0;
  const dia = diaCivil(fecha);
  const [a, m, d] = dia.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1, d - desplazamiento));
  return base.toISOString().slice(0, 10);
}

/** Medianoche chilena del día siguiente, expresada en UTC. */
function inicioDelDiaSiguiente(fecha: Date): string {
  const [a, m, d] = diaCivil(fecha).split("-").map(Number);
  // Chile continental está entre UTC-4 y UTC-3: 04:00 UTC cubre ambos casos.
  return new Date(Date.UTC(a, m - 1, d + 1, 4, 0, 0)).toISOString();
}

/** Lunes siguiente a las 00:00 de Chile, expresado en UTC. */
function inicioDeLaProximaSemana(fecha: Date): string {
  const [a, m, d] = lunesDeLaSemana(fecha).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 7, 4, 0, 0)).toISOString();
}

export interface EntradaPolitica {
  ahora: Date;
  ultimaSincronizacionExitosa: string | null;
  tipo: TipoActivacion;
  /** Verdadero cuando el periodo consultado ya terminó. */
  periodoCerrado: boolean;
}

export interface DecisionSincronizacion {
  debeConsultar: boolean;
  motivo: MotivoSincronizacion;
  /** Momento estimado de la próxima actualización automática. */
  proximaActualizacion: string | null;
  minutosDesdeUltima: number | null;
}

export const MENSAJE_MOTIVO: Record<MotivoSincronizacion, string> = {
  sin_datos_previos: "Es la primera consulta de este periodo.",
  conexion_nueva: "Acabas de activar la conexión demostrativa.",
  vencio_ventana_diaria: "Es tu primer ingreso del día.",
  vencio_ventana_semanal: "Este periodo ya cerró y se actualiza una vez por semana.",
  solicitud_manual: "Lo pediste manualmente.",
  reintento: "Reintento automático tras un problema del proveedor.",
  cache_vigente: "Ya tienes información reciente, no fue necesario volver a consultar.",
  espera_minima_manual:
    "Actualizaste hace muy poco. Espera unos minutos antes de volver a intentar.",
};

function minutosEntre(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 60000);
}

export function decidirSincronizacion(
  entrada: EntradaPolitica,
): DecisionSincronizacion {
  const { ahora, tipo, periodoCerrado } = entrada;
  const proximaVentana = periodoCerrado
    ? inicioDeLaProximaSemana(ahora)
    : inicioDelDiaSiguiente(ahora);

  if (!entrada.ultimaSincronizacionExitosa) {
    return {
      debeConsultar: true,
      motivo: tipo === "demo_connect" ? "conexion_nueva" : "sin_datos_previos",
      proximaActualizacion: proximaVentana,
      minutosDesdeUltima: null,
    };
  }

  const ultima = new Date(entrada.ultimaSincronizacionExitosa);
  const minutos = minutosEntre(ahora, ultima);
  const proxima = periodoCerrado
    ? inicioDeLaProximaSemana(ultima)
    : inicioDelDiaSiguiente(ultima);

  if (tipo === "demo_connect" || tipo === "retry") {
    return {
      debeConsultar: true,
      motivo: tipo === "retry" ? "reintento" : "conexion_nueva",
      proximaActualizacion: proxima,
      minutosDesdeUltima: minutos,
    };
  }

  if (tipo === "manual") {
    if (minutos < MINUTOS_MINIMOS_MANUAL)
      return {
        debeConsultar: false,
        motivo: "espera_minima_manual",
        proximaActualizacion: new Date(
          ultima.getTime() + MINUTOS_MINIMOS_MANUAL * 60000,
        ).toISOString(),
        minutosDesdeUltima: minutos,
      };
    return {
      debeConsultar: true,
      motivo: "solicitud_manual",
      proximaActualizacion: proxima,
      minutosDesdeUltima: minutos,
    };
  }

  const venció = periodoCerrado
    ? lunesDeLaSemana(ultima) !== lunesDeLaSemana(ahora)
    : diaCivil(ultima) !== diaCivil(ahora);

  if (venció)
    return {
      debeConsultar: true,
      motivo: periodoCerrado ? "vencio_ventana_semanal" : "vencio_ventana_diaria",
      proximaActualizacion: proximaVentana,
      minutosDesdeUltima: minutos,
    };

  return {
    debeConsultar: false,
    motivo: "cache_vigente",
    proximaActualizacion: proxima,
    minutosDesdeUltima: minutos,
  };
}

/**
 * Decide qué módulos vale la pena volver a consultar.
 * El historial de F29 cambia una vez al mes: se refresca como máximo una vez
 * por semana calendario, aunque los demás módulos se consulten a diario.
 */
export function modulosAConsultar<M extends string>(entrada: {
  modulos: readonly M[];
  ahora: Date;
  ultimaConsultaF29: string | null;
  /** Los módulos se fuerzan cuando el usuario pide una actualización manual. */
  forzarTodo?: boolean;
}): { consultar: M[]; desdeCache: M[] } {
  const consultar: M[] = [];
  const desdeCache: M[] = [];
  for (const modulo of entrada.modulos) {
    const esF29 = modulo === ("f29_periods" as M) || modulo === ("f29_detail" as M);
    const vigente =
      esF29 &&
      !entrada.forzarTodo &&
      entrada.ultimaConsultaF29 != null &&
      lunesDeLaSemana(new Date(entrada.ultimaConsultaF29)) ===
        lunesDeLaSemana(entrada.ahora);
    if (vigente) desdeCache.push(modulo);
    else consultar.push(modulo);
  }
  return { consultar, desdeCache };
}

/** Espera exponencial acotada para reintentos del proveedor. */
export function proximoReintento(ahora: Date, intento: number): string {
  const minutos = Math.min(60, 2 ** Math.max(0, intento));
  return new Date(ahora.getTime() + minutos * 60000).toISOString();
}
