/**
 * Backfill reanudable e idempotente hacia la ruta unificada (Etapa 6.8.1).
 *
 * En `dry_run` calcula y compara sin tocar `tax_monthly_summaries`, sin mover
 * banderas y sin cambiar estados del periodo. En `apply` solo puede escribir
 * si la empresa está en `compatibility` y la paridad está comprobada.
 *
 * Las dependencias de datos se inyectan: el módulo no habla con la base de
 * datos ni con el proveedor. Cero consultas externas.
 */
import { calculateTaxPeriod, type EntradaCalculoPeriodo, type ResultadoCalculoPeriodo } from "./calculationOrchestrator";
import type { UnifiedEngineMode } from "./unifiedEngineMode";

export interface OpcionesBackfill {
  companyId: string;
  periodFrom: string;
  periodTo: string;
  mode: UnifiedEngineMode;
  dryRun: boolean;
  onlyMissing?: boolean;
  stopOnDifference?: boolean;
}

export interface DependenciasBackfill {
  /** Periodos disponibles en orden cronológico. */
  listarPeriodos: (companyId: string) => Promise<string[]> | string[];
  /** Arma la entrada del orquestador para un periodo. */
  cargarEntrada: (
    companyId: string,
    period: string,
  ) => Promise<EntradaCalculoPeriodo> | EntradaCalculoPeriodo;
  /** Indica si el periodo ya tiene metadatos del núcleo persistidos. */
  yaProcesado?: (companyId: string, period: string) => Promise<boolean> | boolean;
  /** Persistencia atómica. Solo se invoca fuera de `dry_run`. */
  persistir?: (resultado: ResultadoCalculoPeriodo) => Promise<void> | void;
}

export interface FilaBackfill {
  period: string;
  status: "calculated" | "skipped" | "persisted" | "blocked" | "failed";
  differences: number;
  runStatus: string;
  calculationInputHash: string;
  errors: string[];
}

export interface ReporteBackfill {
  companyId: string;
  mode: UnifiedEngineMode;
  dryRun: boolean;
  periodsConsidered: number;
  periodsProcessed: number;
  periodsPersisted: number;
  differencesFound: number;
  stoppedAt: string | null;
  rows: FilaBackfill[];
}

export async function backfillUnifiedCompatibility(
  opciones: OpcionesBackfill,
  deps: DependenciasBackfill,
): Promise<ReporteBackfill> {
  const todos = await deps.listarPeriodos(opciones.companyId);
  const seleccionados = todos
    .filter((p) => p >= opciones.periodFrom && p <= opciones.periodTo)
    .sort();

  const rows: FilaBackfill[] = [];
  let persisted = 0;
  let differencesFound = 0;
  let stoppedAt: string | null = null;

  for (const period of seleccionados) {
    if (opciones.onlyMissing && deps.yaProcesado) {
      const hecho = await deps.yaProcesado(opciones.companyId, period);
      if (hecho) {
        rows.push({
          period,
          status: "skipped",
          differences: 0,
          runStatus: "reused",
          calculationInputHash: "",
          errors: [],
        });
        continue;
      }
    }

    const entrada = await deps.cargarEntrada(opciones.companyId, period);
    let resultado: ResultadoCalculoPeriodo;
    try {
      resultado = calculateTaxPeriod(entrada);
    } catch (error) {
      rows.push({
        period,
        status: "failed",
        differences: 0,
        runStatus: "failed",
        calculationInputHash: "",
        errors: [error instanceof Error ? error.message : "error"],
      });
      stoppedAt = period;
      break;
    }

    // TAX_ZERO_JUSTIFIED: conteo de diferencias, no es un monto tributario.
    const diferencias = resultado.parity?.blockingDifferences.length ?? 0;
    differencesFound += diferencias;

    const puedeEscribir =
      !opciones.dryRun &&
      opciones.mode === "compatibility" &&
      resultado.mode === "compatibility" &&
      resultado.persistable &&
      diferencias === 0;

    if (puedeEscribir && deps.persistir) {
      await deps.persistir(resultado);
      persisted += 1;
    }

    rows.push({
      period,
      status: puedeEscribir
        ? "persisted"
        : diferencias > 0
          ? "blocked"
          : "calculated",
      differences: diferencias,
      runStatus: resultado.runStatus,
      calculationInputHash: resultado.calculationInputHash,
      errors: resultado.errors,
    });

    if (diferencias > 0 && opciones.stopOnDifference) {
      stoppedAt = period;
      break;
    }
  }

  return {
    companyId: opciones.companyId,
    mode: opciones.mode,
    dryRun: opciones.dryRun,
    periodsConsidered: seleccionados.length,
    periodsProcessed: rows.filter((r) => r.status !== "skipped").length,
    periodsPersisted: persisted,
    differencesFound,
    stoppedAt,
    rows,
  };
}
