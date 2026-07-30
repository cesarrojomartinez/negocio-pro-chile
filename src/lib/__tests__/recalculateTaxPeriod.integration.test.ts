import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

import { construirDashboard } from "@/lib/dashboardBuilder";
import { recalculateTaxPeriod } from "@/lib/taxRecalc.server";
import { diasDePeriodo, periodoAnterior } from "@/lib/taxMappers";
import { estadoDelPeriodo } from "@/utils/taxCalculations";
import type { DocumentoTributario, PeriodoData } from "@/types/tax";
import type { Empresa } from "@/types/company";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const marca = Date.now();
const correo = (n: string) => `qa_${n}_${marca}@minegocioaldia.test`;

interface Usuarios {
  owner: string;
  business: string;
  accountant: string;
  viewer: string;
  suspendido: string;
  ajeno: string;
}

let usuarios: Usuarios;
let companyA = "";
let companyB = "";
const periodosCreados = new Map<string, string>();
let folioSeq = 1000;

async function crearUsuario(nombre: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email: correo(nombre),
    password: `Qa-${marca}-${nombre}!`,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

async function crearEmpresa(rut: string, nombre: string, creador: string) {
  const { data, error } = await admin
    .from("tax_companies")
    .insert({
      rut,
      business_name: nombre,
      fantasy_name: nombre,
      business_activity: "Comercio",
      created_by: creador,
      is_demo: false,
      connection_status: "connected",
      last_sync_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function agregarMiembro(
  companyId: string,
  userId: string,
  role: string,
  status = "active",
) {
  const { error } = await admin
    .from("tax_company_members")
    .insert({ company_id: companyId, user_id: userId, role, status });
  if (error) throw error;
}

async function crearPeriodo(companyId: string, periodo: string) {
  const clave = `${companyId}:${periodo}`;
  if (periodosCreados.has(clave)) return periodosCreados.get(clave)!;
  const [year, month] = periodo.split("-").map(Number);
  const { data, error } = await admin
    .from("tax_periods")
    .insert({ company_id: companyId, period: periodo, year, month, data_source: "manual" })
    .select("id")
    .single();
  if (error) throw error;
  periodosCreados.set(clave, data.id as string);
  return data.id as string;
}

interface Doc {
  direccion: "sale" | "purchase";
  neto: number;
  estado: string;
  tipo?: string;
}

async function insertarDocs(
  companyId: string,
  periodo: string,
  docs: Doc[],
): Promise<{ venta: DocumentoTributario[]; compra: DocumentoTributario[] }> {
  const periodId = await crearPeriodo(companyId, periodo);
  const filas = docs.map((d, i) => {
    folioSeq += 1;
    const iva = d.tipo === "exenta" ? 0 : Math.round(d.neto * 0.19);
    return {
      company_id: companyId,
      tax_period_id: periodId,
      document_direction: d.direccion,
      document_type: d.tipo === "exenta" ? "factura" : (d.tipo ?? "factura"),
      folio: folioSeq,
      document_date: `${periodo}-10`,
      counterparty_name: d.direccion === "sale" ? "Cliente QA" : "Proveedor QA",
      counterparty_rut: `77.${100 + i}.200-K`,
      net_amount: d.neto,
      vat_amount: iva,
      exempt_amount: 0,
      total_amount: d.neto + iva,
      rcv_status: d.estado,
      source: "manual",
    };
  });
  if (filas.length) {
    const { error } = await admin.from("tax_documents").insert(filas);
    if (error) throw error;
  }
  const mapear = (f: (typeof filas)[number]): DocumentoTributario => ({
    id: `${f.folio}`,
    fecha: f.document_date,
    tipoDocumento: f.document_type as DocumentoTributario["tipoDocumento"],
    folio: f.folio,
    contraparte: f.counterparty_name,
    rutContraparte: f.counterparty_rut,
    neto: f.net_amount,
    iva: f.vat_amount,
    exento: f.exempt_amount,
    total: f.total_amount,
    estado:
      f.document_direction === "sale"
        ? "emitido"
        : f.rcv_status === "registered"
          ? "registrada"
          : f.rcv_status === "pending"
            ? "pendiente"
            : f.rcv_status === "claimed"
              ? "reclamada"
              : "noIncluir",
    periodo,
  });
  return {
    venta: filas.filter((f) => f.document_direction === "sale").map(mapear),
    compra: filas.filter((f) => f.document_direction === "purchase").map(mapear),
  };
}

async function configurar(
  companyId: string,
  cfg: { meta?: number; reserva?: number; margen?: number; ppm?: number },
) {
  const { error } = await admin.from("tax_company_settings").upsert(
    {
      company_id: companyId,
      monthly_sales_goal: cfg.meta ?? 0,
      reserved_amount: cfg.reserva ?? 0,
      preventive_margin_percent: cfg.margen ?? 10,
      estimated_ppm_rate: cfg.ppm ?? 0.006,
    },
    { onConflict: "company_id" },
  );
  if (error) throw error;
}

const EMPRESA_LOCAL = (id: string): Empresa => ({
  id,
  rut: "76.000.000-0",
  razonSocial: "QA",
  nombreFantasia: "QA",
  actividad: "Comercio",
  estadoConexionSii: "connected",
  ultimaSincronizacion: new Date().toISOString(),
  periodoActivo: "2026-05",
});

/** Reconstruye en el frontend lo mismo que el backend obtuvo de la base. */
function dashboardLocal(
  companyId: string,
  periodo: string,
  docs: { venta: DocumentoTributario[]; compra: DocumentoTributario[] },
  cfg: {
    meta: number;
    reserva: number;
    margen: number;
    ppm: number | null;
    remanente?: number;
    fuenteRemanente?: PeriodoData["fuenteRemanente"];
  },
) {
  const dias = diasDePeriodo(periodo);
  const p: PeriodoData = {
    periodo,
    documentosVenta: docs.venta,
    documentosCompra: docs.compra,
    remanenteAnterior: cfg.remanente ?? 0,
    fuenteRemanente: cfg.fuenteRemanente ?? "unknown",
    tasaPpm: cfg.ppm,
    fuentePpm: cfg.ppm == null ? "unknown" : "configured",
    retencionesEstimadas: 0,
    fuenteRetenciones: "unknown",
    metaMensual: cfg.meta,
    dineroReservado: cfg.reserva,
    diasTranscurridos: dias.diasTranscurridos,
    diasTotales: dias.diasTotales,
    estadoPeriodo: estadoDelPeriodo(periodo),
    confiabilidad: "media",
  };
  return construirDashboard({
    empresa: EMPRESA_LOCAL(companyId),
    periodo: p,
    periodoAnterior: null,
    idPeriodoAnterior: null,
    margenPorcentaje: cfg.margen,
    dineroReservado: cfg.reserva,
    metaMensual: cfg.meta,
    diasDesdeSincronizacion: 0,
    configuradoManualmente: true,
  });
}

beforeAll(async () => {
  usuarios = {
    owner: await crearUsuario("owner"),
    business: await crearUsuario("business"),
    accountant: await crearUsuario("accountant"),
    viewer: await crearUsuario("viewer"),
    suspendido: await crearUsuario("suspendido"),
    ajeno: await crearUsuario("ajeno"),
  };
  companyA = await crearEmpresa(`76${marca % 1000000}1`, "Empresa QA A", usuarios.owner);
  companyB = await crearEmpresa(`77${marca % 1000000}2`, "Empresa QA B", usuarios.ajeno);
  await agregarMiembro(companyA, usuarios.owner, "owner");
  await agregarMiembro(companyA, usuarios.business, "business_user");
  await agregarMiembro(companyA, usuarios.accountant, "accountant");
  await agregarMiembro(companyA, usuarios.viewer, "viewer");
  await agregarMiembro(companyA, usuarios.suspendido, "business_user", "suspended");
  await agregarMiembro(companyB, usuarios.ajeno, "owner");
  await configurar(companyA, {});
}, 120_000);

afterAll(async () => {
  await admin.from("tax_companies").delete().in("id", [companyA, companyB]);
  for (const id of Object.values(usuarios ?? {})) {
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
}, 120_000);

describe("recalculateTaxPeriod — autorización", () => {
  it("owner, business_user y accountant pueden recalcular; viewer no", async () => {
    await insertarDocs(companyA, "2026-01", [
      { direccion: "sale", neto: 1_000_000, estado: "accepted" },
    ]);
    for (const uid of [usuarios.owner, usuarios.business, usuarios.accountant]) {
      const r = await recalculateTaxPeriod(uid, { companyId: companyA, periodo: "2026-01" });
      expect(r.periodo).toBe("2026-01");
    }
    await expect(
      recalculateTaxPeriod(usuarios.viewer, { companyId: companyA, periodo: "2026-01" }),
    ).rejects.toThrow(/permisos/i);
  }, 120_000);

  it("bloquea usuario de otra empresa y usuario suspendido", async () => {
    await expect(
      recalculateTaxPeriod(usuarios.ajeno, { companyId: companyA, periodo: "2026-01" }),
    ).rejects.toThrow(/acceso/i);
    await expect(
      recalculateTaxPeriod(usuarios.suspendido, { companyId: companyA, periodo: "2026-01" }),
    ).rejects.toThrow(/acceso/i);
    await expect(
      recalculateTaxPeriod(usuarios.owner, { companyId: companyB, periodo: "2026-01" }),
    ).rejects.toThrow(/acceso/i);
  }, 120_000);

  it("no duplica resúmenes al recalcular varias veces", async () => {
    await recalculateTaxPeriod(usuarios.owner, { companyId: companyA, periodo: "2026-01" });
    await recalculateTaxPeriod(usuarios.owner, { companyId: companyA, periodo: "2026-01" });
    const { count } = await admin
      .from("tax_monthly_summaries")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyA);
    expect(count).toBe(1);
  }, 120_000);

  it("registra la actividad del recálculo", async () => {
    const { data } = await admin
      .from("tax_activity_logs")
      .select("action, user_id")
      .eq("company_id", companyA)
      .eq("action", "calculation.recalculated");
    expect((data ?? []).length).toBeGreaterThan(0);
  }, 60_000);
});

describe("paridad frontend / backend — casos deterministas", () => {
  async function comparar(
    periodo: string,
    docs: Doc[],
    cfg: { meta?: number; reserva?: number; margen?: number; ppm?: number },
  ) {
    const insertados = await insertarDocs(companyA, periodo, docs);
    await configurar(companyA, cfg);
    // El remanente arrastrado se lee de la base, igual que hace el backend.
    const prev = periodoAnterior(periodo);
    const { data: periodoPrev } = await admin
      .from("tax_periods")
      .select("id")
      .eq("company_id", companyA)
      .eq("period", prev)
      .maybeSingle();
    let remanente = 0;
    let fuenteRemanente: PeriodoData["fuenteRemanente"] = "unknown";
    if (periodoPrev) {
      const { data: resumenPrev } = await admin
        .from("tax_monthly_summaries")
        .select("estimated_new_carryforward")
        .eq("company_id", companyA)
        .eq("tax_period_id", periodoPrev.id)
        .maybeSingle();
      if (resumenPrev) {
        remanente = Number(resumenPrev.estimated_new_carryforward);
        fuenteRemanente = "previous_period";
      }
    }
    const back = await recalculateTaxPeriod(usuarios.owner, {
      companyId: companyA,
      periodo,
    });
    const front = dashboardLocal(companyA, periodo, insertados, {
      meta: cfg.meta ?? 0,
      reserva: cfg.reserva ?? 0,
      margen: cfg.margen ?? 10,
      ppm: cfg.ppm === 0 ? null : (cfg.ppm ?? 0.006),
      remanente,
      fuenteRemanente,
    });
    return { back, front };
  }

  function registrar(nombre: string, back: Record<string, unknown>, front: Record<string, unknown>) {
    const campos = [
      "ivaDebito","ivaCredito","ivaCreditoPotencial","ivaEstimado","nuevoRemanente",
      "ppmEstimado","totalTributarioEstimado","margenPreventivo","reservaRecomendada",
    ];
    const linea = campos
      .map((c) => `${c}=${back[c]}/${front[c]}`)
      .join(" ");
    console.log(`[PARIDAD] ${nombre} :: ${linea}`);
  }

  function esperarParidad(
    back: Awaited<ReturnType<typeof recalculateTaxPeriod>>,
    front: ReturnType<typeof construirDashboard>,
    nombre = "",
  ) {
    registrar(nombre, back as unknown as Record<string, unknown>, front.resumen as unknown as Record<string, unknown>);
    expect(back.ivaDebito).toBe(front.resumen.ivaDebito);
    expect(back.ivaCredito).toBe(front.resumen.ivaCredito);
    expect(back.ivaCreditoPotencial).toBe(front.resumen.ivaCreditoPotencial);
    expect(back.ivaEstimado).toBe(front.resumen.ivaEstimado);
    expect(back.nuevoRemanente).toBe(front.resumen.nuevoRemanente);
    expect(back.ppmEstimado).toBe(front.resumen.ppmEstimado);
    expect(back.retencionesEstimadas).toBe(front.resumen.retencionesEstimadas);
    expect(back.totalTributarioEstimado).toBe(front.resumen.totalTributarioEstimado);
    expect(back.margenPreventivo).toBe(front.resumen.margenPreventivo);
    expect(back.reservaRecomendada).toBe(front.resumen.reservaRecomendada);
  }

  it("caso 1: IVA por pagar", async () => {
    const { back, front } = await comparar(
      "2026-02",
      [
        { direccion: "sale", neto: 1_000_000, estado: "accepted" },
        { direccion: "purchase", neto: 400_000, estado: "registered" },
      ],
      {},
    );
    expect(back.ivaEstimado).toBe(114_000);
    esperarParidad(back, front, "caso 1");
  }, 120_000);

  it("caso 2: nuevo remanente (crédito mayor al débito)", async () => {
    const { back, front } = await comparar(
      "2026-03",
      [
        { direccion: "sale", neto: 200_000, estado: "accepted" },
        { direccion: "purchase", neto: 500_000, estado: "registered" },
      ],
      {},
    );
    expect(back.ivaEstimado).toBe(0);
    expect(back.nuevoRemanente).toBe(57_000);
    esperarParidad(back, front, "caso 2");
  }, 120_000);

  it("caso 3: compras pendientes", async () => {
    const { back, front } = await comparar(
      "2026-04",
      [
        { direccion: "sale", neto: 1_000_000, estado: "accepted" },
        { direccion: "purchase", neto: 300_000, estado: "registered" },
        { direccion: "purchase", neto: 200_000, estado: "pending" },
        { direccion: "purchase", neto: 100_000, estado: "pending" },
        { direccion: "purchase", neto: 100_000, estado: "pending" },
      ],
      {},
    );
    expect(back.ivaCredito).toBe(57_000);
    expect(back.ivaCreditoPotencial).toBe(76_000);
    expect(back.confiabilidad).not.toBe("high");
    esperarParidad(back, front, "caso 3");
  }, 120_000);

  it("caso 4: sin tasa de PPM", async () => {
    const { back, front } = await comparar(
      "2026-05",
      [{ direccion: "sale", neto: 1_000_000, estado: "accepted" }],
      { ppm: 0 },
    );
    expect(back.ppmEstimado).toBe(0);
    expect(back.fuentePpm).toBe("unknown");
    esperarParidad(back, front, "caso 4");
  }, 120_000);

  it("caso 5: sin periodo anterior comparable (variaciones nulas)", async () => {
    const { back, front } = await comparar(
      "2026-06",
      [{ direccion: "sale", neto: 500_000, estado: "accepted" }],
      {},
    );
    expect(back.remanenteAnterior).toBe(front.resumen.remanenteAnterior);
    esperarParidad(back, front, "caso 5");
  }, 120_000);

  it("caso 6: meta superada", async () => {
    const { back, front } = await comparar(
      "2026-07",
      [{ direccion: "sale", neto: 2_000_000, estado: "accepted" }],
      { meta: 1_000_000 },
    );
    expect(front.meta.metaSuperada).toBe(true);
    esperarParidad(back, front, "caso 6");
  }, 120_000);

  it("caso 7: periodo sin datos", async () => {
    const { back, front } = await comparar("2026-08", [], { ppm: 0 });
    expect(back.ivaDebito).toBe(0);
    expect(back.totalTributarioEstimado).toBe(0);
    expect(back.confiabilidad).toBe("unknown");
    esperarParidad(back, front, "caso 7");
  }, 120_000);

  it("caso 8: reserva recomendada igual a cero", async () => {
    const { back, front } = await comparar(
      "2026-09",
      [
        { direccion: "sale", neto: 200_000, estado: "accepted" },
        { direccion: "purchase", neto: 500_000, estado: "registered" },
      ],
      { ppm: 0 },
    );
    expect(back.reservaRecomendada).toBe(0);
    esperarParidad(back, front, "caso 8");
  }, 120_000);
});

describe("persistencia de configuración y resumen", () => {
  it("meta, reserva y margen persisten y el resumen se actualiza sin duplicar", async () => {
    await configurar(companyA, { meta: 3_000_000, reserva: 250_000, margen: 5 });
    const r1 = await recalculateTaxPeriod(usuarios.owner, {
      companyId: companyA,
      periodo: "2026-02",
    });
    const { data: settings } = await admin
      .from("tax_company_settings")
      .select("monthly_sales_goal, reserved_amount, preventive_margin_percent")
      .eq("company_id", companyA)
      .single();
    expect(Number(settings!.monthly_sales_goal)).toBe(3_000_000);
    expect(Number(settings!.reserved_amount)).toBe(250_000);
    expect(Number(settings!.preventive_margin_percent)).toBe(5);
    expect(r1.margenPreventivo).toBe(Math.round(r1.totalTributarioEstimado * 0.05));

    await recalculateTaxPeriod(usuarios.owner, { companyId: companyA, periodo: "2026-02" });
    const { data: periodo } = await admin
      .from("tax_periods")
      .select("id")
      .eq("company_id", companyA)
      .eq("period", "2026-02")
      .single();
    const { count } = await admin
      .from("tax_monthly_summaries")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyA)
      .eq("tax_period_id", periodo!.id);
    expect(count).toBe(1);
  }, 180_000);
});
