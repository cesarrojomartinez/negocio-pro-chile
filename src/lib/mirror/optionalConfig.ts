/**
 * Configuración tributaria opcional declarada por la empresa (Cierre Fase 6).
 *
 * Nada aquí es obligatorio: sin configuración el núcleo se comporta
 * exactamente igual que antes. Cada dato declarado:
 *  - tiene vigencia desde (y opcionalmente hasta),
 *  - queda registrado con su origen (`client_declared`) y su confirmación,
 *  - se guarda como versión nueva; la anterior queda `superseded`.
 *
 * Una configuración declarada nunca inventa un monto: solo entrega un
 * antecedente que el núcleo usa cuando el F29 no lo informa.
 *
 * Módulo puro: sin red, sin reloj, sin base de datos.
 */

export const OPTIONAL_TAX_CONFIG_VERSION = "optional-tax-config-1.0.0";

export const CONCEPTOS_OPCIONALES = [
  "ppm_rate",
  "sales_type",
  "common_use_vat",
  "withholdings_estimate",
  "vat_advance_regime",
  "vat_postponement",
  "confirmed_carryforward",
] as const;

export type ConceptoOpcional = (typeof CONCEPTOS_OPCIONALES)[number];

export type EstadoConfiguracion =
  | "active"
  | "expired"
  | "superseded"
  | "pending_confirmation"
  | "revoked";

export interface RegistroConfiguracionOpcional {
  id?: string;
  concept: ConceptoOpcional;
  /** Valor numérico (tasa, proporción o monto). */
  value: number | null;
  /** Valor textual (por ejemplo, tipo de ventas). */
  valueText: string | null;
  unit: "fraction" | "clp" | "text" | "boolean" | "none";
  validFrom: string;
  validTo: string | null;
  source: string;
  status: EstadoConfiguracion;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  notes?: string | null;
}

/** Antecedentes declarados vigentes para un periodo concreto. */
export interface ConfiguracionTributariaOpcional {
  version: string;
  period: string;
  ppmRate: number | null;
  salesType: "afecto" | "exento" | "mixto" | null;
  commonUseRecoveryRatio: number | null;
  withholdingsEstimate: number | null;
  vatAdvanceRegime: boolean | null;
  vatPostponement: boolean | null;
  confirmedCarryforward: number | null;
  /** Conceptos declarados que aplican al periodo, para trazabilidad. */
  appliedConcepts: ConceptoOpcional[];
}

export const CONFIGURACION_OPCIONAL_VACIA: ConfiguracionTributariaOpcional = {
  version: OPTIONAL_TAX_CONFIG_VERSION,
  period: "",
  ppmRate: null,
  salesType: null,
  commonUseRecoveryRatio: null,
  withholdingsEstimate: null,
  vatAdvanceRegime: null,
  vatPostponement: null,
  confirmedCarryforward: null,
  appliedConcepts: [],
};

export interface ErrorValidacionConfiguracion {
  concept: ConceptoOpcional;
  code: string;
  message: string;
}

const RANGOS: Partial<Record<ConceptoOpcional, { min: number; max: number }>> = {
  ppm_rate: { min: 0, max: 0.5 },
  common_use_vat: { min: 0, max: 1 },
  withholdings_estimate: { min: 0, max: 1_000_000_000 },
  confirmed_carryforward: { min: 0, max: 100_000_000_000 },
};

const TIPOS_VENTA = new Set(["afecto", "exento", "mixto"]);

/** Valida un dato declarado. Un valor fuera de rango se rechaza, no se corrige. */
export function validarRegistroOpcional(
  registro: RegistroConfiguracionOpcional,
): ErrorValidacionConfiguracion[] {
  const errores: ErrorValidacionConfiguracion[] = [];
  const { concept } = registro;

  if (!/^\d{4}-\d{2}$/.test(registro.validFrom.slice(0, 7))) {
    errores.push({
      concept,
      code: "vigencia_invalida",
      message: "La vigencia desde debe indicar un mes válido.",
    });
  }
  if (registro.validTo && registro.validTo < registro.validFrom) {
    errores.push({
      concept,
      code: "vigencia_invertida",
      message: "La vigencia hasta no puede ser anterior a la vigencia desde.",
    });
  }

  const rango = RANGOS[concept];
  if (rango) {
    if (registro.value == null || Number.isNaN(registro.value)) {
      errores.push({
        concept,
        code: "valor_requerido",
        message: "Este dato necesita un valor numérico.",
      });
    } else if (registro.value < rango.min || registro.value > rango.max) {
      errores.push({
        concept,
        code: "fuera_de_rango",
        message: `El valor debe estar entre ${rango.min} y ${rango.max}.`,
      });
    }
  }

  if (concept === "sales_type" && !TIPOS_VENTA.has(registro.valueText ?? "")) {
    errores.push({
      concept,
      code: "tipo_venta_invalido",
      message: "El tipo de ventas debe ser afecto, exento o mixto.",
    });
  }

  if (
    (concept === "vat_advance_regime" || concept === "vat_postponement") &&
    registro.valueText !== "si" &&
    registro.valueText !== "no"
  ) {
    errores.push({
      concept,
      code: "respuesta_invalida",
      message: "Responde sí o no.",
    });
  }

  return errores;
}

function vigente(registro: RegistroConfiguracionOpcional, period: string): boolean {
  if (registro.status !== "active") return false;
  const desde = registro.validFrom.slice(0, 7);
  const hasta = registro.validTo ? registro.validTo.slice(0, 7) : null;
  if (period < desde) return false;
  if (hasta && period > hasta) return false;
  return true;
}

/**
 * Resuelve los antecedentes declarados vigentes para el periodo.
 * Ante dos registros vigentes del mismo concepto gana el de vigencia más
 * reciente; nunca se mezclan valores de distintas vigencias.
 */
export function resolverConfiguracionOpcional(
  registros: RegistroConfiguracionOpcional[],
  period: string,
): ConfiguracionTributariaOpcional {
  const porConcepto = new Map<ConceptoOpcional, RegistroConfiguracionOpcional>();
  for (const registro of registros) {
    if (!vigente(registro, period)) continue;
    const actual = porConcepto.get(registro.concept);
    if (!actual || registro.validFrom > actual.validFrom) {
      porConcepto.set(registro.concept, registro);
    }
  }

  const leerNumero = (concepto: ConceptoOpcional): number | null => {
    const v = porConcepto.get(concepto)?.value;
    return v == null || Number.isNaN(v) ? null : v;
  };
  const leerBooleano = (concepto: ConceptoOpcional): boolean | null => {
    const t = porConcepto.get(concepto)?.valueText;
    if (t === "si") return true;
    if (t === "no") return false;
    return null;
  };

  const tipoVentas = porConcepto.get("sales_type")?.valueText ?? null;

  return {
    version: OPTIONAL_TAX_CONFIG_VERSION,
    period,
    ppmRate: leerNumero("ppm_rate"),
    salesType: TIPOS_VENTA.has(tipoVentas ?? "")
      ? (tipoVentas as "afecto" | "exento" | "mixto")
      : null,
    commonUseRecoveryRatio: leerNumero("common_use_vat"),
    withholdingsEstimate: leerNumero("withholdings_estimate"),
    vatAdvanceRegime: leerBooleano("vat_advance_regime"),
    vatPostponement: leerBooleano("vat_postponement"),
    confirmedCarryforward: leerNumero("confirmed_carryforward"),
    appliedConcepts: [...porConcepto.keys()].sort(),
  };
}

/** ¿La configuración aporta algún antecedente? Si no, el núcleo no cambia. */
export function configuracionAporta(
  config: ConfiguracionTributariaOpcional | null | undefined,
): boolean {
  return !!config && config.appliedConcepts.length > 0;
}
