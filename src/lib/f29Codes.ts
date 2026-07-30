/**
 * Registro versionado de códigos del Formulario 29.
 *
 * Módulo puro: solo describe qué código existe, cómo se llama, qué tipo de
 * valor tiene y con qué texto suele aparecer en el formulario compacto.
 * Ampliar este registro NO cambia extracciones históricas: cada extracción
 * guarda la versión del lector con la que fue generada.
 */

/** Versión del lector. Cambiar SIEMPRE que cambie el comportamiento del parser. */
export const F29_PARSER_VERSION = "f29-pdf-1.0.0";

export type F29ValueType = "money" | "rate" | "count";

export type F29Group =
  | "debitos"
  | "creditos"
  | "remanente"
  | "iva"
  | "ppm"
  | "retenciones"
  | "impuesto_unico"
  | "honorarios"
  | "creditos_especiales"
  | "debitos_especiales"
  | "postergacion"
  | "recargos"
  | "totales";

export interface F29CodeDefinition {
  code: string;
  label: string;
  valueType: F29ValueType;
  group: F29Group;
  /** Texto que suele acompañar al código en la misma línea del formulario. */
  anchors: string[];
}

function def(
  code: string,
  label: string,
  group: F29Group,
  anchors: string[],
  valueType: F29ValueType = "money",
): F29CodeDefinition {
  return { code, label, group, anchors, valueType };
}

/** Códigos conocidos. Los no listados igualmente se extraen y se conservan. */
export const F29_CODE_REGISTRY: Record<string, F29CodeDefinition> = Object.fromEntries(
  [
    def("502", "Débito por facturas emitidas", "debitos", ["debito", "facturas emitidas"]),
    def("503", "Cantidad de facturas emitidas", "debitos", ["cantidad de facturas"], "count"),
    def("110", "Débito por boletas", "debitos", ["boletas"]),
    def("510", "Notas de crédito emitidas", "debitos", ["notas de credito"]),
    def("538", "Total débitos", "debitos", ["total debitos"]),

    def("511", "Crédito por documentos electrónicos recibidos", "creditos", [
      "documentos electronicos recibidos",
    ]),
    def("520", "Crédito por facturas del giro", "creditos", ["facturas del giro"]),
    def("524", "Crédito por notas de crédito recibidas", "creditos", ["notas de credito recibidas"]),
    def("537", "Total créditos", "creditos", ["total creditos"]),

    def("504", "Remanente de crédito fiscal del mes anterior", "remanente", [
      "remanente",
      "mes anterior",
    ]),
    def("77", "Remanente de crédito para el período siguiente", "remanente", [
      "remanente",
      "periodo siguiente",
    ]),

    def("89", "IVA determinado", "iva", ["iva determinado"]),
    def("595", "Subtotal impuesto determinado anverso", "totales", ["subtotal"]),
    def("547", "Total determinado", "totales", ["total determinado"]),
    def("91", "Total a pagar dentro del plazo legal", "totales", ["dentro del plazo"]),
    def("94", "Total a pagar con recargos", "totales", ["recargo"]),

    def("563", "Base imponible PPM", "ppm", ["base imponible"]),
    def("115", "Tasa PPM", "ppm", ["tasa"], "rate"),
    def("62", "PPM neto determinado", "ppm", ["ppm neto"]),
    def("64", "Crédito por PPM", "ppm", ["credito ppm"]),
    def("66", "Otros PPM", "ppm", ["otros ppm"]),

    def("48", "Retención impuesto único a los trabajadores", "impuesto_unico", ["impuesto unico"]),
    def("151", "Retención sobre honorarios", "honorarios", ["honorarios"]),
    def("153", "Retención sobre rentas del artículo 42 N°2", "honorarios", ["retencion"]),
    def("50", "Retención por cambio de sujeto", "retenciones", ["cambio de sujeto"]),
    def("39", "Retenciones de terceros", "retenciones", ["retencion"]),

    def("593", "Crédito especial empresas constructoras", "creditos_especiales", ["credito especial"]),
    def("127", "Crédito capacitación", "creditos_especiales", ["capacitacion"]),
    def("30", "Débito especial", "debitos_especiales", ["debito especial"]),

    def("756", "IVA postergado", "postergacion", ["postergacion", "postergado"]),
    def("92", "Reajuste", "recargos", ["reajuste"]),
    def("93", "Intereses y multas", "recargos", ["intereses", "multas"]),
  ].map((d) => [d.code, d]),
);

/** Códigos que el motor tributario necesita para tratar el periodo como declarado. */
export const CODIGOS_CRITICOS = ["538", "537", "91"] as const;

/** Códigos prioritarios que se muestran en la interfaz. */
export const CODIGOS_PRIORITARIOS = [
  "502",
  "510",
  "538",
  "511",
  "520",
  "504",
  "537",
  "77",
  "89",
  "563",
  "115",
  "62",
  "595",
  "547",
  "91",
  "94",
] as const;

/** Grupos que se conservan siempre aunque no sean prioritarios. */
export const GRUPOS_CONSERVADOS: F29Group[] = [
  "retenciones",
  "impuesto_unico",
  "honorarios",
  "ppm",
  "creditos_especiales",
  "debitos_especiales",
  "postergacion",
  "recargos",
];

export function definicionDeCodigo(code: string): F29CodeDefinition | null {
  return F29_CODE_REGISTRY[code] ?? null;
}

/** Todo token de 2 o 3 dígitos puede ser un código del formulario. */
export function pareceCodigo(token: string): boolean {
  return /^\d{2,3}$/.test(token);
}
