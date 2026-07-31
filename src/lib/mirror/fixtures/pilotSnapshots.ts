/**
 * Fixtures sanitizados de las empresas piloto (Etapa 6.8.2).
 *
 * Contienen únicamente alias técnicos, periodos, montos tributarios,
 * estados y fuentes abstractas. No incluyen RUT, razón social, folios
 * completos, documentos ni glosas comerciales.
 *
 * Regeneración: ver `docs/etapa-6.8.2-validacion-piloto.md`.
 */
import { PILOT_BAKERY_COMPANY, PILOT_WOOD_COMPANY, type AliasPiloto } from "../pilot";

export interface FixturePeriodoPiloto {
  companyAlias: AliasPiloto;
  period: string;
  /** Cifras visibles esperadas, verificadas contra los antecedentes guardados. */
  expected: {
    estimatedVatPayable?: number;
    estimatedPpm?: number;
    declaredTaxTotal?: number;
    estimatedNewCarryforward?: number;
    vatAdvanceApplied?: number;
  };
  /** Códigos oficiales del F29, cuando el periodo los tiene guardados. */
  officialCodes?: Record<string, number>;
  hasOfficialF29: boolean;
  periodState: string;
  notes?: string;
}

/** Periodos mínimos exigidos para la empresa de explotación de madera. */
export const PERIODOS_PILOT_WOOD = [
  "2025-12",
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
];

/** Periodos mínimos exigidos para la empresa de panadería. */
export const PERIODOS_PILOT_BAKERY = [
  "2025-06",
  "2025-07",
  "2025-08",
  "2025-09",
  "2025-10",
  "2025-11",
  "2025-12",
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
];

export const FIXTURES_PILOT_WOOD: FixturePeriodoPiloto[] = [
  {
    companyAlias: PILOT_WOOD_COMPANY,
    period: "2026-01",
    expected: { estimatedVatPayable: 574_605, estimatedPpm: 42_870, declaredTaxTotal: 617_475 },
    hasOfficialF29: true,
    periodState: "closed",
  },
  {
    companyAlias: PILOT_WOOD_COMPANY,
    period: "2026-02",
    expected: { declaredTaxTotal: 0, estimatedNewCarryforward: 209_180 },
    hasOfficialF29: true,
    periodState: "closed",
    notes: "Total a pagar cero con dinero a favor visible.",
  },
  {
    companyAlias: PILOT_WOOD_COMPANY,
    period: "2026-04",
    expected: { declaredTaxTotal: 863_997 },
    hasOfficialF29: true,
    periodState: "closed",
  },
  {
    companyAlias: PILOT_WOOD_COMPANY,
    period: "2026-05",
    expected: { declaredTaxTotal: 2_013_931 },
    hasOfficialF29: true,
    periodState: "closed",
    notes: "Ruta del contador procesada por el núcleo unificado.",
  },
  {
    companyAlias: PILOT_WOOD_COMPANY,
    period: "2026-06",
    expected: {
      estimatedVatPayable: 975_229,
      estimatedPpm: 150_500,
      declaredTaxTotal: 1_125_729,
    },
    hasOfficialF29: true,
    periodState: "closed",
  },
  {
    companyAlias: PILOT_WOOD_COMPANY,
    period: "2026-07",
    expected: {},
    hasOfficialF29: false,
    periodState: "pending_review",
    notes: "Periodo en curso: conserva carácter estimado; no se inventa F29.",
  },
];

export const FIXTURES_PILOT_BAKERY: FixturePeriodoPiloto[] = [
  {
    companyAlias: PILOT_BAKERY_COMPANY,
    period: "2026-06",
    expected: { vatAdvanceApplied: 557_309, declaredTaxTotal: 748_454 },
    officialCodes: {
      "538": 2_890_086,
      "537": 1_599_611,
      "504": 15_046,
      "89": 1_290_475,
      "62": 15_288,
      "91": 748_454,
    },
    hasOfficialF29: true,
    periodState: "closed",
    notes: "Anticipo de IVA como componente independiente del núcleo.",
  },
];

export const FIXTURES_PILOTO: FixturePeriodoPiloto[] = [
  ...FIXTURES_PILOT_WOOD,
  ...FIXTURES_PILOT_BAKERY,
];
