/**
 * Casos dorados del Motor Espejo.
 *
 * Cada caso proviene de un F29 real disponible en la base, anonimizado: solo
 * se conservan alias de empresa, periodo, folio y códigos del formulario.
 * Ningún identificador productivo entra al código del motor.
 *
 * Un valor ausente en `expectedComponents` es `null` a propósito: nunca se
 * completa con cero para que un fixture "cuadre".
 */
import type { GoldenTaxCase } from "../types";

function caso(
  companyAlias: string,
  period: string,
  f29Folio: string | null,
  codes: Record<string, number>,
  expected: GoldenTaxCase["expectedComponents"],
  notes: string,
  opciones: Partial<
    Pick<GoldenTaxCase, "extractionStatus" | "declarationStatus" | "source">
  > = {},
): GoldenTaxCase {
  return {
    caseId: `${companyAlias}-${period}`,
    companyAlias,
    period,
    rawSnapshotReference: `snapshot:${companyAlias}:${period}`,
    rcvSummaryReference: `rcv_summary:${companyAlias}:${period}`,
    f29ExtractionReference: f29Folio ? `f29_extraction:${companyAlias}:${period}` : null,
    f29Folio,
    extractionStatus: opciones.extractionStatus ?? "valid",
    codes,
    declarationStatus: opciones.declarationStatus ?? "filed",
    source: opciones.source ?? "f29_pdf_extracted",
    expectedComponents: {
      declarationStatus: opciones.declarationStatus ?? "filed",
      // Presentado no es pagado: sin evidencia independiente el pago es desconocido.
      paymentStatus: "unknown",
      ...expected,
    },
    toleranceByComponent: { ppmRate: 0.0001 },
    notes,
  };
}

/* ─────────── Alias "panaderia": microempresa afecta a cambio de sujeto ─────────── */

export const CASOS_PANADERIA: GoldenTaxCase[] = [
  caso(
    "panaderia",
    "2025-06",
    "8325251146",
    {
      "111": 603298, "115": 0.03, "12": 0, "151": 114686, "50": 4, "504": 368738,
      "511": 1513628, "515": 1, "520": 1567526, "527": 7, "528": 53898, "537": 1882366,
      "538": 1529475, "543": 1039277, "544": 0, "547": 358843, "556": 174293, "557": 864984,
      "563": 8138580, "573": 1039277, "587": 88965, "595": 358843, "62": 244157, "758": 1235,
      "759": 926177, "77": 352891, "779": 6, "89": 0, "91": 358843,
    },
    {
      vatDebit: 1529475, recoverableVatCredit: 1513628, vatNonRecoverable: 53898,
      previousCarryforward: 368738, nextCarryforward: 352891, vatDetermined: 0,
      ppmBase: 8138580, ppmRate: 0.03, ppm: 244157, withholdings: 114686,
      vatAdvance: null, surcharges: 0, officialSubtotal: 358843,
      officialTotalDetermined: 358843, code91: 358843,
    },
    "Periodo con remanente y anticipo disponible sin imputar (no hay código 598).",
  ),
  caso(
    "panaderia",
    "2025-07",
    "8396210976",
    {
      "111": 515884, "115": 0.03, "12": 0, "151": 114686, "39": 3453, "50": 4, "504": 351473,
      "511": 2035183, "515": 1, "520": 2129036, "527": 9, "528": 93853, "537": 2386656,
      "538": 1750064, "543": 1166950, "544": 0, "547": 393453, "556": 131753, "557": 1035197,
      "563": 9292229, "573": 1166950, "587": 81412, "595": 393453, "62": 278767, "758": 1729,
      "759": 1234180, "77": 636592, "779": 6, "89": 0, "91": 393453,
    },
    {
      vatDebit: 1750064, recoverableVatCredit: 2035183, vatNonRecoverable: 93853,
      previousCarryforward: 351473, nextCarryforward: 636592, vatDetermined: 0,
      ppmBase: 9292229, ppmRate: 0.03, ppm: 278767, withholdings: 114686,
      vatAdvance: null, surcharges: 0, officialSubtotal: 393453,
      officialTotalDetermined: 393453, code91: 393453,
    },
    "Crédito mayor que el débito: el periodo no genera IVA a pagar.",
  ),
  caso(
    "panaderia",
    "2025-08",
    "8458763416",
    {
      "111": 534510, "115": 0.03, "12": 0, "151": 114686, "48": 4105, "50": 4, "504": 642087,
      "511": 1842018, "515": 1, "520": 1874034, "527": 7, "528": 32016, "537": 2484105,
      "538": 1797094, "543": 1372926, "544": 0, "547": 400968, "556": 195421, "557": 1177505,
      "563": 9542721, "573": 1372926, "587": 84553, "595": 400968, "62": 286282, "64": 2087,
      "758": 1831, "759": 1262584, "77": 687011, "779": 6, "89": 0, "91": 400968,
    },
    {
      vatDebit: 1797094, recoverableVatCredit: 1842018, vatNonRecoverable: 32016,
      previousCarryforward: 642087, nextCarryforward: 687011, vatDetermined: 0,
      ppmBase: 9542721, ppmRate: 0.03, ppm: 286282, withholdings: 114686,
      vatAdvance: null, surcharges: 0, officialSubtotal: 400968,
      officialTotalDetermined: 400968, code91: 400968,
    },
    "Remanente encadenado desde el periodo anterior.",
  ),
  caso(
    "panaderia",
    "2025-09",
    "8528119706",
    {
      "111": 467097, "115": 0.01, "12": 0, "151": 5936, "48": 5104, "50": 4, "504": 687109,
      "511": 1626788, "515": 1, "520": 1654970, "527": 5, "528": 28182, "537": 2313897,
      "538": 1828793, "543": 1514147, "544": 0, "547": 102963, "556": 141315, "557": 1372832,
      "563": 9702748, "573": 1514147, "587": 77662, "595": 102963, "62": 97027, "66": 2,
      "758": 1864, "759": 1361696, "77": 485104, "779": 6, "89": 0, "91": 102963,
    },
    {
      vatDebit: 1828793, recoverableVatCredit: 1626788, vatNonRecoverable: 28182,
      previousCarryforward: 687109, nextCarryforward: 485104, vatDetermined: 0,
      ppmBase: 9702748, ppmRate: 0.01, ppm: 97027, withholdings: 5936,
      vatAdvance: null, surcharges: 0, officialSubtotal: 102963,
      officialTotalDetermined: 102963, code91: 102963,
    },
    "Cambio de tasa de PPM a 1 %: la tasa no es vigente indefinidamente.",
  ),
  caso(
    "panaderia",
    "2025-10",
    "8604953706",
    {
      "111": 489771, "115": 0.03, "12": 0, "151": 5936, "153": 82, "30": 2777, "48": 9771,
      "50": 4, "504": 486794, "511": 1318742, "515": 1, "520": 1333032, "527": 2, "528": 14290,
      "537": 1805536, "538": 1901991, "543": 1673270, "544": 0, "547": 308713, "556": 153082,
      "557": 1520188, "563": 10092569, "573": 1576815, "587": 82117, "595": 405168,
      "598": 96455, "62": 302777, "758": 1966, "759": 1412220, "779": 6, "89": 96455,
      "91": 308713,
    },
    {
      vatDebit: 1901991, recoverableVatCredit: 1318742, vatNonRecoverable: 14290,
      previousCarryforward: 486794, nextCarryforward: 0, vatDetermined: 96455,
      ppmBase: 10092569, ppmRate: 0.03, ppm: 302777, withholdings: 5936,
      vatAdvance: 96455, surcharges: 0, officialSubtotal: 308713,
      officialTotalDetermined: 308713, code91: 308713,
    },
    "Primer mes con anticipo por cambio de sujeto imputado: absorbe todo el IVA determinado.",
  ),
  caso(
    "panaderia",
    "2025-11",
    "8661680276",
    {
      "111": 455963, "115": 0.03, "12": 0, "151": 5936, "511": 2152124, "515": 1,
      "520": 2167351, "527": 5, "528": 15227, "537": 2152124, "538": 1803528, "543": 1767101,
      "544": 0, "547": 293099, "556": 190584, "557": 1576517, "563": 9572085, "573": 1767101,
      "587": 79788, "595": 293099, "62": 287163, "758": 1980, "759": 1347565, "77": 348596,
      "779": 6, "89": 0, "91": 293099,
    },
    {
      vatDebit: 1803528, recoverableVatCredit: 2152124, vatNonRecoverable: 15227,
      previousCarryforward: null, nextCarryforward: 348596, vatDetermined: 0,
      ppmBase: 9572085, ppmRate: 0.03, ppm: 287163, withholdings: 5936,
      vatAdvance: null, surcharges: 0, officialSubtotal: 293099,
      officialTotalDetermined: 293099, code91: 293099,
    },
    "Sin código 504: el remanente anterior es desconocido, no cero.",
  ),
  caso(
    "panaderia",
    "2025-12",
    "8742481376",
    {
      "111": 418271, "115": 0.03, "12": 0, "151": 5936, "50": 4, "504": 349453, "511": 1627758,
      "515": 1, "520": 1652633, "527": 6, "528": 24875, "537": 1977211, "538": 1803028,
      "543": 1941558, "544": 0, "547": 292766, "556": 169185, "557": 1772373, "563": 9561010,
      "573": 1941558, "587": 71315, "595": 292766, "62": 286830, "758": 1965, "759": 1384757,
      "77": 174183, "779": 6, "89": 0, "91": 292766,
    },
    {
      vatDebit: 1803028, recoverableVatCredit: 1627758, vatNonRecoverable: 24875,
      previousCarryforward: 349453, nextCarryforward: 174183, vatDetermined: 0,
      ppmBase: 9561010, ppmRate: 0.03, ppm: 286830, withholdings: 5936,
      vatAdvance: null, surcharges: 0, officialSubtotal: 292766,
      officialTotalDetermined: 292766, code91: 292766,
    },
    "Cierre de año con remanente decreciente.",
  ),
  caso(
    "panaderia",
    "2026-01",
    "8817767036",
    {
      "111": 588366, "115": 0.03, "12": 0, "151": 6298, "48": 8109, "50": 4, "504": 174028,
      "511": 2144826, "515": 1, "520": 2198863, "527": 9, "528": 54037, "537": 2318854,
      "538": 2076475, "543": 2075441, "544": 0, "547": 336509, "556": 137471, "557": 1937970,
      "563": 11007020, "573": 2075441, "587": 78194, "595": 336509, "62": 330211, "758": 2117,
      "759": 1488109, "77": 242379, "779": 6, "89": 0, "91": 336509,
    },
    {
      vatDebit: 2076475, recoverableVatCredit: 2144826, vatNonRecoverable: 54037,
      previousCarryforward: 174028, nextCarryforward: 242379, vatDetermined: 0,
      ppmBase: 11007020, ppmRate: 0.03, ppm: 330211, withholdings: 6298,
      vatAdvance: null, surcharges: 0, officialSubtotal: 336509,
      officialTotalDetermined: 336509, code91: 336509,
    },
    "Anticipo acumulado alto sin imputación.",
  ),
  caso(
    "panaderia",
    "2026-02",
    "8882268056",
    {
      "111": 224810, "115": 0.01, "12": 0, "151": 6298, "39": 1, "50": 3, "502": 2712383,
      "503": 3, "504": 243214, "511": 2179790, "515": 1, "520": 2190939, "527": 3,
      "528": 11149, "537": 2423004, "538": 4615539, "543": 2265643, "544": 0, "547": 249924,
      "556": 182252, "557": 2083391, "563": 24362558, "573": 73108, "587": 70115,
      "595": 2442459, "598": 2192535, "62": 243626, "64": 3, "758": 2261, "759": 1678346,
      "77": 9, "779": 6, "89": 2192535, "91": 249924,
    },
    {
      vatDebit: 4615539, recoverableVatCredit: 2179790, vatNonRecoverable: 11149,
      previousCarryforward: 243214, nextCarryforward: 9, vatDetermined: 2192535,
      ppmBase: 24362558, ppmRate: 0.01, ppm: 243626, withholdings: 6298,
      vatAdvance: 2192535, surcharges: 0, officialSubtotal: 249924,
      officialTotalDetermined: 249924, code91: 249924,
    },
    "Mes atípico: el anticipo acumulado absorbe un IVA determinado de siete cifras.",
  ),
  caso(
    "panaderia",
    "2026-03",
    "8967512166",
    {
      "111": 235256, "115": 0.03, "12": 0, "151": 6298, "48": 3911, "50": 3, "502": 483911,
      "503": 1, "511": 2149591, "515": 1, "520": 2199658, "528": 50067, "537": 2149591,
      "538": 2423533, "543": 235467, "544": 0, "547": 429411, "556": 162084, "557": 73383,
      "563": 12821276, "573": 0, "587": 65849, "595": 664878, "598": 235467, "62": 384638,
      "66": 4878, "758": 2233, "759": 1704366, "77": 9, "779": 6, "89": 273942, "91": 429411,
    },
    {
      vatDebit: 2423533, recoverableVatCredit: 2149591, vatNonRecoverable: 50067,
      previousCarryforward: null, nextCarryforward: 9, vatDetermined: 273942,
      ppmBase: 12821276, ppmRate: 0.03, ppm: 384638, withholdings: 6298,
      vatAdvance: 235467, surcharges: 0, officialSubtotal: 429411,
      officialTotalDetermined: 429411, code91: 429411,
    },
    "El anticipo se agota (código 573 en cero explícito).",
  ),
  caso(
    "panaderia",
    "2026-04",
    "9029165576",
    {
      "111": 142332, "115": 0.03, "12": 0, "151": 6298, "30": 2830, "511": 1973492,
      "520": 2024828, "527": 6, "528": 51336, "537": 1973492, "538": 1670662, "543": 192052,
      "544": 0, "547": 272253, "556": 192052, "563": 8865166, "573": 192052, "595": 272253,
      "62": 265955, "66": 2, "758": 2121, "759": 1528330, "77": 302830, "779": 6, "89": 0,
      "91": 272253,
    },
    {
      vatDebit: 1670662, recoverableVatCredit: 1973492, vatNonRecoverable: 51336,
      previousCarryforward: null, nextCarryforward: 302830, vatDetermined: 0,
      ppmBase: 8865166, ppmRate: 0.03, ppm: 265955, withholdings: 6298,
      vatAdvance: null, surcharges: 0, officialSubtotal: 272253,
      officialTotalDetermined: 272253, code91: 272253,
    },
    "Anticipo del mes sin remanente anterior (no viene el código 557).",
  ),
  caso(
    "panaderia",
    "2026-05",
    "9093849706",
    {
      "111": 241964, "115": 0.02, "12": 0, "151": 6298, "30": 6761, "39": 4, "50": 3,
      "502": 713811, "503": 1, "504": 306761, "511": 2476394, "515": 1, "520": 2502664,
      "527": 6, "528": 26270, "537": 2783155, "538": 2768016, "543": 395360, "544": 0,
      "547": 299112, "556": 200864, "557": 194496, "563": 14640678, "573": 395360,
      "587": 72185, "595": 299112, "62": 292814, "64": 678, "66": 4, "758": 2245,
      "759": 1812241, "77": 15139, "779": 6, "89": 0, "91": 299112,
    },
    {
      vatDebit: 2768016, recoverableVatCredit: 2476394, vatNonRecoverable: 26270,
      previousCarryforward: 306761, nextCarryforward: 15139, vatDetermined: 0,
      ppmBase: 14640678, ppmRate: 0.02, ppm: 292814, withholdings: 6298,
      vatAdvance: null, surcharges: 0, officialSubtotal: 299112,
      officialTotalDetermined: 299112, code91: 299112,
    },
    "Tasa de PPM al 2 %: cambia mes a mes y no se hereda.",
  ),
  caso(
    "panaderia",
    "2026-06",
    "9154699596",
    {
      "111": 89284, "115": 0.1, "12": 0, "151": 6298, "39": 7, "50": 3, "502": 864215,
      "503": 1, "504": 15046, "511": 1584565, "515": 1, "520": 1990962, "528": 406397,
      "537": 1599611, "538": 2890086, "543": 563607, "544": 0, "547": 748454, "556": 167388,
      "557": 396219, "563": 15288385, "573": 0, "587": 77406, "595": 1312061, "598": 563607,
      "62": 15288, "758": 2434, "759": 1936587, "77": 406, "779": 6, "89": 1290475,
      "91": 748454,
    },
    {
      vatDebit: 2890086, recoverableVatCredit: 1584565, vatNonRecoverable: 406397,
      previousCarryforward: 15046, nextCarryforward: 406, vatDetermined: 1290475,
      ppmBase: 15288385, ppmRate: 0.1, ppm: 15288, withholdings: 6298,
      vatAdvance: 563607, surcharges: 0, officialSubtotal: 748454,
      officialTotalDetermined: 748454, code91: 748454,
    },
    "Caso crítico: el anticipo por cambio de sujeto (563.607) explica la diferencia; la tasa 115 leída (0,1) es incoherente con 563 × 115 ≠ 62.",
  ),
];

/* ─────────── Alias "jmc": empresa de servicios sin cambio de sujeto ─────────── */

export const CASOS_JMC: GoldenTaxCase[] = [
  caso(
    "jmc",
    "2026-01",
    "8801846146",
    {
      "115": 1, "537": 239925, "538": 814530, "547": 617475, "563": 4287000, "595": 617475,
      "62": 42870, "77": 0, "89": 574605, "91": 617475,
    },
    {
      vatDebit: 814530, recoverableVatCredit: null, vatNonRecoverable: null,
      previousCarryforward: null, nextCarryforward: 0, vatDetermined: 574605,
      ppmBase: 4287000, ppmRate: 1, ppm: 42870, withholdings: null,
      vatAdvance: null, surcharges: 0, officialSubtotal: 617475,
      officialTotalDetermined: 617475, code91: 617475,
    },
    "Antecedente confirmado por el contador. Sin código 511 el crédito recuperable queda desconocido (537 incluye remanente). La tasa 115 llega como 1 y queda marcada como incoherente con 563 × 115.",
    { source: "accountant", extractionStatus: "valid" },
  ),
  caso(
    "jmc",
    "2026-02",
    "8868851846",
    { "537": 209180, "77": 209180, "89": 0, "91": 0 },
    {
      vatDebit: null, recoverableVatCredit: null, vatNonRecoverable: null,
      previousCarryforward: null, nextCarryforward: 209180, vatDetermined: 0,
      ppmBase: null, ppmRate: null, ppm: null, withholdings: null,
      vatAdvance: null, surcharges: null, officialSubtotal: null,
      officialTotalDetermined: null, code91: 0,
    },
    "Extracción parcial: solo cuatro códigos. Los ausentes permanecen null y la extracción no puede promoverse a referencia oficial.",
    { extractionStatus: "partial" },
  ),
];

export const CASOS_DORADOS: GoldenTaxCase[] = [...CASOS_PANADERIA, ...CASOS_JMC];

export function casoDorado(caseId: string): GoldenTaxCase | undefined {
  return CASOS_DORADOS.find((c) => c.caseId === caseId);
}
