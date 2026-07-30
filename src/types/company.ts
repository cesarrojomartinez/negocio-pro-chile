export type EstadoConexionSii =
  | "disconnected"
  | "connecting"
  | "connected"
  | "stale"
  | "error";

export interface Empresa {
  id: string;
  rut: string;
  razonSocial: string;
  nombreFantasia: string;
  actividad: string;
  estadoConexionSii: EstadoConexionSii;
  ultimaSincronizacion: string | null;
  periodoActivo: string;
}

export interface Periodo {
  id: string;
  etiqueta: string;
  anio: number;
  mes: number;
}

export type EscenarioId = "equilibrado" | "remanente" | "ventasAltas";

export interface Escenario {
  id: EscenarioId;
  nombre: string;
  descripcion: string;
}
