/**
 * Control de costos por empresa. Módulo puro.
 * Agrega el consumo registrado y genera alertas administrativas.
 * El cliente nunca ve endpoints ni códigos técnicos.
 */

export type CategoriaConsumo = "rcv" | "f29" | "pdf" | "otro";

export interface EventoConsumo {
  categoria: CategoriaConsumo;
  consultas: number;
  cacheHits: number;
  errores: number;
  pdfsNuevos: number;
  unidades: number;
  fueraDeFlujo?: boolean;
  periodo?: string | null;
  mes: string;
}

export interface ResumenConsumo {
  mes: string;
  consultasRcv: number;
  consultasF29: number;
  consultasTotales: number;
  consultasEvitadasPorCache: number;
  pdfsNuevos: number;
  erroresConCosto: number;
  fueraDeFlujo: number;
  unidadesTotales: number;
  costoPromedioMensual: number;
}

export function resumirConsumo(
  eventos: EventoConsumo[],
  mes?: string,
): ResumenConsumo {
  const filtrados = mes ? eventos.filter((e) => e.mes === mes) : eventos;
  const meses = new Set(filtrados.map((e) => e.mes));
  const resumen: ResumenConsumo = {
    mes: mes ?? "todos",
    consultasRcv: 0,
    consultasF29: 0,
    consultasTotales: 0,
    consultasEvitadasPorCache: 0,
    pdfsNuevos: 0,
    erroresConCosto: 0,
    fueraDeFlujo: 0,
    unidadesTotales: 0,
    costoPromedioMensual: 0,
  };

  for (const e of filtrados) {
    if (e.categoria === "rcv") resumen.consultasRcv += e.consultas;
    if (e.categoria === "f29") resumen.consultasF29 += e.consultas;
    resumen.consultasTotales += e.consultas;
    resumen.consultasEvitadasPorCache += e.cacheHits;
    resumen.pdfsNuevos += e.pdfsNuevos;
    resumen.erroresConCosto += e.errores;
    resumen.unidadesTotales += e.unidades;
    if (e.fueraDeFlujo) resumen.fueraDeFlujo += 1;
  }

  resumen.costoPromedioMensual =
    meses.size > 0 ? resumen.unidadesTotales / meses.size : 0;
  return resumen;
}

export type TipoAlertaConsumo =
  | "consumo_anormal"
  | "pdf_repetido"
  | "muchos_fallos"
  | "presupuesto_cercano"
  | "fuera_de_flujo";

export interface AlertaConsumo {
  tipo: TipoAlertaConsumo;
  severidad: "info" | "warning" | "critical";
  mensaje: string;
}

export interface ParametrosAlerta {
  presupuesto: number;
  /** Promedio histórico de unidades por mes de esta empresa. */
  promedioHistorico?: number;
  /** PDFs descargados más de una vez para el mismo periodo. */
  pdfsRepetidos?: number;
}

export function detectarAlertasConsumo(
  resumen: ResumenConsumo,
  p: ParametrosAlerta,
): AlertaConsumo[] {
  const alertas: AlertaConsumo[] = [];

  if (p.presupuesto > 0 && resumen.unidadesTotales >= p.presupuesto * 0.8) {
    alertas.push({
      tipo: "presupuesto_cercano",
      severidad: resumen.unidadesTotales >= p.presupuesto ? "critical" : "warning",
      mensaje:
        resumen.unidadesTotales >= p.presupuesto
          ? "La empresa alcanzó su presupuesto mensual de actualizaciones."
          : "La empresa está cerca de su presupuesto mensual de actualizaciones.",
    });
  }

  if (
    p.promedioHistorico &&
    p.promedioHistorico > 0 &&
    resumen.unidadesTotales > p.promedioHistorico * 2
  ) {
    alertas.push({
      tipo: "consumo_anormal",
      severidad: "warning",
      mensaje: "El consumo del mes duplica el promedio histórico de esta empresa.",
    });
  }

  if ((p.pdfsRepetidos ?? 0) > 0) {
    alertas.push({
      tipo: "pdf_repetido",
      severidad: "info",
      mensaje: "Se descargó más de una vez el mismo documento del mismo periodo.",
    });
  }

  if (resumen.erroresConCosto >= 3) {
    alertas.push({
      tipo: "muchos_fallos",
      severidad: "warning",
      mensaje: "Hay varios intentos fallidos que igualmente tuvieron costo.",
    });
  }

  if (resumen.fueraDeFlujo > 0) {
    alertas.push({
      tipo: "fuera_de_flujo",
      severidad: "critical",
      mensaje: "Se detectaron consultas realizadas fuera del flujo económico.",
    });
  }

  return alertas;
}
