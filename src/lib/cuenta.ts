/**
 * Estados de cuenta, planes y límites comerciales.
 * Módulo puro: no consulta la base de datos ni el proveedor.
 * No participa en ningún cálculo tributario.
 */

export type EstadoCuenta =
  | "trial"
  | "active"
  | "payment_pending"
  | "suspended"
  | "cancelled";

export interface Plan {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  maxEmpresas: number;
  maxUsuarios: number;
  actualizacionesIncluidas: number;
  periodosHistoricosIniciales: number;
  accesoContador: boolean;
  soporte: string;
  presupuestoGateway: number;
  precioClp: number | null;
  orden: number;
}

export interface Suscripcion {
  id: string;
  companyId: string;
  plan: Plan;
  estado: EstadoCuenta;
  inicio: string;
  finPrueba: string | null;
  proximaRenovacion: string | null;
  metodoPago: string | null;
  canceladaEl: string | null;
  suspendidaEl: string | null;
  motivoSuspension: string | null;
  mesUso: string | null;
  actualizacionesUsadas: number;
}

export const ETIQUETA_ESTADO: Record<EstadoCuenta, string> = {
  trial: "Periodo de prueba",
  active: "Cuenta activa",
  payment_pending: "Pago pendiente",
  suspended: "Cuenta suspendida",
  cancelled: "Cuenta cancelada",
};

export const DESCRIPCION_ESTADO: Record<EstadoCuenta, string> = {
  trial: "Estás probando la aplicación con actualizaciones limitadas.",
  active: "Tu cuenta está al día y puedes actualizar tu información.",
  payment_pending:
    "Tenemos un pago pendiente. Puedes seguir viendo tu información guardada.",
  suspended:
    "Tu cuenta está suspendida. Tu información guardada continúa disponible, pero no podemos hacer nuevas actualizaciones.",
  cancelled:
    "Tu cuenta fue cancelada. Conservamos tu historial y puedes reactivarla cuando quieras.",
};

export interface PermisosCuenta {
  /** Puede ver la información ya guardada. */
  puedeLeer: boolean;
  /** Puede pedir nuevas actualizaciones al proveedor. */
  puedeActualizar: boolean;
  /** Puede cambiar configuración de la empresa. */
  puedeConfigurar: boolean;
  /** Puede reactivarse desde la aplicación. */
  puedeReactivar: boolean;
  mensaje: string;
}

export function permisosPorEstado(estado: EstadoCuenta): PermisosCuenta {
  switch (estado) {
    case "trial":
    case "active":
      return {
        puedeLeer: true,
        puedeActualizar: true,
        puedeConfigurar: true,
        puedeReactivar: false,
        mensaje: DESCRIPCION_ESTADO[estado],
      };
    case "payment_pending":
      return {
        puedeLeer: true,
        puedeActualizar: true,
        puedeConfigurar: true,
        puedeReactivar: false,
        mensaje: DESCRIPCION_ESTADO[estado],
      };
    case "suspended":
    case "cancelled":
      return {
        puedeLeer: true,
        puedeActualizar: false,
        puedeConfigurar: false,
        puedeReactivar: true,
        mensaje: DESCRIPCION_ESTADO[estado],
      };
  }
}

export interface EvaluacionLimite {
  permitido: boolean;
  incluidas: number;
  usadas: number;
  restantes: number;
  titulo: string;
  mensaje: string;
}

/**
 * Evalúa si quedan actualizaciones incluidas en el mes.
 * Nunca menciona créditos técnicos: habla de "actualizaciones".
 */
export function evaluarLimiteActualizaciones(entrada: {
  estado: EstadoCuenta;
  incluidas: number;
  usadas: number;
  mesUso: string | null;
  mesActual: string;
}): EvaluacionLimite {
  const { estado, incluidas, mesUso, mesActual } = entrada;
  // El contador se reinicia cada mes calendario.
  const usadas = mesUso === mesActual ? Math.max(0, entrada.usadas) : 0;
  const restantes = Math.max(0, incluidas - usadas);
  const permisos = permisosPorEstado(estado);

  if (!permisos.puedeActualizar) {
    return {
      permitido: false,
      incluidas,
      usadas,
      restantes,
      titulo: ETIQUETA_ESTADO[estado],
      mensaje: `${permisos.mensaje} Tu información guardada continúa disponible.`,
    };
  }

  if (restantes <= 0) {
    return {
      permitido: false,
      incluidas,
      usadas,
      restantes: 0,
      titulo: "Has alcanzado el límite de actualizaciones",
      mensaje:
        "Ya usaste todas las actualizaciones incluidas este mes. Tu información guardada continúa disponible.",
    };
  }

  return {
    permitido: true,
    incluidas,
    usadas,
    restantes,
    titulo: "Actualizaciones incluidas este mes",
    mensaje: `Te quedan ${restantes} de ${incluidas} actualizaciones incluidas este mes.`,
  };
}

/** Mes calendario en horario de Chile continental. */
export function mesActualChile(fecha: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
  }).format(fecha);
  return partes.slice(0, 7);
}
