import { describe, expect, it, vi } from "vitest";

import { seleccionarDeclaracionVigente } from "@/lib/f29Declaration";

/**
 * Recuperación de ejecuciones colgadas y separación entre RCV y F29.
 * Ninguna de estas pruebas consulta API Gateway.
 */

interface FilaRun {
  id: string;
  company_id: string;
  tax_period_id: string;
  status: string;
  started_at: string;
  error_code?: string | null;
}

const filas: FilaRun[] = [];

/** Cliente mínimo que imita el encadenamiento usado por el servidor. */
function crearAdminFalso() {
  return {
    from() {
      const filtros: Array<(f: FilaRun) => boolean> = [];
      let cambios: Partial<FilaRun> = {};
      const api = {
        update(valores: Partial<FilaRun>) {
          cambios = valores;
          return api;
        },
        eq(columna: keyof FilaRun, valor: unknown) {
          filtros.push((f) => f[columna] === valor);
          return api;
        },
        lt(columna: keyof FilaRun, valor: string) {
          filtros.push((f) => String(f[columna]) < valor);
          return api;
        },
        async select() {
          const afectadas = filas.filter((f) => filtros.every((p) => p(f)));
          afectadas.forEach((f) => Object.assign(f, cambios));
          return { data: afectadas.map((f) => ({ id: f.id })), error: null };
        },
      };
      return api;
    },
  };
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: crearAdminFalso(),
  supabase: crearAdminFalso(),
}));

const { cerrarEjecucionesColgadas, MINUTOS_EJECUCION_ABANDONADA } = await import(
  "@/lib/siiSync.server"
);

describe("ejecuciones atascadas", () => {
  it("cierra una ejecución antigua en curso y deja pasar la nueva", async () => {
    const ahora = new Date("2026-07-31T00:03:00Z");
    filas.length = 0;
    filas.push({
      id: "antigua",
      company_id: "empresa",
      tax_period_id: "enero",
      status: "running",
      started_at: "2026-07-30T23:40:00Z",
    });
    const cerradas = await cerrarEjecucionesColgadas("empresa", "enero", ahora);
    expect(cerradas).toBe(1);
    expect(filas[0].status).toBe("failed");
    expect(filas[0].error_code).toBe("STALE_SYNC_RUN");
  });

  it("no toca una ejecución reciente todavía en curso", async () => {
    const ahora = new Date("2026-07-31T00:03:00Z");
    filas.length = 0;
    filas.push({
      id: "reciente",
      company_id: "empresa",
      tax_period_id: "enero",
      status: "running",
      started_at: "2026-07-31T00:00:00Z",
    });
    expect(await cerrarEjecucionesColgadas("empresa", "enero", ahora)).toBe(0);
    expect(filas[0].status).toBe("running");
  });

  it("el umbral de abandono es de 15 minutos", () => {
    expect(MINUTOS_EJECUCION_ABANDONADA).toBe(15);
  });
});

describe("identidad del Formulario 29", () => {
  it("descarta declaraciones de otro periodo", () => {
    const r = seleccionarDeclaracionVigente(
      [
        {
          folio: "999",
          periodo: "2025-12",
          fecha: null,
          estado: null,
          esRectificatoria: false,
          vigente: true,
          crudo: {},
        },
      ],
      "2026-01",
    );
    expect(r.seleccionada).toBeNull();
  });

  it("acepta la declaración del periodo solicitado", () => {
    const r = seleccionarDeclaracionVigente(
      [
        {
          folio: "123",
          periodo: "2026-01",
          fecha: null,
          estado: null,
          esRectificatoria: false,
          vigente: true,
          crudo: {},
        },
      ],
      "2026-01",
    );
    expect(r.seleccionada?.folio).toBe("123");
  });
});

