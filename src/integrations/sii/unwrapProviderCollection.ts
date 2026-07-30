/**
 * Desenvoltura central y validada de las colecciones que entrega API Gateway.
 *
 * Función pura, sin red ni base de datos. Existe porque cada recurso del
 * proveedor envuelve la lista de filas de una forma distinta, todas presentes
 * en el esquema OpenAPI oficial:
 *
 *  - Detalle de ventas y de compras:      { data: [ ... ] }
 *  - Resumen de compras:                  { data: { respEstado, data: [ ... ] } }
 *  - Listado de F29:                      [ ... ]  (arreglo directo)
 *
 * Regla dura: una respuesta con contenido que NO calza con ninguna forma
 * conocida jamás se convierte silenciosamente en `[]`. Se informa como
 * `INVALID_PROVIDER_RESPONSE` para conservar el respaldo y diagnosticarla.
 */
import { SiiProviderError, type SiiModule } from "./contracts";

export type FormaColeccion =
  | "array"
  | "data.array"
  | "result.array"
  | "data.items"
  | "data.data"
  | "vacio";

export interface ColeccionProveedor<T> {
  items: T[];
  /** Envoltura reconocida. Se guarda en el diagnóstico del módulo. */
  forma: FormaColeccion;
  /** Claves de primer nivel del JSON recibido (nunca valores). */
  clavesSuperiores: string[];
  /** Nombres de las propiedades del primer elemento (nunca valores). */
  propiedadesPrimerElemento: string[];
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return !!valor && typeof valor === "object" && !Array.isArray(valor);
}

function propiedadesDe(items: unknown[]): string[] {
  const primero = items[0];
  return esObjeto(primero) ? Object.keys(primero) : [];
}

/**
 * Devuelve las filas de una respuesta del proveedor.
 * @throws SiiProviderError INVALID_PROVIDER_RESPONSE si hay contenido en una
 * envoltura desconocida.
 */
export function unwrapProviderCollection<T>(
  respuesta: unknown,
  modulo: SiiModule | null = null,
): ColeccionProveedor<T> {
  if (respuesta == null || respuesta === "")
    return { items: [], forma: "vacio", clavesSuperiores: [], propiedadesPrimerElemento: [] };

  if (Array.isArray(respuesta))
    return {
      items: respuesta as T[],
      forma: "array",
      clavesSuperiores: [],
      propiedadesPrimerElemento: propiedadesDe(respuesta),
    };

  if (!esObjeto(respuesta)) throw new SiiProviderError("INVALID_PROVIDER_RESPONSE", modulo);

  const clavesSuperiores = Object.keys(respuesta);
  const armar = (items: unknown[], forma: FormaColeccion): ColeccionProveedor<T> => ({
    items: items as T[],
    forma,
    clavesSuperiores,
    propiedadesPrimerElemento: propiedadesDe(items),
  });

  const { data, result } = respuesta as { data?: unknown; result?: unknown };

  if (Array.isArray(data)) return armar(data, "data.array");
  if (Array.isArray(result)) return armar(result, "result.array");

  if (esObjeto(data)) {
    const anidado = data as { data?: unknown; items?: unknown };
    if (Array.isArray(anidado.items)) return armar(anidado.items, "data.items");
    if (Array.isArray(anidado.data)) return armar(anidado.data, "data.data");
    // `{ data: { respEstado: ... } }` sin lista: el SII no entregó filas.
    if (anidado.data === null || anidado.items === null || "respEstado" in data)
      return { items: [], forma: "vacio", clavesSuperiores, propiedadesPrimerElemento: [] };
    throw new SiiProviderError("INVALID_PROVIDER_RESPONSE", modulo);
  }

  // Ausencia explícita de datos: el periodo no tiene filas de este tipo.
  if (data === null || result === null || clavesSuperiores.length === 0)
    return { items: [], forma: "vacio", clavesSuperiores, propiedadesPrimerElemento: [] };

  throw new SiiProviderError("INVALID_PROVIDER_RESPONSE", modulo);
}
