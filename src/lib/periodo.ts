/**
 * Periodo tributario como texto inmutable `AAAA-MM`.
 *
 * Regla única del proyecto: el periodo NUNCA se convierte a `Date`.
 * No se usa `new Date(anio, mes)`, `Date.parse`, `toISOString`, zonas horarias
 * ni índices de mes 0–11. Todas las derivaciones son aritmética sobre el texto,
 * así `America/Santiago` (o cualquier otra zona) no puede desplazar el mes.
 */

export const PATRON_PERIODO = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Verdadero solo para `AAAA-MM` con mes entre 01 y 12. */
export function esPeriodoValido(valor: unknown): valor is string {
  return typeof valor === "string" && PATRON_PERIODO.test(valor);
}

/**
 * Deja el periodo en `AAAA-MM` sin pasar por fechas.
 * Acepta `AAAA-MM`, `AAAAMM` y `AAAA-MM-DD`; cualquier otra cosa es inválida.
 */
export function normalizarPeriodo(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  if (esPeriodoValido(limpio)) return limpio;
  const compacto = /^(\d{4})(0[1-9]|1[0-2])$/.exec(limpio);
  if (compacto) return `${compacto[1]}-${compacto[2]}`;
  const conDia = /^(\d{4})-(0[1-9]|1[0-2])-\d{2}/.exec(limpio);
  if (conDia) return `${conDia[1]}-${conDia[2]}`;
  return null;
}

/** Formato que espera el proveedor: `2026-01` -> `202601`. */
export function aPeriodoCompacto(periodo: string): string {
  const p = normalizarPeriodo(periodo);
  if (!p) throw new Error("El periodo debe tener el formato AAAA-MM.");
  return p.replace("-", "");
}

/** Mes anterior, calculado solo con números del propio texto. */
export function periodoAnterior(periodo: string): string {
  const p = normalizarPeriodo(periodo);
  if (!p) throw new Error("El periodo debe tener el formato AAAA-MM.");
  const anio = Number(p.slice(0, 4));
  const mes = Number(p.slice(5, 7));
  const nuevoMes = mes === 1 ? 12 : mes - 1;
  const nuevoAnio = mes === 1 ? anio - 1 : anio;
  return `${nuevoAnio}-${String(nuevoMes).padStart(2, "0")}`;
}

/** Mes siguiente, calculado solo con números del propio texto. */
export function periodoSiguiente(periodo: string): string {
  const p = normalizarPeriodo(periodo);
  if (!p) throw new Error("El periodo debe tener el formato AAAA-MM.");
  const anio = Number(p.slice(0, 4));
  const mes = Number(p.slice(5, 7));
  const nuevoMes = mes === 12 ? 1 : mes + 1;
  const nuevoAnio = mes === 12 ? anio + 1 : anio;
  return `${nuevoAnio}-${String(nuevoMes).padStart(2, "0")}`;
}

/** Compara dos periodos tolerando `AAAAMM` o `AAAA-MM`. */
export function mismoPeriodo(a: unknown, b: unknown): boolean {
  const x = normalizarPeriodo(a);
  const y = normalizarPeriodo(b);
  return x !== null && x === y;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Etiqueta legible: `2026-01` -> `enero de 2026`. Sin fechas ni zonas. */
export function etiquetaPeriodo(periodo: string): string {
  const p = normalizarPeriodo(periodo);
  if (!p) return String(periodo);
  return `${MESES[Number(p.slice(5, 7)) - 1]} de ${p.slice(0, 4)}`;
}
