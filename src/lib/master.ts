/**
 * Panel Master: tipos compartidos y utilidades puras.
 *
 * Módulo sin acceso a base de datos: solo formas de datos y reglas de
 * presentación/segmentación. No toca el motor tributario, los cálculos,
 * la sincronización con el SII ni credenciales de ningún tipo.
 */

import type { EstadoCuenta } from "@/lib/cuenta";

// ---------------------------------------------------------------------------
// Módulos del panel
// ---------------------------------------------------------------------------

export const MODULOS_MASTER = [
  "resumen",
  "clientes",
  "pagos",
  "planes",
  "consumo",
  "metricas",
  "comunicacion",
  "testimonios",
  "pagina",
  "soporte",
] as const;

export type ModuloMaster = (typeof MODULOS_MASTER)[number];

export const ETIQUETA_MODULO: Record<ModuloMaster, string> = {
  resumen: "Resumen",
  clientes: "Clientes",
  pagos: "Pagos y facturación",
  planes: "Planes",
  consumo: "Créditos API y consumo",
  metricas: "Métricas",
  comunicacion: "Comunicación",
  testimonios: "Testimonios",
  pagina: "Editor de página",
  soporte: "Soporte y actividad",
};


export function esModuloMaster(valor: unknown): valor is ModuloMaster {
  return (
    typeof valor === "string" && (MODULOS_MASTER as readonly string[]).includes(valor)
  );
}

// ---------------------------------------------------------------------------
// Comunicados
// ---------------------------------------------------------------------------

export const TIPOS_COMUNICADO = [
  "popup",
  "banner",
  "aviso",
  "informativo",
  "mantenimiento",
] as const;
export type TipoComunicado = (typeof TIPOS_COMUNICADO)[number];

export const ETIQUETA_TIPO_COMUNICADO: Record<TipoComunicado, string> = {
  popup: "Ventana emergente",
  banner: "Banner superior",
  aviso: "Aviso en el dashboard",
  informativo: "Mensaje informativo",
  mantenimiento: "Alerta de mantenimiento",
};

export const AUDIENCIAS = [
  "todos",
  "prueba",
  "plan",
  "activos",
  "suspendidos",
  "empresa",
] as const;
export type AudienciaComunicado = (typeof AUDIENCIAS)[number];

export const ETIQUETA_AUDIENCIA: Record<AudienciaComunicado, string> = {
  todos: "Todos los clientes",
  prueba: "Solo clientes en prueba",
  plan: "Un plan específico",
  activos: "Clientes activos",
  suspendidos: "Clientes suspendidos",
  empresa: "Una empresa seleccionada",
};

export const PRIORIDADES = ["baja", "normal", "alta"] as const;
export type PrioridadComunicado = (typeof PRIORIDADES)[number];

export interface Comunicado {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: TipoComunicado;
  prioridad: PrioridadComunicado;
  inicia: string;
  termina: string | null;
  visible: boolean;
  textoBoton: string | null;
  enlaceBoton: string | null;
  audiencia: AudienciaComunicado;
  planAudiencia: string | null;
  empresaAudiencia: string | null;
  publicado: string | null;
  creado: string;
  vistos: number;
  cerrados: number;
}

export interface DestinoComunicado {
  estadoCuenta: EstadoCuenta;
  planCodigo: string | null;
  companyId: string | null;
}

/** Regla pura de segmentación: decide si un comunicado aplica a un destinatario. */
export function comunicadoAplica(
  comunicado: Pick<
    Comunicado,
    "audiencia" | "planAudiencia" | "empresaAudiencia" | "visible" | "inicia" | "termina"
  >,
  destino: DestinoComunicado,
  ahora: Date = new Date(),
): boolean {
  if (!comunicado.visible) return false;
  if (new Date(comunicado.inicia).getTime() > ahora.getTime()) return false;
  if (comunicado.termina && new Date(comunicado.termina).getTime() < ahora.getTime())
    return false;

  switch (comunicado.audiencia) {
    case "todos":
      return true;
    case "prueba":
      return destino.estadoCuenta === "trial";
    case "activos":
      return destino.estadoCuenta === "active";
    case "suspendidos":
      return (
        destino.estadoCuenta === "suspended" ||
        destino.estadoCuenta === "payment_pending"
      );
    case "plan":
      return !!comunicado.planAudiencia && comunicado.planAudiencia === destino.planCodigo;
    case "empresa":
      return (
        !!comunicado.empresaAudiencia && comunicado.empresaAudiencia === destino.companyId
      );
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Pagos y facturación (suscripciones, nunca el F29 del cliente)
// ---------------------------------------------------------------------------

export const ESTADOS_PAGO = [
  "registrado",
  "aprobado",
  "pendiente",
  "fallido",
  "vencido",
  "anulado",
] as const;
export type EstadoPago = (typeof ESTADOS_PAGO)[number];

export interface EventoPago {
  id: string;
  companyId: string;
  empresa: string;
  tipo: string;
  monto: number | null;
  estado: string;
  referencia: string | null;
  detalle: string | null;
  fecha: string;
}

/** Suma los pagos aprobados de un mes (yyyy-mm). Regla pura. */
export function ingresosDelMes(eventos: EventoPago[], mes: string): number {
  return eventos
    .filter((e) => e.estado === "aprobado" && e.fecha.slice(0, 7) === mes)
    .reduce((total, e) => total + (e.monto ?? 0), 0);
}

/** Serie mensual de ingresos aprobados, ordenada de forma ascendente. */
export function serieIngresos(eventos: EventoPago[], meses: string[]) {
  return meses.map((mes) => ({ mes, monto: ingresosDelMes(eventos, mes) }));
}

/** Devuelve los últimos `n` meses en formato yyyy-mm, terminando en `hasta`. */
export function ultimosMeses(n: number, hasta: string): string[] {
  const [anio, mes] = hasta.split("-").map(Number);
  const salida: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const fecha = new Date(Date.UTC(anio ?? 2026, (mes ?? 1) - 1 - i, 1));
    salida.push(
      `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }
  return salida;
}

/** Tasa de conversión de prueba a pago, en porcentaje 0-100. */
export function tasaConversion(pagados: number, totales: number): number {
  if (totales <= 0) return 0;
  return Math.round((pagados / totales) * 1000) / 10;
}

/** Retención: clientes que siguen vigentes sobre el total histórico. */
export function tasaRetencion(vigentes: number, totales: number): number {
  return tasaConversion(vigentes, totales);
}

/** Convierte filas simples a CSV listo para descargar. */
export function aCsv(cabeceras: string[], filas: (string | number | null)[][]): string {
  const escapar = (v: string | number | null) => {
    const texto = v === null ? "" : String(v);
    return /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  return [cabeceras, ...filas].map((f) => f.map(escapar).join(";")).join("\n");
}
