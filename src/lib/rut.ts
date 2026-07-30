/** Utilidades de RUT chileno (normalización, validación y formato). */

export function normalizarRut(valor: string): string {
  return (valor ?? "").replace(/[^0-9kK]/g, "").toUpperCase();
}

export function digitoVerificador(cuerpo: string): string {
  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

export function esRutValido(valor: string): boolean {
  const limpio = normalizarRut(valor);
  if (limpio.length < 8 || limpio.length > 9) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  return digitoVerificador(cuerpo) === dv;
}

export function formatearRut(valor: string): string {
  const limpio = normalizarRut(valor);
  if (limpio.length < 2) return limpio;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}
