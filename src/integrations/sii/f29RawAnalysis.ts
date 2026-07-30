/**
 * Análisis puro de una respuesta cruda del proveedor.
 *
 * No hace red, no toca la base de datos y no interpreta tributariamente nada:
 * solo describe la ESTRUCTURA recibida para poder decidir, con evidencia, si el
 * proveedor entrega o no conceptos del Formulario 29.
 */

/** Términos buscados en la auditoría del F29. */
export const TERMINOS_F29 = [
  "ppm",
  "remanente",
  "retencion",
  "iva",
  "total",
  "monto",
  "tasa",
  "base",
  "codigo",
  "504",
  "563",
  "115",
  "62",
  "89",
  "91",
] as const;

export interface CoincidenciaTermino {
  termino: string;
  /** Ruta JSON donde apareció, por ejemplo `data[0].codigo504`. */
  ruta: string;
  /** Dónde coincidió: en el nombre de la propiedad o en el valor de texto. */
  origen: "llave" | "valor";
  tipoValor: "string" | "number" | "boolean" | "null" | "object" | "array";
  /** Muestra acotada del valor. Nunca se usa con datos sensibles. */
  muestra: string;
}

export interface AnalisisPayload {
  /** Forma del nivel superior. */
  tipoRaiz: "array" | "object" | "primitivo" | "nulo";
  clavesSuperiores: string[];
  /** Envoltura detectada hasta la primera lista, si existe. */
  envoltura: string | null;
  /** Cantidad de elementos de la lista encontrada. */
  elementos: number;
  propiedadesPrimerElemento: string[];
  /** Rutas anidadas (profundidad > 1) presentes en el primer elemento. */
  propiedadesAnidadas: string[];
  /** Todas las rutas de propiedad observadas, sin valores. */
  rutas: string[];
  coincidencias: CoincidenciaTermino[];
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function tipoDe(v: unknown): CoincidenciaTermino["tipoValor"] {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  if (t === "string" || t === "number" || t === "boolean") return t;
  return "object";
}

function muestraDe(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "object") return Array.isArray(v) ? `[${v.length} elementos]` : "{objeto}";
  return String(v).slice(0, 60);
}

/** Recorre el payload acumulando rutas y coincidencias por término. */
function recorrer(
  valor: unknown,
  ruta: string,
  rutas: string[],
  coincidencias: CoincidenciaTermino[],
  profundidad: number,
) {
  if (profundidad > 8) return;

  if (Array.isArray(valor)) {
    // Solo se recorren los dos primeros elementos: basta para describir la forma.
    valor.slice(0, 2).forEach((v, i) => recorrer(v, `${ruta}[${i}]`, rutas, coincidencias, profundidad + 1));
    return;
  }

  if (!esObjeto(valor)) return;

  for (const [llave, v] of Object.entries(valor)) {
    const rutaHija = ruta ? `${ruta}.${llave}` : llave;
    rutas.push(rutaHija);

    const llaveNormalizada = llave
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    for (const termino of TERMINOS_F29) {
      if (llaveNormalizada.includes(termino)) {
        coincidencias.push({
          termino,
          ruta: rutaHija,
          origen: "llave",
          tipoValor: tipoDe(v),
          muestra: muestraDe(v),
        });
      } else if (typeof v === "string") {
        const texto = v
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        if (texto.includes(termino) && termino.length >= 3) {
          coincidencias.push({
            termino,
            ruta: rutaHija,
            origen: "valor",
            tipoValor: "string",
            muestra: muestraDe(v),
          });
        }
      }
    }

    recorrer(v, rutaHija, rutas, coincidencias, profundidad + 1);
  }
}

/** Busca la primera lista de registros y devuelve su ruta. */
function localizarLista(valor: unknown): { ruta: string | null; items: unknown[] } {
  if (Array.isArray(valor)) return { ruta: "(arreglo directo)", items: valor };
  if (!esObjeto(valor)) return { ruta: null, items: [] };
  for (const [llave, v] of Object.entries(valor)) {
    if (Array.isArray(v)) return { ruta: llave, items: v };
    if (esObjeto(v)) {
      const anidado = localizarLista(v);
      if (anidado.ruta) return { ruta: `${llave}.${anidado.ruta}`, items: anidado.items };
    }
  }
  return { ruta: null, items: [] };
}

export function analizarPayload(payload: unknown): AnalisisPayload {
  const rutas: string[] = [];
  const coincidencias: CoincidenciaTermino[] = [];
  recorrer(payload, "", rutas, coincidencias, 0);

  const lista = localizarLista(payload);
  const primero = lista.items[0];
  const propiedadesPrimerElemento = esObjeto(primero) ? Object.keys(primero) : [];
  const propiedadesAnidadas: string[] = [];
  if (esObjeto(primero)) {
    for (const [llave, v] of Object.entries(primero)) {
      if (esObjeto(v)) propiedadesAnidadas.push(...Object.keys(v).map((k) => `${llave}.${k}`));
      else if (Array.isArray(v) && esObjeto(v[0]))
        propiedadesAnidadas.push(
          ...Object.keys(v[0] as Record<string, unknown>).map((k) => `${llave}[].${k}`),
        );
    }
  }

  const tipoRaiz: AnalisisPayload["tipoRaiz"] = Array.isArray(payload)
    ? "array"
    : esObjeto(payload)
      ? "object"
      : payload == null
        ? "nulo"
        : "primitivo";

  return {
    tipoRaiz,
    clavesSuperiores: esObjeto(payload) ? Object.keys(payload) : [],
    envoltura: lista.ruta,
    elementos: lista.items.length,
    propiedadesPrimerElemento,
    propiedadesAnidadas: [...new Set(propiedadesAnidadas)],
    rutas: [...new Set(rutas)].slice(0, 200),
    coincidencias,
  };
}

/** Propiedades presentes en el crudo que el modelo normalizado no conserva. */
export function propiedadesDescartadas(
  propiedadesCrudas: string[],
  propiedadesUsadas: string[],
): string[] {
  const usadas = new Set(propiedadesUsadas.map((p) => p.toLowerCase()));
  return propiedadesCrudas.filter((p) => !usadas.has(p.toLowerCase()));
}

/** Oculta el folio en cualquier salida visible. */
export function enmascararFolio(folio: string): string {
  const limpio = String(folio ?? "");
  if (limpio.length <= 4) return "••••";
  return `${"•".repeat(Math.max(2, limpio.length - 4))}${limpio.slice(-4)}`;
}
