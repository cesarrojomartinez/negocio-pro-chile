/**
 * Frescura de la información mostrada al usuario.
 *
 * Funciones puras: reciben el instante actual y lo último guardado, y
 * devuelven cuán vigente está la información y cuándo conviene actualizar.
 * No consultan la base de datos ni al proveedor.
 */
import { diaCivil, lunesDeLaSemana } from "@/lib/syncPolicy";

export type EstadoFrescura =
  | "never_synced"
  | "fresh"
  | "stale"
  | "outdated"
  | "closed_period";

export interface EntradaFrescura {
  ahora: Date;
  ultimaSincronizacionExitosa: string | null;
  /** El periodo consultado ya terminó (mes cerrado en el calendario). */
  periodoCerrado: boolean;
  /** El periodo fue cerrado o confirmado por el usuario o su contador. */
  periodoConfirmado?: boolean;
}

export interface ResumenFrescura {
  estado: EstadoFrescura;
  /** Horas transcurridas desde la última consulta exitosa. */
  horasDesdeUltima: number | null;
  proximaActualizacionRecomendada: string | null;
  titulo: string;
  descripcion: string;
}

const HORA = 3600000;

/** Medianoche chilena del día siguiente, expresada en UTC. */
function proximoDia(fecha: Date): string {
  const [a, m, d] = diaCivil(fecha).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1, 4, 0, 0)).toISOString();
}

/** Lunes siguiente a las 00:00 de Chile, expresado en UTC. */
function proximaSemana(fecha: Date): string {
  const [a, m, d] = lunesDeLaSemana(fecha).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 7, 4, 0, 0)).toISOString();
}

export function evaluarFrescura(entrada: EntradaFrescura): ResumenFrescura {
  const { ahora, periodoCerrado } = entrada;

  if (entrada.periodoConfirmado) {
    return {
      estado: "closed_period",
      horasDesdeUltima: entrada.ultimaSincronizacionExitosa
        ? Math.floor(
            (ahora.getTime() -
              new Date(entrada.ultimaSincronizacionExitosa).getTime()) /
              HORA,
          )
        : null,
      proximaActualizacionRecomendada: null,
      titulo: "Periodo cerrado",
      descripcion:
        "Este mes ya fue revisado y cerrado. La información queda guardada tal como se dejó.",
    };
  }

  if (!entrada.ultimaSincronizacionExitosa) {
    return {
      estado: "never_synced",
      horasDesdeUltima: null,
      proximaActualizacionRecomendada: ahora.toISOString(),
      titulo: "Sin información del SII",
      descripcion:
        "Todavía no traemos información de este periodo. Cuando actualices, verás tus ventas y compras.",
    };
  }

  const ultima = new Date(entrada.ultimaSincronizacionExitosa);
  const horas = Math.floor((ahora.getTime() - ultima.getTime()) / HORA);

  if (periodoCerrado) {
    const mismaSemana = lunesDeLaSemana(ultima) === lunesDeLaSemana(ahora);
    return {
      estado: mismaSemana ? "fresh" : "stale",
      horasDesdeUltima: horas,
      proximaActualizacionRecomendada: proximaSemana(ultima),
      titulo: mismaSemana ? "Información al día" : "Conviene actualizar",
      descripcion: mismaSemana
        ? "Este mes ya terminó y su información se revisa una vez por semana."
        : "Este mes ya terminó y no se consulta desde la semana pasada.",
    };
  }

  const mismoDia = diaCivil(ultima) === diaCivil(ahora);
  if (mismoDia)
    return {
      estado: "fresh",
      horasDesdeUltima: horas,
      proximaActualizacionRecomendada: proximoDia(ultima),
      titulo: "Información al día",
      descripcion: "Ya consultamos el SII hoy. No es necesario volver a consultar.",
    };

  const estado: EstadoFrescura = horas >= 72 ? "outdated" : "stale";
  return {
    estado,
    horasDesdeUltima: horas,
    proximaActualizacionRecomendada: proximoDia(ultima),
    titulo: estado === "outdated" ? "Información desactualizada" : "Conviene actualizar",
    descripcion:
      estado === "outdated"
        ? "Han pasado varios días desde la última consulta. Los montos podrían haber cambiado."
        : "La última consulta fue en un día anterior. Puedes actualizar cuando quieras.",
  };
}

/** Texto amable con la antigüedad de la información. */
export function antiguedadLegible(horas: number | null): string {
  if (horas == null) return "sin consultas previas";
  if (horas < 1) return "hace menos de una hora";
  if (horas < 24) return `hace ${horas} ${horas === 1 ? "hora" : "horas"}`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}
