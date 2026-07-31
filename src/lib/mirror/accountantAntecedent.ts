/**
 * Antecedentes confirmados por el contador expresados en códigos del F29.
 *
 * Un antecedente confirmado (`tax_f29_history.source = 'accountant'`) guarda
 * las cifras en columnas propias y no siempre trae `raw_data.codigos`. Sin
 * esta traducción el núcleo unificado no recibe ningún antecedente oficial y
 * devuelve `null` en IVA determinado, PPM, remanente y retenciones.
 *
 * Aquí solo se traduce lo que el contador efectivamente declaró: un campo
 * ausente no genera código, jamás un cero.
 *
 * Módulo puro: sin red, sin reloj, sin base de datos.
 */
import { CODIGO } from "./officialContext";

export interface AntecedenteContador {
  declaredVat?: number | null;
  declaredPpm?: number | null;
  declaredWithholdings?: number | null;
  declaredTotal?: number | null;
  /** Remanente que el contador declara como anterior (código 504). */
  vatCarryforward?: number | null;
  rawData?: Record<string, unknown> | null;
}

function num(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

function poner(
  destino: Record<string, number>,
  codigo: string,
  valor: number | null,
): void {
  if (valor == null) return;
  destino[codigo] = valor;
}

/**
 * Traduce un antecedente confirmado a códigos del F29. Los códigos que el
 * propio antecedente ya traía en `raw_data.codigos` mandan sobre los
 * derivados: son la transcripción literal del formulario.
 */
export function codigosDesdeAntecedenteContador(
  fila: AntecedenteContador | null | undefined,
): Record<string, number> | null {
  if (!fila) return null;
  const raw = (fila.rawData ?? {}) as Record<string, unknown>;
  const derivados: Record<string, number> = {};

  poner(derivados, CODIGO.ivaDeterminado, num(fila.declaredVat));
  poner(derivados, CODIGO.ppm, num(fila.declaredPpm));
  poner(derivados, CODIGO.retenciones, num(fila.declaredWithholdings));
  poner(derivados, CODIGO.subtotalDeterminado, num(fila.declaredTotal));
  poner(derivados, CODIGO.totalAPagar, num(fila.declaredTotal));

  // El remanente anterior puede venir en la columna o en el detalle.
  poner(
    derivados,
    CODIGO.remanenteAnterior,
    num(raw["previous_vat_carryforward"]) ?? num(fila.vatCarryforward),
  );
  poner(
    derivados,
    CODIGO.remanenteSiguiente,
    num(raw["new_vat_carryforward"]) ?? num(raw["new_carryforward"]),
  );

  // El crédito declarado por el contador es el crédito de documentos del mes
  // (código 511); el remanente anterior viaja por separado en el 504.
  poner(derivados, CODIGO.creditoDocumentos, num(raw["vat_credit"]));
  poner(derivados, CODIGO.debitoTotal, num(raw["vat_debit"]));
  poner(derivados, CODIGO.basePpm, num(raw["ppm_tax_base"]));
  poner(derivados, CODIGO.tasaPpm, num(raw["ppm_rate"]));

  const literales = (raw["codigos"] ?? null) as Record<string, unknown> | null;
  if (literales) {
    for (const [k, v] of Object.entries(literales)) {
      const n = num(v);
      if (n != null) derivados[String(k)] = n;
    }
  }

  return Object.keys(derivados).length > 0 ? derivados : null;
}
