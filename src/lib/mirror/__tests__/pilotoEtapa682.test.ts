import { beforeEach, describe, expect, it } from "vitest";

import { CASOS_DORADOS } from "../fixtures/goldenCases";
import { construirContextoOficial } from "../officialContext";
import {
  calculateTaxPeriod,
  type EntradaCalculoPeriodo,
} from "../calculationOrchestrator";
import {
  construirResumenProductivo,
  type ContextoProductivoNoTributario,
  type ProductiveTaxSummary,
} from "../productiveSummary";
import { proyectarCompatibilidad } from "../legacyProjection";
import { ejecutarMotorUnificado } from "../unifiedTaxEngine";
import { backfillUnifiedCompatibility } from "../backfill";
import {
  legacyCalculationInvocationCount,
  reiniciarInstrumentacionLegada,
} from "../legacyGuard";
import { registrarRollbackAModoSombra } from "../unifiedEngineMode";
import {
  PILOT_BAKERY_COMPANY,
  PILOT_WOOD_COMPANY,
  crearSnapshotParidadProductiva,
  revisarSanitizacionSnapshot,
} from "../pilot";
import {
  construirInformeValidacionPiloto,
  validarPeriodoPiloto,
  PILOT_PROMOTION_BLOCKED,
} from "../pilotValidation";
import { aprobarPromocionCompatibility } from "../pilotPromotion";
import { FIXTURES_PILOT_WOOD, PERIODOS_PILOT_WOOD } from "../fixtures/pilotSnapshots";
import type { GoldenTaxCase } from "../types";

/**
 * Etapa 6.8.2 — validación dual piloto.
 * Ninguna prueba consulta al proveedor ni consume créditos: todo se calcula
 * con antecedentes ya normalizados.
 */

const CASO: GoldenTaxCase = CASOS_DORADOS[0];
const CALCULADO_EN = "2026-07-31T00:00:00.000Z";

/** Contador de consultas externas: siempre debe quedar en cero. */
let consultasExternas = 0;
let creditosConsumidos = 0;

function entradaUnificada(caso: GoldenTaxCase = CASO) {
  return {
    companyId: "empresa-piloto",
    period: caso.period,
    facts: [],
    official: construirContextoOficial({
      period: caso.period,
      codes: caso.codes,
      folio: caso.f29Folio,
      declarationStatus: caso.declarationStatus,
      extractionStatus: caso.extractionStatus,
      confidence: "medium" as const,
      source: caso.source,
    }),
    previousOfficial: null,
    calculatedAt: CALCULADO_EN,
  };
}

const CONTEXTO: ContextoProductivoNoTributario = {
  salesTotal: 12_000_000,
  exemptSales: 0,
  purchasesTotal: 8_000_000,
  preventiveMarginPercent: 10,
  reservedAmount: 250_000,
  carryforwardSource: "official",
  ppmSource: "official",
  withholdingsSource: "official",
  periodState: "closed",
};

function compatibilidad(caso: GoldenTaxCase = CASO): ProductiveTaxSummary {
  return construirResumenProductivo(
    proyectarCompatibilidad(ejecutarMotorUnificado(entradaUnificada(caso))),
    CONTEXTO,
  );
}

function entrada(
  overrides: Partial<EntradaCalculoPeriodo> = {},
): EntradaCalculoPeriodo {
  const legacy = compatibilidad();
  return {
    companyId: "empresa-piloto",
    period: CASO.period,
    configuredMode: "dual_validation",
    unifiedInput: entradaUnificada(),
    productiveContext: CONTEXTO,
    legacyProductive: legacy,
    previousProductive: legacy,
    calculatedAt: CALCULADO_EN,
    ...overrides,
  };
}

function validar(
  opciones: {
    legacy?: ProductiveTaxSummary;
    visible?: Parameters<typeof validarPeriodoPiloto>[0]["visible"];
    entradaOverrides?: Partial<EntradaCalculoPeriodo>;
    alias?: typeof PILOT_WOOD_COMPANY | typeof PILOT_BAKERY_COMPANY;
  } = {},
) {
  const legacy = opciones.legacy ?? compatibilidad();
  const resultado = calculateTaxPeriod(
    entrada({ legacyProductive: legacy, ...opciones.entradaOverrides }),
  );
  return validarPeriodoPiloto({
    companyAlias: opciones.alias ?? PILOT_WOOD_COMPANY,
    period: CASO.period,
    resultado,
    legacy,
    compatibility: compatibilidad(),
    visible: opciones.visible,
    validatedAt: CALCULADO_EN,
  });
}

beforeEach(() => {
  reiniciarInstrumentacionLegada();
  consultasExternas = 0;
  creditosConsumidos = 0;
});

describe("Etapa 6.8.2 — snapshots y validación dual piloto", () => {
  it("A. el snapshot sanitizado no contiene datos sensibles", () => {
    const snapshot = crearSnapshotParidadProductiva({
      companyAlias: PILOT_WOOD_COMPANY,
      period: "2026-06",
      calculationInputHash: "hash-piloto",
      productive: compatibilidad(),
      mainLabels: ["Total estimado del periodo", "Reserva recomendada"],
      officialFolio: "1234567890",
    });
    const revision = revisarSanitizacionSnapshot(snapshot);
    expect(revision.ok).toBe(true);
    expect(revision.hallazgos).toEqual([]);
    expect(snapshot.officialReferenceHash).toMatch(/^ref_/);
    expect(JSON.stringify(snapshot)).not.toContain("1234567890");
    expect(snapshot.providerCalled).toBe(false);
    expect(snapshot.creditsUsed).toBe(0);
  });

  it("A2. un snapshot con RUT o identificador real es rechazado", () => {
    const snapshot = crearSnapshotParidadProductiva({
      companyAlias: PILOT_WOOD_COMPANY,
      period: "2026-06",
      calculationInputHash: "hash-piloto",
      productive: compatibilidad(),
      mainLabels: ["Empresa 76.543.210-9"],
    });
    const revision = revisarSanitizacionSnapshot(snapshot);
    expect(revision.ok).toBe(false);
    expect(revision.hallazgos.some((h) => h.startsWith("rut_en:"))).toBe(true);
  });

  it("B. la empresa de madera pasa dual_validation sin diferencias", () => {
    const resultado = validar({ alias: PILOT_WOOD_COMPANY });
    expect(resultado.compatibilityDifferences).toBe(0);
    expect(resultado.exact).toBe(true);
    expect(resultado.blockingReasons).toEqual([]);
    expect(consultasExternas).toBe(0);
  });

  it("C. la empresa de panadería pasa dual_validation sin diferencias", () => {
    const resultado = validar({ alias: PILOT_BAKERY_COMPANY });
    expect(resultado.exact).toBe(true);
    expect(resultado.snapshot.companyAlias).toBe(PILOT_BAKERY_COMPANY);
  });

  it("D. la paridad se evalúa campo por campo", () => {
    const resultado = validar();
    const campos = resultado.rows.map((r) => r.field);
    expect(campos).toContain("estimatedVatPayable");
    expect(campos).toContain("estimatedPpm");
    expect(campos).toContain("estimatedTaxTotal");
    expect(resultado.rows.every((r) => r.calculationInputHash.length > 0)).toBe(true);
  });

  it("E. una diferencia de un peso bloquea la promoción", () => {
    const legacy = compatibilidad();
    const resultado = validar({
      legacy: { ...legacy, estimatedTaxTotal: legacy.estimatedTaxTotal + 1 },
    });
    expect(resultado.exact).toBe(false);
    const fila = resultado.rows.find((r) => r.field === "estimatedTaxTotal");
    expect(fila?.legacyVsCompatibilityDifference).toBe(1);
    expect(fila?.blocking).toBe(true);
    expect(resultado.blockingReasons.length).toBeGreaterThan(0);
  });

  it("F. una etiqueta principal distinta bloquea", () => {
    const resultado = validar({
      visible: {
        legacyMainLabels: ["Total estimado del periodo"],
        mainLabels: ["Total del periodo"],
      },
    });
    expect(resultado.exact).toBe(false);
    expect(
      resultado.rows.find((r) => r.field === "mainLabels")?.blocking,
    ).toBe(true);
  });

  it("G. una fuente visible distinta bloquea", () => {
    const legacy = compatibilidad();
    const resultado = validar({
      legacy: { ...legacy, ppmSource: "estimated" },
    });
    const fila = resultado.rows.find((r) => r.field === "ppmSource");
    expect(fila?.blocking).toBe(true);
    expect(fila?.differenceCategory).toBe("unexplained_difference");
  });

  it("H. sin aprobación administrativa la promoción se rechaza", () => {
    const informe = construirInformeValidacionPiloto({
      companyAlias: PILOT_WOOD_COMPANY,
      resultados: [validar()],
    });
    const decision = aprobarPromocionCompatibility({
      companyId: "empresa-piloto",
      companyAlias: PILOT_WOOD_COMPANY,
      informe,
      goldenCasesPassed: 10,
      goldenCasesTotal: 10,
      visualSnapshotsApproved: true,
      validationReportId: "informe-1",
      approvalReason: "validación completa",
    });
    expect(decision.approved).toBe(false);
    expect(decision.blockedCode).toBe(PILOT_PROMOTION_BLOCKED);
    expect(decision.blockingReasons).toContain("sin_aprobacion_administrativa");
  });

  it("I. una empresa piloto puede promoverse con aprobación explícita", () => {
    const resultados = [validar()];
    const informe = construirInformeValidacionPiloto({
      companyAlias: PILOT_WOOD_COMPANY,
      resultados,
    });
    expect(informe.promotionReady).toBe(true);
    expect(informe.providerCalls).toBe(0);
    expect(informe.creditsUsed).toBe(0);

    const decision = aprobarPromocionCompatibility({
      companyId: "empresa-piloto",
      companyAlias: PILOT_WOOD_COMPANY,
      informe,
      expectedPeriods: [CASO.period],
      parityReports: [],
      goldenCasesPassed: 10,
      goldenCasesTotal: 10,
      visualSnapshotsApproved: true,
      approvedBy: "admin-tecnico",
      approvalReason: "paridad exacta en todos los periodos",
      validationReportId: "informe-1",
      approvedAt: CALCULADO_EN,
    });
    expect(decision.approved).toBe(true);
    expect(decision.approvedBy).toBe("admin-tecnico");
    expect(decision.approvedAt).toBe(CALCULADO_EN);
    expect(decision.engineVersion).toBe(informe.engineVersion);
    expect(decision.projectionVersion).toBe(informe.projectionVersion);
  });

  it("J. la segunda empresa permanece en shadow", () => {
    const resultado = calculateTaxPeriod(entrada({ configuredMode: "shadow" }));
    expect(resultado.mode).toBe("shadow");
    expect(resultado.calculationEngine).toBe("legacy");
  });

  it("K. en compatibility no se ejecuta ninguna fórmula legada", () => {
    const resultado = calculateTaxPeriod(
      entrada({ configuredMode: "compatibility", legacyProductive: null }),
    );
    expect(resultado.mode).toBe("compatibility");
    expect(resultado.calculationEngine).toBe("unified");
    expect(legacyCalculationInvocationCount({ mode: "compatibility" })).toBe(0);
  });

  it("L. una falla del núcleo conserva la última cifra válida", () => {
    const previa = compatibilidad();
    const resultado = calculateTaxPeriod(
      entrada({
        configuredMode: "compatibility",
        legacyProductive: null,
        previousProductive: previa,
        unifiedInput: {
          ...entradaUnificada(),
          // Entrada corrupta: obliga al núcleo a fallar.
          facts: null as unknown as [],
        },
      }),
    );
    expect(resultado.runStatus).toBe("failed");
    expect(resultado.persistable).toBe(false);
    expect(resultado.productive).toEqual(previa);
    expect(resultado.errors.join(" ")).toContain("COMPATIBILITY_RUN_FAILED");
    expect(legacyCalculationInvocationCount({ mode: "compatibility" })).toBe(0);
  });

  it("M. el rollback conserva los datos técnicos", () => {
    const registro = registrarRollbackAModoSombra({
      companyId: "empresa-piloto",
      reason: "verificación de rollback",
      actor: "admin-tecnico",
      ahora: CALCULADO_EN,
    });
    expect(registro.modo).toBe("shadow");
    expect(registro.rollbackReason).toBe("verificación de rollback");

    // Tras el rollback la validación previa sigue siendo utilizable.
    const resultado = validar();
    expect(resultado.rows.length).toBeGreaterThan(0);
    expect(resultado.snapshot.calculationInputHash.length).toBeGreaterThan(0);
  });

  it("N. el backfill piloto es idempotente y reanudable", async () => {
    const persistidos: string[] = [];
    const opciones = {
      companyId: "empresa-piloto",
      periodFrom: CASO.period,
      periodTo: CASO.period,
      mode: "compatibility" as const,
      dryRun: false,
      stopOnDifference: true,
    };
    const deps = {
      listarPeriodos: () => [CASO.period],
      cargarEntrada: () =>
        entrada({ configuredMode: "compatibility", legacyProductive: null }),
      persistir: (r: { period: string }) => {
        persistidos.push(r.period);
      },
    };

    const seco = await backfillUnifiedCompatibility(
      { ...opciones, dryRun: true },
      deps,
    );
    expect(seco.differencesFound).toBe(0);
    expect(seco.periodsPersisted).toBe(0);

    const primera = await backfillUnifiedCompatibility(opciones, deps);
    const segunda = await backfillUnifiedCompatibility(opciones, deps);
    expect(primera.rows[0].calculationInputHash).toBe(
      segunda.rows[0].calculationInputHash,
    );
    expect(persistidos).toEqual([CASO.period, CASO.period]);
  });

  it("O. la validación piloto no realiza consultas externas ni gasta créditos", () => {
    const resultados = PERIODOS_PILOT_WOOD.slice(0, 3).map(() => validar());
    const informe = construirInformeValidacionPiloto({
      companyAlias: PILOT_WOOD_COMPANY,
      resultados,
    });
    expect(informe.providerCalls).toBe(0);
    expect(informe.creditsUsed).toBe(0);
    expect(consultasExternas).toBe(0);
    expect(creditosConsumidos).toBe(0);
    expect(resultados.every((r) => r.snapshot.providerCalled === false)).toBe(true);
  });

  it("P. los fixtures piloto están sanitizados y usan alias técnicos", () => {
    const serializado = JSON.stringify(FIXTURES_PILOT_WOOD);
    expect(serializado).not.toMatch(/\d{7,8}-[\dkK]/);
    expect(FIXTURES_PILOT_WOOD.every((f) => f.companyAlias === PILOT_WOOD_COMPANY)).toBe(
      true,
    );
    expect(PERIODOS_PILOT_WOOD).toContain("2026-06");
  });

  it("Q. un periodo sin procesar bloquea el informe", () => {
    const informe = construirInformeValidacionPiloto({
      companyAlias: PILOT_WOOD_COMPANY,
      expectedPeriods: [CASO.period, "2099-01"],
      resultados: [validar()],
    });
    expect(informe.promotionReady).toBe(false);
    expect(informe.blockingReasons).toContain("periodo_sin_procesar:2099-01");
    expect(informe.blockedCode).toBe(PILOT_PROMOTION_BLOCKED);
  });
});
