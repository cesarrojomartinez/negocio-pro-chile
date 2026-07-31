/**
 * Empresas piloto y fotografías de paridad sanitizadas (Etapa 6.8.2).
 *
 * Los identificadores productivos (RUT, razón social, folios, nombres de
 * terceros) nunca entran aquí: el módulo trabaja exclusivamente con alias
 * técnicos y valores agregados ya calculados.
 *
 * Módulo puro: sin red, sin base de datos, sin proveedor.
 */
import { hashOrigen } from "./normalize";
import { COMPATIBILITY_PROJECTION_VERSION } from "./legacyProjection";
import { UNIFIED_ENGINE_VERSION } from "./unifiedTaxEngine";
import { MIRROR_ENGINE_VERSION } from "./types";
import type { ProductiveTaxSummary } from "./productiveSummary";

export const PARITY_SNAPSHOT_VERSION = "parity-snapshot-1.0.0";

/** Alias técnicos. Ningún nombre real puede aparecer en el repositorio. */
export const PILOT_WOOD_COMPANY = "pilot_wood_company" as const;
export const PILOT_BAKERY_COMPANY = "pilot_bakery_company" as const;

export const ALIAS_PILOTO = [PILOT_WOOD_COMPANY, PILOT_BAKERY_COMPANY] as const;
export type AliasPiloto = (typeof ALIAS_PILOTO)[number];

export function esAliasPiloto(valor: string): valor is AliasPiloto {
  return (ALIAS_PILOTO as readonly string[]).includes(valor);
}

/** Referencia sanitizada de un folio u otro identificador externo. */
export function referenciaSanitizada(valor: string | number | null | undefined): string | null {
  if (valor == null || `${valor}`.trim() === "") return null;
  return `ref_${hashOrigen({ v: `${valor}` }).slice(0, 16)}`;
}

export interface SnapshotParidadProductiva {
  snapshotVersion: string;
  companyAlias: AliasPiloto;
  period: string;
  calculationInputHash: string;
  engineVersion: string;
  rulesVersion: string;
  projectionVersion: string;
  /** Cifras visibles en pantalla, ya redondeadas. */
  visibleValues: Record<string, number | null>;
  /** Fuentes visibles, sin payloads ni documentos. */
  visibleSources: Record<string, string>;
  /** Estados visibles del periodo. */
  visibleStates: Record<string, string | boolean>;
  /** Etiquetas principales mostradas en las tarjetas. */
  mainLabels: string[];
  hasOfficialF29: boolean;
  officialReferenceHash: string | null;
  periodState: string;
  providerCalled: false;
  creditsUsed: 0;
}

export interface EntradaSnapshotParidad {
  companyAlias: AliasPiloto;
  period: string;
  calculationInputHash: string;
  productive: ProductiveTaxSummary;
  mainLabels?: string[];
  hasOfficialF29?: boolean;
  officialFolio?: string | number | null;
  declarationPresented?: boolean;
  paymentSituation?: string;
  incompletenessMessage?: string | null;
  periodSource?: string;
  rulesVersion?: string;
  engineVersion?: string;
  projectionVersion?: string;
}

/**
 * Captura la fotografía sanitizada de un periodo piloto. Nunca consulta al
 * proveedor: solo describe lo ya calculado.
 */
export function crearSnapshotParidadProductiva(
  entrada: EntradaSnapshotParidad,
): SnapshotParidadProductiva {
  const p = entrada.productive;
  return {
    snapshotVersion: PARITY_SNAPSHOT_VERSION,
    companyAlias: entrada.companyAlias,
    period: entrada.period,
    calculationInputHash: entrada.calculationInputHash,
    engineVersion: entrada.engineVersion ?? UNIFIED_ENGINE_VERSION,
    rulesVersion: entrada.rulesVersion ?? MIRROR_ENGINE_VERSION,
    projectionVersion: entrada.projectionVersion ?? COMPATIBILITY_PROJECTION_VERSION,
    visibleValues: {
      salesTotal: p.salesTotal,
      exemptSales: p.exemptSales,
      purchasesTotal: p.purchasesTotal,
      vatDebit: p.vatDebit,
      vatCredit: p.vatCredit,
      previousVatCarryforward: p.previousVatCarryforward,
      estimatedVatPayable: p.estimatedVatPayable,
      estimatedNewCarryforward: p.estimatedNewCarryforward,
      ppmTaxBase: p.ppmTaxBase,
      ppmRate: p.ppmRate,
      estimatedPpm: p.estimatedPpm,
      estimatedWithholdings: p.estimatedWithholdings,
      vatAdvanceApplied: p.vatAdvanceApplied,
      estimatedTaxTotal: p.estimatedTaxTotal,
      declaredTaxTotal: p.declaredTaxTotal,
      preventiveMarginPercent: p.preventiveMarginPercent,
      preventiveMarginAmount: p.preventiveMarginAmount,
      recommendedReserve: p.recommendedReserve,
      reservedAmount: p.reservedAmount,
    },
    visibleSources: {
      carryforwardSource: p.carryforwardSource,
      ppmSource: p.ppmSource,
      withholdingsSource: p.withholdingsSource,
      periodSource: entrada.periodSource ?? "stored",
    },
    visibleStates: {
      periodState: p.periodState,
      declarationPresented: entrada.declarationPresented ?? false,
      paymentSituation: entrada.paymentSituation ?? "not_applicable",
      incompletenessMessage: entrada.incompletenessMessage ?? "",
    },
    mainLabels: [...(entrada.mainLabels ?? [])],
    hasOfficialF29: entrada.hasOfficialF29 ?? p.declaredTaxTotal != null,
    officialReferenceHash: referenciaSanitizada(entrada.officialFolio ?? null),
    periodState: p.periodState,
    providerCalled: false,
    // TAX_ZERO_JUSTIFIED: contador de créditos, no es un monto tributario.
    creditsUsed: 0,
  };
}

/** Claves y patrones que jamás pueden viajar en un snapshot versionado. */
const CLAVES_PROHIBIDAS = [
  "rut",
  "razonsocial",
  "razon_social",
  "nombre",
  "name",
  "folio",
  "pdf",
  "clave",
  "password",
  "token",
  "cliente",
  "proveedor",
  "glosa",
  "documento",
  "payload",
  "companyid",
  "company_id",
];

const PATRON_RUT = /\b\d{1,3}(?:\.\d{3}){1,3}-[\dkK]\b|\b\d{7,8}-[\dkK]\b/;
const PATRON_UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

export interface RevisionSanitizacion {
  ok: boolean;
  hallazgos: string[];
}

/** Verifica que un snapshot no contenga datos sensibles ni identificadores reales. */
export function revisarSanitizacionSnapshot(
  snapshot: SnapshotParidadProductiva,
): RevisionSanitizacion {
  const hallazgos: string[] = [];
  if (!esAliasPiloto(snapshot.companyAlias)) {
    hallazgos.push("alias_no_reconocido");
  }
  if (snapshot.providerCalled !== false) hallazgos.push("provider_called_true");
  if (snapshot.creditsUsed !== 0) hallazgos.push("credits_used_distinto_de_cero");

  const recorrer = (valor: unknown, ruta: string): void => {
    if (valor == null) return;
    if (typeof valor === "string") {
      if (PATRON_RUT.test(valor)) hallazgos.push(`rut_en:${ruta}`);
      if (PATRON_UUID.test(valor)) hallazgos.push(`uuid_en:${ruta}`);
      return;
    }
    if (Array.isArray(valor)) {
      valor.forEach((v, i) => recorrer(v, `${ruta}[${i}]`));
      return;
    }
    if (typeof valor === "object") {
      for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
        const normalizada = clave.toLowerCase();
        if (CLAVES_PROHIBIDAS.some((c) => normalizada === c)) {
          hallazgos.push(`clave_prohibida:${ruta}.${clave}`);
        }
        recorrer(v, `${ruta}.${clave}`);
      }
    }
  };

  recorrer(snapshot.visibleValues, "visibleValues");
  recorrer(snapshot.visibleSources, "visibleSources");
  recorrer(snapshot.visibleStates, "visibleStates");
  recorrer(snapshot.mainLabels, "mainLabels");
  recorrer(snapshot.officialReferenceHash, "officialReferenceHash");

  return { ok: hallazgos.length === 0, hallazgos };
}
