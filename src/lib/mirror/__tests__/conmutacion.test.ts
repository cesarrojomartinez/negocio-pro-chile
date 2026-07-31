import { beforeEach, describe, expect, it } from "vitest";

import { CASOS_DORADOS } from "../fixtures/goldenCases";
import { construirContextoOficial } from "../officialContext";
import {
  calculateTaxPeriod,
  calcularInputHash,
  type EntradaCalculoPeriodo,
} from "../calculationOrchestrator";
import {
  construirResumenProductivo,
  resumenLegadoAProductivo,
  type ContextoProductivoNoTributario,
  type ProductiveTaxSummary,
} from "../productiveSummary";
import { proyectarCompatibilidad } from "../legacyProjection";
import { ejecutarMotorUnificado } from "../unifiedTaxEngine";
import { compararParidadProductiva } from "../parity";
import { evaluarPromocionCompatibility } from "../promotion";
import { backfillUnifiedCompatibility } from "../backfill";
import {
  legacyCalculationInvocationCount,
  reiniciarInstrumentacionLegada,
  invocacionesLegadasProhibidas,
} from "../legacyGuard";
import {
  registrarRollbackAModoSombra,
  resolverModoUnificadoDetallado,
} from "../unifiedEngineMode";
import type { GoldenTaxCase } from "../types";

/**
 * Etapa 6.8.1 — pruebas de conmutación productiva.
 * Ninguna prueba realiza consultas reales ni consume créditos.
 */

const CASO: GoldenTaxCase = CASOS_DORADOS[0];
const CALCULADO_EN = "2026-07-31T00:00:00.000Z";

function entradaUnificada(caso: GoldenTaxCase = CASO) {
  return {
    companyId: "empresa-prueba",
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

/** Motor "antiguo" simulado: la misma cifra visible que hoy se muestra. */
function legadoEquivalente(caso: GoldenTaxCase = CASO): ProductiveTaxSummary {
  const proyeccion = proyectarCompatibilidad(
    ejecutarMotorUnificado(entradaUnificada(caso)),
  );
  return construirResumenProductivo(proyeccion, CONTEXTO);
}

function entrada(
  overrides: Partial<EntradaCalculoPeriodo> = {},
): EntradaCalculoPeriodo {
  return {
    companyId: "empresa-prueba",
    period: CASO.period,
    configuredMode: "shadow",
    unifiedInput: entradaUnificada(),
    productiveContext: CONTEXTO,
    legacyProductive: legadoEquivalente(),
    calculatedAt: CALCULADO_EN,
    ...overrides,
  };
}

beforeEach(() => reiniciarInstrumentacionLegada());

describe("A · modo shadow", () => {
  it("el motor legado produce y el unificado solo compara", () => {
    const r = calculateTaxPeriod(entrada({ configuredMode: "shadow" }));
    expect(r.mode).toBe("shadow");
    expect(r.calculationEngine).toBe("legacy");
    expect(r.productive).toEqual(entrada().legacyProductive);
    expect(r.unified).not.toBeNull();
    expect(r.tripleComparison?.rows.length).toBeGreaterThan(0);
  });
});

describe("B · modo dual_validation", () => {
  it("ambos calculan, el legado produce y la paridad es exacta", () => {
    const r = calculateTaxPeriod(entrada({ configuredMode: "dual_validation" }));
    expect(r.mode).toBe("dual_validation");
    expect(r.calculationEngine).toBe("legacy");
    expect(r.parity?.exactParity).toBe(true);
    expect(r.parity?.differences).toEqual([]);
    expect(legacyCalculationInvocationCount({ mode: "dual_validation" })).toBe(1);
  });

  it("una diferencia de $1 queda registrada", () => {
    const legado = { ...legadoEquivalente(), estimatedTaxTotal: legadoEquivalente().estimatedTaxTotal + 1 };
    const r = calculateTaxPeriod(
      entrada({ configuredMode: "dual_validation", legacyProductive: legado }),
    );
    expect(r.parity?.exactParity).toBe(false);
    expect(r.parity?.blockingDifferences[0].field).toBe("estimatedTaxTotal");
    expect(r.parity?.blockingDifferences[0].difference).toBe(1);
  });
});

describe("C · modo compatibility", () => {
  it("el unificado calcula, la proyección produce y el legado no se invoca", () => {
    const r = calculateTaxPeriod(entrada({ configuredMode: "compatibility" }));
    expect(r.mode).toBe("compatibility");
    expect(r.calculationEngine).toBe("unified");
    expect(invocacionesLegadasProhibidas()).toEqual([]);
    expect(legacyCalculationInvocationCount({ mode: "compatibility" })).toBe(0);
  });

  it("las cifras visibles no cambian respecto del motor antiguo", () => {
    const legado = legadoEquivalente();
    const r = calculateTaxPeriod(
      entrada({ configuredMode: "compatibility", legacyProductive: legado }),
    );
    expect(r.productive).toEqual(legado);
  });
});

describe("D · error en compatibility", () => {
  it("conserva la cifra anterior, marca el run como fallido y no cae al legado", () => {
    const rota = entrada({
      configuredMode: "compatibility",
      // Grafo con un ciclo: el núcleo falla al ordenar.
      unifiedInput: {
        ...entradaUnificada(),
        dependencyGraph: {
          vat_debit: { dependsOn: ["vat_determined"], optional: [] },
          vat_determined: { dependsOn: ["vat_debit"], optional: [] },
        } as never,
      },
      previousProductive: legadoEquivalente(),
    });
    const r = calculateTaxPeriod(rota);
    expect(r.runStatus).toBe("failed");
    expect(r.persistable).toBe(false);
    expect(r.productive).toEqual(legadoEquivalente());
    expect(r.errors[0]).toContain("COMPATIBILITY_RUN_FAILED");
  });
});

describe("E · modo inválido", () => {
  it("degrada al modo seguro y registra el error", () => {
    const resolucion = resolverModoUnificadoDetallado("turbo");
    expect(resolucion.modo).toBe("shadow");
    expect(resolucion.error).toBe("INVALID_UNIFIED_ENGINE_MODE");

    const r = calculateTaxPeriod(entrada({ configuredMode: "turbo" }));
    expect(r.mode).toBe("shadow");
    expect(r.errors).toContain("INVALID_UNIFIED_ENGINE_MODE");
    expect(r.productive).toEqual(entrada().legacyProductive);
  });
});

describe("F y G · promoción", () => {
  const paridadExacta = compararParidadProductiva({
    period: CASO.period,
    legacy: legadoEquivalente(),
    compatibility: legadoEquivalente(),
  });

  it("una diferencia de $1 impide la promoción", () => {
    const conDiferencia = compararParidadProductiva({
      period: CASO.period,
      legacy: { ...legadoEquivalente(), vatDebit: legadoEquivalente().vatDebit + 1 },
      compatibility: legadoEquivalente(),
    });
    const evaluacion = evaluarPromocionCompatibility({
      companyId: "empresa-prueba",
      parityReports: [conDiferencia],
      expectedPeriods: [CASO.period],
      goldenCasesPassed: 15,
      goldenCasesTotal: 15,
      visualSnapshotsApproved: true,
      approvedBy: "admin",
    });
    expect(evaluacion.promotionStatus).toBe("blocked");
    expect(evaluacion.differencesFound).toBe(1);
  });

  it("sin acción administrativa explícita no se promueve una empresa real", () => {
    const evaluacion = evaluarPromocionCompatibility({
      companyId: "empresa-prueba",
      parityReports: [paridadExacta],
      expectedPeriods: [CASO.period],
      goldenCasesPassed: 15,
      goldenCasesTotal: 15,
      visualSnapshotsApproved: true,
    });
    expect(evaluacion.promotionStatus).toBe("requires_manual_approval");
  });

  it("con paridad exacta y aprobación explícita se promueve", () => {
    const evaluacion = evaluarPromocionCompatibility({
      companyId: "empresa-prueba",
      parityReports: [paridadExacta],
      expectedPeriods: [CASO.period],
      goldenCasesPassed: 15,
      goldenCasesTotal: 15,
      visualSnapshotsApproved: true,
      approvedBy: "admin",
      approvedAt: CALCULADO_EN,
    });
    expect(evaluacion.promotionStatus).toBe("approved");
    expect(evaluacion.periodsValidated).toBe(1);
    expect(evaluacion.approvedAt).toBe(CALCULADO_EN);
  });
});

describe("H · idempotencia", () => {
  it("el mismo hash reutiliza el cálculo sin recalcular", () => {
    const base = entrada({ configuredMode: "compatibility" });
    const hash = calcularInputHash({
      period: base.period,
      unifiedInput: base.unifiedInput,
    });
    const r = calculateTaxPeriod({
      ...base,
      existingRun: {
        calculationInputHash: hash,
        calculationRunId: "run-1",
        productive: legadoEquivalente(),
        status: "completed",
      },
    });
    expect(r.runStatus).toBe("reused");
    expect(r.unified).toBeNull();
    expect(r.calculationRunId).toBe("run-1");
    expect(r.persistable).toBe(false);
  });

  it("el hash cambia cuando cambia un antecedente", () => {
    const a = calcularInputHash({ period: "2026-06", unifiedInput: entradaUnificada() });
    const b = calcularInputHash({
      period: "2026-06",
      unifiedInput: { ...entradaUnificada(), commonUseRecoveryRatio: 0.5 },
    });
    expect(a).not.toBe(b);
  });
});

describe("I · ruta del contador", () => {
  it("el total oficial confirmado pasa por el núcleo y queda separado del estimado", () => {
    const r = calculateTaxPeriod(
      entrada({ configuredMode: "compatibility", officialTotal: CASO.codes["91"] ?? null }),
    );
    expect(r.projection).not.toBeNull();
    expect(r.projection?.officialDeclaredTotal).toBe(CASO.codes["91"] ?? null);
    const pares = new Set(r.tripleComparison?.rows.map((f) => f.pair));
    expect(pares.has("compatibility_vs_official")).toBe(true);
    expect(pares.has("unified_vs_official")).toBe(true);
  });
});

describe("J · rollback", () => {
  it("vuelve a shadow conservando la información técnica", () => {
    const registro = registrarRollbackAModoSombra({
      companyId: "empresa-prueba",
      reason: "revisión contable",
      actor: "admin",
      ahora: CALCULADO_EN,
    });
    expect(registro).toEqual({
      companyId: "empresa-prueba",
      modo: "shadow",
      rollbackReason: "revisión contable",
      rolledBackAt: CALCULADO_EN,
      rolledBackBy: "admin",
    });
  });
});

describe("backfill", () => {
  it("en dry_run calcula, compara y no persiste", async () => {
    let escrituras = 0;
    const reporte = await backfillUnifiedCompatibility(
      {
        companyId: "empresa-prueba",
        periodFrom: "2000-01",
        periodTo: "2100-12",
        mode: "dual_validation",
        dryRun: true,
      },
      {
        listarPeriodos: () => [CASO.period],
        cargarEntrada: () => entrada({ configuredMode: "dual_validation" }),
        persistir: () => {
          escrituras += 1;
        },
      },
    );
    expect(escrituras).toBe(0);
    expect(reporte.periodsPersisted).toBe(0);
    expect(reporte.differencesFound).toBe(0);
    expect(reporte.rows[0].status).toBe("calculated");
  });

  it("es reanudable: only_missing salta lo ya procesado", async () => {
    const reporte = await backfillUnifiedCompatibility(
      {
        companyId: "empresa-prueba",
        periodFrom: "2000-01",
        periodTo: "2100-12",
        mode: "compatibility",
        dryRun: false,
        onlyMissing: true,
      },
      {
        listarPeriodos: () => [CASO.period],
        cargarEntrada: () => entrada({ configuredMode: "compatibility" }),
        yaProcesado: () => true,
      },
    );
    expect(reporte.rows[0].status).toBe("skipped");
    expect(reporte.periodsProcessed).toBe(0);
  });
});

describe("contrato productivo", () => {
  it("el mapeo legado no altera cifras", () => {
    const productivo = legadoEquivalente();
    const legado = resumenLegadoAProductivo(
      {
        periodo: productivo.period,
        ventasTotales: productivo.salesTotal,
        ventasExentas: productivo.exemptSales,
        comprasTotales: productivo.purchasesTotal,
        ivaDebito: productivo.vatDebit,
        ivaCredito: productivo.vatCredit,
        remanenteAnterior: productivo.previousVatCarryforward,
        ivaEstimado: productivo.estimatedVatPayable,
        nuevoRemanente: productivo.estimatedNewCarryforward,
        basePpm: productivo.ppmTaxBase,
        tasaPpm: productivo.ppmRate,
        ppmEstimado: productivo.estimatedPpm,
        retencionesEstimadas: productivo.estimatedWithholdings,
        anticipoIvaAplicado: productivo.vatAdvanceApplied,
        totalTributarioEstimado: productivo.estimatedTaxTotal,
        margenPorcentaje: productivo.preventiveMarginPercent,
        margenPreventivo: productivo.preventiveMarginAmount,
        reservaRecomendada: productivo.recommendedReserve,
        dineroReservado: productivo.reservedAmount,
        fuenteRemanente: productivo.carryforwardSource,
        fuentePpm: productivo.ppmSource,
        fuenteRetenciones: productivo.withholdingsSource,
      },
      {
        declaredTaxTotal: productivo.declaredTaxTotal,
        periodState: productivo.periodState,
      },
    );
    expect(legado).toEqual(productivo);
  });
});
