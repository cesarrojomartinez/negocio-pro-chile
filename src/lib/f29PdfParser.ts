/**
 * Lector determinístico del Formulario 29 compacto.
 *
 * Módulo PURO: recibe los elementos de texto ya extraídos del PDF (con su
 * posición) y devuelve los códigos tributarios, los campos normalizados, las
 * validaciones contables y el nivel de confianza.
 *
 * No usa inteligencia artificial ni OCR: solo geometría del PDF, anclas
 * textuales del formulario y aritmética tributaria.
 */
import {
  CODIGOS_CRITICOS,
  F29_CODE_REGISTRY,
  definicionDeCodigo,
  pareceCodigo,
  type F29ValueType,
} from "./f29Codes";

export interface ItemTextoPdf {
  texto: string;
  pagina: number;
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export type MetodoExtraccion = "positional" | "anchor" | "linear";

export interface ValorCodigo {
  code: string;
  raw_value: string | null;
  normalized_value: number | null;
  value_type: F29ValueType;
  page: number | null;
  extraction_method: MetodoExtraccion;
  confidence: number;
  anchor: string | null;
  coordinates: { x: number; y: number; width: number; height: number } | null;
}

export type MapaCodigos = Record<string, ValorCodigo>;

export interface CamposNormalizadosF29 {
  declared_vat_debit: number | null;
  declared_current_vat_credit: number | null;
  declared_previous_carryforward: number | null;
  declared_total_vat_credits: number | null;
  declared_vat_payable: number | null;
  declared_new_carryforward: number | null;
  declared_ppm_base: number | null;
  declared_ppm_rate: number | null;
  declared_ppm: number | null;
  declared_subtotal: number | null;
  declared_total_determined: number | null;
  declared_total_payable: number | null;
  declared_total_with_surcharges: number | null;
  declared_withholdings: number | null;
}

export interface ValidacionF29 {
  id: "ppm" | "iva" | "total" | "exclusion" | "rut" | "periodo" | "folio";
  titulo: string;
  estado: "ok" | "advertencia" | "error" | "sin_datos";
  detalle: string;
  esperado?: number | null;
  obtenido?: number | null;
}

// ---------------------------------------------------------------- normalizar

/** "3.998.100" → 3998100 · "1.234,56" → 1234.56 · "" → null */
export function normalizarNumeroChileno(texto: string | null | undefined): number | null {
  if (texto == null) return null;
  let limpio = String(texto)
    .replace(/\$/g, "")
    .replace(/%/g, "")
    .replace(/\s|\u00a0/g, "")
    .replace(/^=/, "")
    .trim();
  if (!limpio) return null;

  let negativo = false;
  if (/^\(.*\)$/.test(limpio)) {
    negativo = true;
    limpio = limpio.slice(1, -1);
  }
  if (limpio.startsWith("-")) {
    negativo = true;
    limpio = limpio.slice(1);
  } else if (limpio.startsWith("+")) {
    limpio = limpio.slice(1);
  }
  if (!/^[\d.,]+$/.test(limpio)) return null;
  if (!/\d/.test(limpio)) return null;

  const tieneComa = limpio.includes(",");
  if (tieneComa) {
    // Coma = decimal en Chile; los puntos son separadores de miles.
    limpio = limpio.replace(/\./g, "").replace(",", ".");
  } else if (limpio.includes(".")) {
    const partes = limpio.split(".");
    const ultima = partes[partes.length - 1];
    // 1.234 / 1.234.567 → miles. 1.5 → decimal.
    limpio = partes.length > 2 || ultima.length === 3 ? partes.join("") : limpio;
  }

  const n = Number(limpio);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** Tasas: "2,5" → 0.025 · "1" → 0.01 · "0,025" → 0.025 */
export function normalizarTasa(texto: string | null | undefined): number | null {
  const n = normalizarNumeroChileno(texto);
  if (n == null) return null;
  if (n === 0) return 0;
  return n >= 1 ? n / 100 : n;
}

export function normalizarValor(texto: string | null, tipo: F29ValueType): number | null {
  if (texto == null || texto.trim() === "") return null;
  return tipo === "rate" ? normalizarTasa(texto) : normalizarNumeroChileno(texto);
}

function sinTildes(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ----------------------------------------------------------------- posición

/** Agrupa los elementos en filas visuales usando tolerancia de coordenada Y. */
export function agruparEnFilas(
  items: ItemTextoPdf[],
  tolerancia = 3,
): ItemTextoPdf[][] {
  const filas: ItemTextoPdf[][] = [];
  const ordenados = [...items]
    .filter((i) => i.texto.trim() !== "")
    .sort((a, b) => a.pagina - b.pagina || b.y - a.y || a.x - b.x);

  for (const item of ordenados) {
    const fila = filas.find(
      (f) => f[0].pagina === item.pagina && Math.abs(f[0].y - item.y) <= tolerancia,
    );
    if (fila) fila.push(item);
    else filas.push([item]);
  }
  return filas.map((f) => f.sort((a, b) => a.x - b.x));
}

/** Separa un texto en tokens conservando la posición aproximada del elemento. */
function tokenizar(item: ItemTextoPdf): ItemTextoPdf[] {
  const partes = item.texto.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return [{ ...item, texto: item.texto.trim() }];
  const anchoToken = item.ancho / Math.max(1, item.texto.length);
  let cursor = 0;
  return partes.map((p) => {
    const inicio = item.texto.indexOf(p, cursor);
    cursor = inicio + p.length;
    return { ...item, texto: p, x: item.x + Math.max(0, inicio) * anchoToken, ancho: p.length * anchoToken };
  });
}

function esValorNumerico(token: string): boolean {
  return /^[+\-(]?\$?[\d][\d.,]*\)?%?$/.test(token.trim());
}

/**
 * Estrategia principal: dentro de cada fila visual, cada token que parece un
 * código abre un segmento; el valor del código es el último número del
 * segmento. Así el número del código nunca se confunde con el de otro código
 * y las descripciones intermedias se ignoran.
 */
export function extraerCodigosDesdeItems(items: ItemTextoPdf[]): MapaCodigos {
  const resultado: MapaCodigos = {};
  for (const fila of agruparEnFilas(items)) {
    const tokens = fila.flatMap(tokenizar);
    const indicesCodigo = tokens
      .map((t, i) => (pareceCodigo(t.texto) ? i : -1))
      .filter((i) => i >= 0);

    const textoFila = sinTildes(tokens.map((t) => t.texto).join(" "));

    indicesCodigo.forEach((indice, orden) => {
      const codigo = tokens[indice].texto;
      const fin = indicesCodigo[orden + 1] ?? tokens.length;
      const candidatos = tokens.slice(indice + 1, fin).filter((t) => esValorNumerico(t.texto));
      const elegido = candidatos.length ? candidatos[candidatos.length - 1] : null;

      const definicion = definicionDeCodigo(codigo);
      const tipo: F29ValueType = definicion?.valueType ?? "money";
      const ancla =
        definicion?.anchors.find((a) => textoFila.includes(sinTildes(a))) ?? null;

      // Sin definición conocida y sin valor no se inventa una entrada.
      if (!elegido && !definicion) return;

      const normalizado = elegido ? normalizarValor(elegido.texto, tipo) : null;
      // Un código con texto no numérico a su derecha no aporta evidencia.
      if (elegido && normalizado == null) return;

      const previo = resultado[codigo];
      const confianza = elegido ? (ancla ? 0.95 : 0.9) : 0.4;
      if (previo && previo.confidence >= confianza && previo.normalized_value != null) return;

      resultado[codigo] = {
        code: codigo,
        raw_value: elegido ? elegido.texto : null,
        normalized_value: normalizado,
        value_type: tipo,
        page: tokens[indice].pagina,
        extraction_method: ancla && elegido ? "anchor" : "positional",
        confidence: confianza,
        anchor: ancla,
        coordinates: elegido
          ? { x: elegido.x, y: elegido.y, width: elegido.ancho, height: elegido.alto }
          : { x: tokens[indice].x, y: tokens[indice].y, width: tokens[indice].ancho, height: tokens[indice].alto },
      };
    });
  }
  return resultado;
}

/**
 * Respaldo lineal: solo se aplica a códigos conocidos que la vía posicional no
 * resolvió. Nunca reemplaza un valor obtenido por posición.
 */
export function extraerCodigosDesdeTexto(
  texto: string,
  yaResueltos: MapaCodigos = {},
): MapaCodigos {
  const resultado: MapaCodigos = {};
  for (const [codigo, definicion] of Object.entries(F29_CODE_REGISTRY)) {
    if (yaResueltos[codigo]?.normalized_value != null) continue;
    const patron = new RegExp(
      `(?:^|[^\\d])${codigo}(?:[^\\d\\n]{0,80}?)([+\\-(]?\\$?\\d[\\d.,]*\\)?%?)`,
      "m",
    );
    const encontrado = patron.exec(texto);
    if (!encontrado) continue;
    const valor = normalizarValor(encontrado[1], definicion.valueType);
    if (valor == null) continue;
    resultado[codigo] = {
      code: codigo,
      raw_value: encontrado[1],
      normalized_value: valor,
      value_type: definicion.valueType,
      page: null,
      extraction_method: "linear",
      confidence: 0.5,
      anchor: null,
      coordinates: null,
    };
  }
  return resultado;
}

export function extraerCodigos(entrada: {
  items: ItemTextoPdf[];
  texto: string;
}): MapaCodigos {
  const posicional = extraerCodigosDesdeItems(entrada.items);
  const lineal = extraerCodigosDesdeTexto(entrada.texto, posicional);
  return { ...lineal, ...posicional };
}

// ------------------------------------------------------------- normalización

function valor(codigos: MapaCodigos, code: string): number | null {
  const v = codigos[code];
  return v ? v.normalized_value : null;
}

function suma(codigos: MapaCodigos, codes: string[]): number | null {
  const presentes = codes.map((c) => valor(codigos, c)).filter((v): v is number => v != null);
  return presentes.length ? presentes.reduce((a, b) => a + b, 0) : null;
}

export function construirCamposNormalizados(codigos: MapaCodigos): CamposNormalizadosF29 {
  const totalCreditos = valor(codigos, "537");
  const remanenteAnterior = valor(codigos, "504");
  const creditoDelMes =
    totalCreditos != null && remanenteAnterior != null
      ? totalCreditos - remanenteAnterior
      : suma(codigos, ["511", "520"]);

  return {
    declared_vat_debit: valor(codigos, "538"),
    declared_current_vat_credit: creditoDelMes,
    declared_previous_carryforward: remanenteAnterior,
    declared_total_vat_credits: totalCreditos,
    declared_vat_payable: valor(codigos, "89"),
    declared_new_carryforward: valor(codigos, "77"),
    declared_ppm_base: valor(codigos, "563"),
    declared_ppm_rate: valor(codigos, "115"),
    declared_ppm: valor(codigos, "62"),
    declared_subtotal: valor(codigos, "595"),
    declared_total_determined: valor(codigos, "547"),
    declared_total_payable: valor(codigos, "91"),
    declared_total_with_surcharges: valor(codigos, "94"),
    declared_withholdings: suma(codigos, ["48", "151", "153", "50", "39"]),
  };
}

// -------------------------------------------------------------- validaciones

export interface ContextoValidacion {
  rutEmpresa: string | null;
  rutDocumento: string | null;
  periodoSolicitado: string;
  periodoDocumento: string | null;
  folioListado: string | null;
  folioDocumento: string | null;
}

const TOLERANCIA = 1;

export function validarF29(
  campos: CamposNormalizadosF29,
  contexto: ContextoValidacion,
): ValidacionF29[] {
  const validaciones: ValidacionF29[] = [];

  // A. PPM
  if (campos.declared_ppm_base != null && campos.declared_ppm_rate != null) {
    const esperado = Math.round(campos.declared_ppm_base * campos.declared_ppm_rate);
    const obtenido = campos.declared_ppm;
    validaciones.push({
      id: "ppm",
      titulo: "PPM declarado",
      estado:
        obtenido == null
          ? "sin_datos"
          : Math.abs(esperado - obtenido) <= TOLERANCIA
            ? "ok"
            : "advertencia",
      detalle:
        obtenido == null
          ? "El código 62 no pudo leerse."
          : `Base ${campos.declared_ppm_base} × tasa ${campos.declared_ppm_rate} = ${esperado}.`,
      esperado,
      obtenido,
    });
  } else {
    validaciones.push({
      id: "ppm",
      titulo: "PPM declarado",
      estado: "sin_datos",
      detalle: "Faltan la base (563) o la tasa (115) para verificar el PPM.",
    });
  }

  // B. Posición de IVA
  if (campos.declared_vat_debit != null && campos.declared_total_vat_credits != null) {
    const posicion = campos.declared_vat_debit - campos.declared_total_vat_credits;
    const esperado = posicion > 0 ? posicion : -posicion;
    const obtenido = posicion > 0 ? campos.declared_vat_payable : campos.declared_new_carryforward;
    validaciones.push({
      id: "iva",
      titulo: "Posición de IVA",
      estado:
        obtenido == null
          ? "sin_datos"
          : Math.abs(esperado - obtenido) <= TOLERANCIA
            ? "ok"
            : "advertencia",
      detalle:
        posicion > 0
          ? `Débitos (538) menos créditos (537) = ${esperado}, comparado con el IVA determinado (89).`
          : `Créditos (537) mayores que débitos (538) en ${esperado}, comparado con el remanente siguiente (77).`,
      esperado,
      obtenido,
    });
  } else {
    validaciones.push({
      id: "iva",
      titulo: "Posición de IVA",
      estado: "sin_datos",
      detalle: "Faltan los totales 538 o 537.",
    });
  }

  // C. Total
  const componentes = [campos.declared_vat_payable, campos.declared_ppm].filter(
    (v): v is number => v != null,
  );
  const referencia = campos.declared_total_payable ?? campos.declared_total_determined;
  if (componentes.length && referencia != null) {
    const esperado = componentes.reduce((a, b) => a + b, 0);
    validaciones.push({
      id: "total",
      titulo: "Total declarado",
      estado: Math.abs(esperado - referencia) <= TOLERANCIA ? "ok" : "advertencia",
      detalle:
        "IVA determinado más PPM comparado con el total a pagar dentro del plazo (91).",
      esperado,
      obtenido: referencia,
    });
  } else {
    validaciones.push({
      id: "total",
      titulo: "Total declarado",
      estado: "sin_datos",
      detalle: "No hay componentes suficientes para verificar el total.",
    });
  }

  // D. Exclusión lógica
  const ivaPositivo = (campos.declared_vat_payable ?? 0) > 0;
  const remanentePositivo = (campos.declared_new_carryforward ?? 0) > 0;
  validaciones.push({
    id: "exclusion",
    titulo: "IVA determinado y remanente siguiente",
    estado: ivaPositivo && remanentePositivo ? "advertencia" : "ok",
    detalle:
      ivaPositivo && remanentePositivo
        ? "El formulario declara IVA por pagar y remanente al mismo tiempo: requiere revisión de tu contador."
        : "Sin coexistencia de IVA por pagar y remanente siguiente.",
  });

  // E. Identidad
  const normalizar = (r: string | null) => (r ?? "").replace(/[.\-\s]/g, "").toUpperCase();
  validaciones.push({
    id: "rut",
    titulo: "RUT del formulario",
    estado:
      contexto.rutDocumento == null
        ? "sin_datos"
        : normalizar(contexto.rutDocumento) === normalizar(contexto.rutEmpresa)
          ? "ok"
          : "error",
    detalle:
      contexto.rutDocumento == null
        ? "El PDF no permitió leer el RUT."
        : "Comparación entre el RUT del PDF y el de la empresa.",
  });
  validaciones.push({
    id: "periodo",
    titulo: "Periodo del formulario",
    estado:
      contexto.periodoDocumento == null
        ? "sin_datos"
        : contexto.periodoDocumento === contexto.periodoSolicitado
          ? "ok"
          : "error",
    detalle:
      contexto.periodoDocumento == null
        ? "El PDF no permitió leer el periodo."
        : `Periodo del PDF ${contexto.periodoDocumento} frente al solicitado ${contexto.periodoSolicitado}.`,
  });
  validaciones.push({
    id: "folio",
    titulo: "Folio del formulario",
    estado:
      contexto.folioDocumento == null || contexto.folioListado == null
        ? "sin_datos"
        : contexto.folioDocumento === contexto.folioListado
          ? "ok"
          : "error",
    detalle: "Comparación entre el folio del listado y el folio impreso en el PDF.",
  });

  return validaciones;
}

// ------------------------------------------------------------------ confianza

export type EstadoExtraccion =
  | "pending"
  | "success"
  | "partial"
  | "failed"
  | "needs_review"
  | "ambiguous_declaration";

export type NivelConfianza = "high" | "medium" | "low" | "unknown";

export function evaluarExtraccion(entrada: {
  codigos: MapaCodigos;
  campos: CamposNormalizadosF29;
  validaciones: ValidacionF29[];
}): { estado: EstadoExtraccion; confianza: NivelConfianza; advertencias: string[] } {
  const advertencias: string[] = [];
  const faltantes = CODIGOS_CRITICOS.filter(
    (c) => entrada.codigos[c]?.normalized_value == null,
  );
  if (faltantes.length)
    advertencias.push(`No se pudieron leer los códigos ${faltantes.join(", ")}.`);

  const errores = entrada.validaciones.filter((v) => v.estado === "error");
  if (errores.length) {
    for (const e of errores) advertencias.push(`${e.titulo}: no coincide.`);
    return { estado: "failed", confianza: "low", advertencias };
  }

  const desviaciones = entrada.validaciones.filter((v) => v.estado === "advertencia");
  for (const d of desviaciones) advertencias.push(`${d.titulo}: las cifras no cuadran exactamente.`);

  const totalPresente = entrada.campos.declared_total_payable != null;
  const identidadOk = entrada.validaciones
    .filter((v) => v.id === "rut" || v.id === "periodo")
    .every((v) => v.estado === "ok");
  const cuadran = entrada.validaciones
    .filter((v) => v.id === "ppm" || v.id === "iva" || v.id === "total")
    .every((v) => v.estado === "ok");

  if (!totalPresente || faltantes.length)
    return {
      estado: "partial",
      confianza: faltantes.length && !totalPresente ? "low" : "medium",
      advertencias,
    };

  if (identidadOk && cuadran && !desviaciones.length)
    return { estado: "success", confianza: "high", advertencias };

  if (desviaciones.length)
    return { estado: "needs_review", confianza: "medium", advertencias };

  return { estado: "success", confianza: "medium", advertencias };
}

// -------------------------------------------------------------- identificación

/** Busca el RUT del contribuyente impreso en el formulario. */
export function detectarRut(texto: string): string | null {
  const encontrado = /(\d{1,2}\.?\d{3}\.?\d{3}\s*-\s*[\dkK])/.exec(texto);
  return encontrado ? encontrado[1].replace(/\s/g, "") : null;
}

const MESES: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

/**
 * Busca el periodo tributario declarado (AAAA-MM).
 *
 * Se prioriza siempre el texto rotulado como «periodo»: en el formulario
 * conviven fechas de presentación (16/02/2026) que antes se confundían con el
 * periodo y provocaban un falso «otro periodo».
 */
export function detectarPeriodo(texto: string): string | null {
  const plano = sinTildes(texto);
  const nombresMes = Object.keys(MESES).join("|");

  const rotulado: [RegExp, (m: RegExpExecArray) => string][] = [
    [/periodo\s*(?:tributario)?\s*:?\s*(20\d{2})\s*[-/]?\s*(0[1-9]|1[0-2])(?!\d)/, (m) => `${m[1]}-${m[2]}`],
    [/periodo\s*(?:tributario)?\s*:?\s*(0[1-9]|1[0-2])\s*[-/]\s*(20\d{2})/, (m) => `${m[2]}-${m[1]}`],
    [
      new RegExp(`periodo\\s*(?:tributario)?\\s*:?\\s*(${nombresMes})\\s*(?:de\\s*)?(20\\d{2})`),
      (m) => `${m[2]}-${MESES[m[1]]}`,
    ],
  ];
  for (const [patron, arma] of rotulado) {
    const m = patron.exec(plano);
    if (m) return arma(m);
  }

  const conMes = new RegExp(`(${nombresMes})\\s*(?:de\\s*)?(20\\d{2})`).exec(plano);
  if (conMes) return `${conMes[2]}-${MESES[conMes[1]]}`;

  // Sin rótulo: se aceptan AAAA-MM o MM/AAAA solo si no forman parte de una
  // fecha completa (dd/mm/aaaa o aaaa-mm-dd), que corresponde a otra cosa.
  const iso = /(?<![\d/-])(20\d{2})\s*[-/]\s*(0[1-9]|1[0-2])(?![\d/-])/.exec(plano);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const mesAnio = /(?<![\d/-])(0[1-9]|1[0-2])\s*[-/]\s*(20\d{2})(?![\d/-])/.exec(plano);
  if (mesAnio) return `${mesAnio[2]}-${mesAnio[1]}`;
  return null;
}


/** Busca el folio impreso en el formulario. */
export function detectarFolio(texto: string): string | null {
  const plano = sinTildes(texto);
  const encontrado = /folio\s*(?:n[°º]?)?\s*:?\s*(\d{6,15})/.exec(plano);
  return encontrado ? encontrado[1] : null;
}
