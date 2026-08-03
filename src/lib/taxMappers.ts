import type { NivelConfiabilidad } from "@/types/tax";
import type { EstadoConexionSii } from "@/types/company";

export type DireccionDocumento = "sale" | "purchase";
export type RcvStatus =
  | "registered"
  | "pending"
  | "claimed"
  | "excluded"
  | "accepted"
  | "unknown";
export type ConfianzaDb = "high" | "medium" | "low" | "unknown";

export function rcvDesdeEstado(
  direccion: DireccionDocumento,
  estado: string,
): RcvStatus {
  if (direccion === "sale") return estado === "anulado" ? "excluded" : "accepted";
  switch (estado) {
    case "registrada":
      return "registered";
    case "pendiente":
      return "pending";
    case "reclamada":
      return "claimed";
    case "noIncluir":
      return "excluded";
    default:
      return "unknown";
  }
}

export function estadoDesdeRcv(direccion: DireccionDocumento, rcv: string) {
  if (direccion === "sale") return rcv === "excluded" ? "anulado" : "emitido";
  switch (rcv) {
    case "registered":
      return "registrada";
    case "pending":
      return "pendiente";
    case "claimed":
      return "reclamada";
    case "excluded":
      return "noIncluir";
    default:
      return "pendiente";
  }
}

export function confianzaADb(valor: NivelConfiabilidad): ConfianzaDb {
  if (valor === "alta") return "high";
  if (valor === "media") return "medium";
  return "low";
}

export function confianzaDesdeDb(valor: string | null): NivelConfiabilidad {
  if (valor === "high") return "alta";
  if (valor === "low") return "baja";
  return "media";
}

export const ESTADOS_CONEXION: EstadoConexionSii[] = [
  "disconnected",
  "connecting",
  "connected",
  "stale",
  "error",
];

export function etiquetaPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split("-").map(Number);
  const nombres = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  if (!anio || !mes) return periodo;
  return `${nombres[mes - 1]} ${anio}`;
}

export const ETIQUETA_ESTADO_PERIODO: Record<string, string> = {
  open: "Abierto",
  estimated: "Estimado",
  reviewed: "Revisado",
  closed: "Cerrado",
};

export function periodoAnterior(periodo: string = "2026-07"): string {
  if (!periodo || typeof periodo !== "string" || !periodo.includes("-")) return "2026-06";
  const [anio, mes] = periodo.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Días transcurridos y totales de un periodo YYYY-MM respecto de hoy. */
export function diasDePeriodo(periodo: string = "2026-07"): {
  diasTranscurridos: number;
  diasTotales: number;
} {
  if (!periodo || typeof periodo !== "string" || !periodo.includes("-")) {
    return { diasTranscurridos: 1, diasTotales: 30 };
  }
  const [anio, mes] = periodo.split("-").map(Number);
  const diasTotales = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const hoy = new Date();
  const esActual = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes;
  const esFuturo =
    anio > hoy.getFullYear() ||
    (anio === hoy.getFullYear() && mes > hoy.getMonth() + 1);
  if (esFuturo) return { diasTranscurridos: 1, diasTotales };
  return {
    diasTranscurridos: esActual ? Math.min(hoy.getDate(), diasTotales) : diasTotales,
    diasTotales,
  };
}
