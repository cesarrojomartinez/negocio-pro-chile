/**
 * Sanitización profunda de datos antes de guardarlos o registrarlos.
 *
 * Regla dura de esta etapa: ninguna Clave Tributaria, token, cookie o cabecera
 * de autorización puede quedar en la base de datos, en los respaldos crudos ni
 * en los registros de actividad.
 */

const LLAVES_PROHIBIDAS =
  /(clave|contrase|password|passwd|^pass$|token|secret|authorization|auth|cookie|certificad|cert$|private_?key|session|jwt|bearer|firma|pin)/i;

export const VALOR_OMITIDO = "[omitido]";

const PROFUNDIDAD_MAXIMA = 12;

/**
 * Devuelve una copia del valor sin llaves sensibles, en cualquier nivel.
 * Si algo no se puede recorrer con seguridad, se descarta.
 */
export function sanitizarProfundo<T>(valor: T, profundidad = 0): unknown {
  if (profundidad > PROFUNDIDAD_MAXIMA) return VALOR_OMITIDO;
  if (valor === null || valor === undefined) return valor ?? null;

  const tipo = typeof valor;
  if (tipo === "string" || tipo === "number" || tipo === "boolean") return valor;
  if (tipo === "function" || tipo === "symbol" || tipo === "bigint")
    return VALOR_OMITIDO;

  if (Array.isArray(valor))
    return valor.map((v) => sanitizarProfundo(v, profundidad + 1));

  if (valor instanceof Date) return valor.toISOString();

  if (tipo === "object") {
    const salida: Record<string, unknown> = {};
    for (const [llave, v] of Object.entries(valor as Record<string, unknown>)) {
      if (LLAVES_PROHIBIDAS.test(llave)) {
        salida[llave] = VALOR_OMITIDO;
        continue;
      }
      salida[llave] = sanitizarProfundo(v, profundidad + 1);
    }
    return salida;
  }

  return VALOR_OMITIDO;
}

/**
 * Verifica que un objeto ya sanitizado no contenga rastros de una clave
 * conocida. Se usa como última barrera antes de persistir un respaldo.
 */
export function contieneValorSensible(valor: unknown, secretos: string[]): boolean {
  const candidatos = secretos.filter((s) => s && s.length >= 4);
  if (!candidatos.length) return false;
  let texto: string;
  try {
    texto = JSON.stringify(valor) ?? "";
  } catch {
    return true;
  }
  return candidatos.some((s) => texto.includes(s));
}
