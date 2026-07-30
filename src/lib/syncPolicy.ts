/**
 * Política de actualización y caché de la sincronización con el SII.
 *
 * Función pura: recibe el instante actual y el estado guardado, y devuelve la
 * decisión. Así puede probarse sin base de datos ni reloj real.
 *
 * Reglas:
 * - Regla semanal: los periodos ya cerrados se refrescan como máximo una vez
 *   cada 7 días.
 * - Regla al ingresar: el periodo en curso se refresca automáticamente como
 *   máximo una vez al día.
 * - Regla manual: el usuario puede forzar, pero con un mínimo de 10 minutos
 *   entre consultas para no gastar llamadas del proveedor.
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

export const MINUTOS_MINIMOS_MANUAL = 10;
export const HORAS_VENTANA_DIARIA = 24;
export const DIAS_VENTANA_SEMANAL = 7;

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
  vencio_ventana_diaria: "Habían pasado más de 24 horas desde la última actualización.",
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
  const ventanaMinutos = periodoCerrado
    ? DIAS_VENTANA_SEMANAL * 24 * 60
    : HORAS_VENTANA_DIARIA * 60;

  if (!entrada.ultimaSincronizacionExitosa) {
    return {
      debeConsultar: true,
      motivo: tipo === "demo_connect" ? "conexion_nueva" : "sin_datos_previos",
      proximaActualizacion: new Date(
        ahora.getTime() + ventanaMinutos * 60000,
      ).toISOString(),
      minutosDesdeUltima: null,
    };
  }

  const ultima = new Date(entrada.ultimaSincronizacionExitosa);
  const minutos = minutosEntre(ahora, ultima);
  const proxima = new Date(ultima.getTime() + ventanaMinutos * 60000).toISOString();

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

  if (minutos >= ventanaMinutos)
    return {
      debeConsultar: true,
      motivo: periodoCerrado ? "vencio_ventana_semanal" : "vencio_ventana_diaria",
      proximaActualizacion: new Date(
        ahora.getTime() + ventanaMinutos * 60000,
      ).toISOString(),
      minutosDesdeUltima: minutos,
    };

  return {
    debeConsultar: false,
    motivo: "cache_vigente",
    proximaActualizacion: proxima,
    minutosDesdeUltima: minutos,
  };
}

/** Espera exponencial acotada para reintentos del proveedor. */
export function proximoReintento(ahora: Date, intento: number): string {
  const minutos = Math.min(60, 2 ** Math.max(0, intento));
  return new Date(ahora.getTime() + minutos * 60000).toISOString();
}
