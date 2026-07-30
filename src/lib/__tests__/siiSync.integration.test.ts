/**
 * Validación de extremo a extremo de la conexión SII simulada contra la base
 * de datos real, con sesiones autenticadas de verdad.
 *
 * Cubre: autorización por rol, primera sincronización, deduplicación, avance
 * del RCV, política de caché, espera mínima manual, idempotencia, escenarios
 * de falla, aislamiento entre empresas y visibilidad de los respaldos crudos.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

import {
  conectarSiiSimulado,
  desconectarSii,
  obtenerConexionSii,
  listarSincronizaciones,
  syncSiiCompanyPeriod,
} from "@/lib/siiSync.server";
import { crearMockSiiProviderAdapter } from "@/integrations/sii/mockSiiProviderAdapter";

const URL_SUPABASE = process.env.SUPABASE_URL!;
const CLAVE_PUBLICA =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  "";

const admin = createClient(URL_SUPABASE, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const marca = Date.now();
const correo = (n: string) => `qa_sii_${n}_${marca}@minegocioaldia.test`;
const clave = (n: string) => `Qa-${marca}-${n}!`;

const PERIODO = "2026-04";

type Nombre = "owner" | "business" | "accountant" | "viewer" | "suspendido" | "ajeno";
const NOMBRES: Nombre[] = [
  "owner",
  "business",
  "accountant",
  "viewer",
  "suspendido",
  "ajeno",
];

const usuarios = {} as Record<Nombre, string>;
let empresaA = "";
let empresaB = "";

/** Proveedor simulado con escenario fijo: resultados predecibles y repetibles. */
const proveedorNormal = crearMockSiiProviderAdapter({ escenario: "comprasPendientes" });

async function crearUsuario(nombre: Nombre) {
  const { data, error } = await admin.auth.admin.createUser({
    email: correo(nombre),
    password: clave(nombre),
    email_confirm: true,
  });
  if (error) throw error;
  usuarios[nombre] = data.user!.id;
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
      connection_status: "disconnected",
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

/** Cliente con la sesión real del usuario: las políticas se aplican tal cual. */
async function clienteDe(nombre: Nombre) {
  const c = createClient(URL_SUPABASE, CLAVE_PUBLICA, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({
    email: correo(nombre),
    password: clave(nombre),
  });
  if (error) throw error;
  return c;
}

async function contarDocumentos(companyId: string, periodo: string) {
  const { data } = await admin
    .from("tax_periods")
    .select("id")
    .eq("company_id", companyId)
    .eq("period", periodo)
    .maybeSingle();
  if (!data) return 0;
  const { count } = await admin
    .from("tax_documents")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("tax_period_id", data.id);
  return count ?? 0;
}

beforeAll(async () => {
  for (const n of NOMBRES) await crearUsuario(n);

  empresaA = await crearEmpresa("761112228", "QA SII A", usuarios.owner);
  empresaB = await crearEmpresa("773334447", "QA SII B", usuarios.ajeno);

  await agregarMiembro(empresaA, usuarios.owner, "owner");
  await agregarMiembro(empresaA, usuarios.business, "business_user");
  await agregarMiembro(empresaA, usuarios.accountant, "accountant");
  await agregarMiembro(empresaA, usuarios.viewer, "viewer");
  await agregarMiembro(empresaA, usuarios.suspendido, "business_user", "suspended");
  await agregarMiembro(empresaB, usuarios.ajeno, "owner");
}, 180_000);

afterAll(async () => {
  await admin.from("tax_companies").delete().in("id", [empresaA, empresaB]);
  for (const id of Object.values(usuarios)) {
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
}, 180_000);

describe("autorización de la conexión", () => {
  it("solo el dueño puede autorizar la conexión demostrativa", async () => {
    for (const n of ["business", "accountant", "viewer", "suspendido"] as Nombre[]) {
      await expect(
        conectarSiiSimulado(
          usuarios[n],
          { companyId: empresaA, consentimiento: true },
          { proveedor: proveedorNormal },
        ),
      ).rejects.toThrow();
    }
    await expect(
      conectarSiiSimulado(
        usuarios.ajeno,
        { companyId: empresaA, consentimiento: true },
        { proveedor: proveedorNormal },
      ),
    ).rejects.toThrow(/acceso/i);
  }, 120_000);

  it("exige consentimiento explícito", async () => {
    await expect(
      conectarSiiSimulado(
        usuarios.owner,
        { companyId: empresaA, consentimiento: false },
        { proveedor: proveedorNormal },
      ),
    ).rejects.toThrow(/autorización/i);
  }, 60_000);

  it("el dueño conecta y queda registrado el consentimiento", async () => {
    const conexion = await conectarSiiSimulado(
      usuarios.owner,
      { companyId: empresaA, consentimiento: true },
      { proveedor: proveedorNormal },
    );
    expect(conexion.estado).toBe("connected");
    expect(conexion.simulado).toBe(true);

    const { data } = await admin
      .from("tax_sii_connections")
      .select("consent_accepted_at, consent_version, auth_method, authorized_rut")
      .eq("company_id", empresaA)
      .single();
    expect(data?.consent_accepted_at).toBeTruthy();
    expect(data?.auth_method).toBe("demo");
    expect(data?.authorized_rut).toBe("761112228");
  }, 120_000);

  it("no guarda ninguna credencial", async () => {
    const { data } = await admin
      .from("tax_sii_connections")
      .select("*")
      .eq("company_id", empresaA)
      .single();
    const texto = JSON.stringify(data).toLowerCase();
    expect(texto).not.toContain("password");
    expect(texto).not.toContain("clave");
    expect(texto).not.toContain("certificado");
  }, 60_000);
});

describe("sincronización, deduplicación y caché", () => {
  let primeraCantidad = 0;

  it("la primera sincronización trae documentos y recalcula el periodo", async () => {
    const r = await syncSiiCompanyPeriod(
      usuarios.owner,
      { companyId: empresaA, periodo: PERIODO, triggerType: "demo_connect" },
      { proveedor: proveedorNormal },
    );
    expect(r.ejecutada).toBe(true);
    expect(r.estado).toBe("success");
    expect(r.documentosRecibidos).toBeGreaterThan(0);
    expect(r.documentosCreados).toBeGreaterThan(0);
    expect(r.simulado).toBe(true);

    primeraCantidad = await contarDocumentos(empresaA, PERIODO);
    expect(primeraCantidad).toBe(r.documentosCreados);

    const { data: resumen } = await admin
      .from("tax_monthly_summaries")
      .select("sales_total, estimated_vat_payable, recommended_reserve")
      .eq("company_id", empresaA)
      .maybeSingle();
    expect(Number(resumen?.sales_total ?? 0)).toBeGreaterThan(0);
  }, 180_000);

  it("una segunda sincronización manual no duplica documentos", async () => {
    const r = await syncSiiCompanyPeriod(
      usuarios.owner,
      { companyId: empresaA, periodo: PERIODO, triggerType: "manual" },
      { proveedor: proveedorNormal, ahora: new Date(Date.now() + 20 * 60000) },
    );
    expect(r.ejecutada).toBe(true);
    expect(r.documentosCreados).toBe(0);
    expect(r.documentosActualizados).toBeGreaterThan(0);
    expect(await contarDocumentos(empresaA, PERIODO)).toBe(primeraCantidad);
  }, 180_000);

  it("una compra pendiente pasa a registrada sin crear un documento nuevo", async () => {
    const { count } = await admin
      .from("tax_documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", empresaA)
      .eq("document_direction", "purchase")
      .eq("rcv_status", "registered");
    expect((count ?? 0) > 0).toBe(true);
    expect(await contarDocumentos(empresaA, PERIODO)).toBe(primeraCantidad);
  }, 60_000);

  it("respeta la espera mínima entre actualizaciones manuales", async () => {
    const r = await syncSiiCompanyPeriod(
      usuarios.owner,
      { companyId: empresaA, periodo: PERIODO, triggerType: "manual" },
      { proveedor: proveedorNormal },
    );
    expect(r.ejecutada).toBe(false);
    expect(r.motivo).toBe("espera_minima_manual");
    expect(r.consultasProveedor).toBe(0);
  }, 120_000);

  it("al ingresar el mismo día reutiliza la información guardada", async () => {
    const r = await syncSiiCompanyPeriod(
      usuarios.owner,
      { companyId: empresaA, periodo: PERIODO, triggerType: "login_refresh" },
      { proveedor: proveedorNormal },
    );
    expect(r.ejecutada).toBe(false);
    expect(r.motivo).toBe("cache_vigente");
    expect(r.consultasProveedor).toBe(0);
  }, 120_000);

  it("la misma clave de idempotencia no ejecuta dos veces", async () => {
    const key = `qa-${marca}`;
    const futuro = new Date(Date.now() + 3 * 86400000);
    const a = await syncSiiCompanyPeriod(
      usuarios.owner,
      { companyId: empresaA, periodo: PERIODO, triggerType: "manual", idempotencyKey: key },
      { proveedor: proveedorNormal, ahora: futuro },
    );
    const b = await syncSiiCompanyPeriod(
      usuarios.owner,
      { companyId: empresaA, periodo: PERIODO, triggerType: "manual", idempotencyKey: key },
      { proveedor: proveedorNormal, ahora: futuro },
    );
    expect(a.ejecutada).toBe(true);
    expect(b.ejecutada).toBe(false);
    expect(b.motivo).toBe("solicitud_repetida");
    expect(b.syncRunId).toBe(a.syncRunId);
    expect(await contarDocumentos(empresaA, PERIODO)).toBe(primeraCantidad);
  }, 180_000);

  it("el contador puede sincronizar y el observador no", async () => {
    const futuro = new Date(Date.now() + 4 * 86400000);
    const r = await syncSiiCompanyPeriod(
      usuarios.accountant,
      { companyId: empresaA, periodo: PERIODO, triggerType: "manual" },
      { proveedor: proveedorNormal, ahora: futuro },
    );
    expect(r.ejecutada).toBe(true);
    await expect(
      syncSiiCompanyPeriod(
        usuarios.viewer,
        { companyId: empresaA, periodo: PERIODO },
        { proveedor: proveedorNormal, ahora: futuro },
      ),
    ).rejects.toThrow(/permisos/i);
    await expect(
      syncSiiCompanyPeriod(
        usuarios.suspendido,
        { companyId: empresaA, periodo: PERIODO },
        { proveedor: proveedorNormal, ahora: futuro },
      ),
    ).rejects.toThrow(/acceso/i);
  }, 180_000);
});

describe("fallas del proveedor", () => {
  it("una caída deja la conexión advertida y no borra lo ya guardado", async () => {
    const caido = crearMockSiiProviderAdapter({ escenario: "mantenimiento" });
    const antes = await contarDocumentos(empresaA, PERIODO);
    const r = await syncSiiCompanyPeriod(
      usuarios.owner,
      { companyId: empresaA, periodo: PERIODO, triggerType: "manual" },
      { proveedor: caido, ahora: new Date(Date.now() + 5 * 86400000) },
    );
    expect(r.estado).toBe("failed");
    expect(r.errorCodigo).toBe("PROVIDER_UNAVAILABLE");
    expect(await contarDocumentos(empresaA, PERIODO)).toBe(antes);

    const estado = await obtenerConexionSii(usuarios.owner, empresaA);
    expect(["stale", "error"]).toContain(estado?.estado);
  }, 180_000);

  it("una sesión vencida corta el resto de las consultas", async () => {
    const vencida = crearMockSiiProviderAdapter({ escenario: "sesionVencida" });
    const r = await syncSiiCompanyPeriod(
      usuarios.owner,
      { companyId: empresaA, periodo: PERIODO, triggerType: "manual" },
      { proveedor: vencida, ahora: new Date(Date.now() + 6 * 86400000) },
    );
    expect(r.errorCodigo).toBe("AUTH_EXPIRED");
    // Una sola consulta fallida: no se insiste con los demás módulos.
    expect(r.consultasProveedor).toBe(1);
    expect(r.modulosCompletados).toEqual([]);
  }, 180_000);

  it("un módulo sin información del periodo no se cuenta como falla", async () => {
    // La prueba anterior dejó la conexión advertida: el dueño la reactiva.
    await conectarSiiSimulado(usuarios.owner, {
      companyId: empresaA,
      consentimiento: true,
    });
    const parcial = crearMockSiiProviderAdapter({ escenario: "datosParciales" });
    const r = await syncSiiCompanyPeriod(
      usuarios.owner,
      { companyId: empresaA, periodo: PERIODO, triggerType: "manual" },
      { proveedor: parcial, ahora: new Date(Date.now() + 7 * 86400000) },
    );
    // El SII simplemente no publica F29 del periodo: eso no rompe la consulta.
    expect(r.estado).toBe("success");
    expect(r.modulosFallidos).not.toContain("f29_periods");
    expect(
      r.detalleModulos.find((d) => d.modulo === "f29_periods")?.estado,
    ).toBe("sin_informacion");
    expect(r.modulosCompletados.length).toBeGreaterThan(0);
  }, 180_000);
});

describe("aislamiento y visibilidad", () => {
  it("los documentos quedan solo en la empresa que los sincronizó", async () => {
    expect(await contarDocumentos(empresaB, PERIODO)).toBe(0);
  }, 60_000);

  it("el respaldo crudo solo es visible para dueño y contador", async () => {
    const permitidos: Nombre[] = ["owner", "accountant"];
    const negados: Nombre[] = ["business", "viewer", "ajeno"];

    for (const n of permitidos) {
      const c = await clienteDe(n);
      const { data } = await c
        .from("tax_provider_snapshots")
        .select("id")
        .eq("company_id", empresaA);
      expect((data ?? []).length).toBeGreaterThan(0);
    }
    for (const n of negados) {
      const c = await clienteDe(n);
      const { data } = await c
        .from("tax_provider_snapshots")
        .select("id")
        .eq("company_id", empresaA);
      expect(data ?? []).toEqual([]);
    }
  }, 180_000);

  it("un usuario de otra empresa no ve documentos ni sincronizaciones ajenas", async () => {
    const c = await clienteDe("ajeno");
    const { data: docs } = await c
      .from("tax_documents")
      .select("id")
      .eq("company_id", empresaA);
    const { data: runs } = await c
      .from("tax_sync_runs")
      .select("id")
      .eq("company_id", empresaA);
    expect(docs ?? []).toEqual([]);
    expect(runs ?? []).toEqual([]);
    await expect(listarSincronizaciones(usuarios.ajeno, empresaA)).rejects.toThrow(
      /acceso/i,
    );
  }, 120_000);

  it("el historial de sincronizaciones queda disponible para el equipo", async () => {
    const historial = await listarSincronizaciones(usuarios.viewer, empresaA, 20);
    expect(historial.length).toBeGreaterThan(3);
    expect(historial.some((h) => h.estado === "success")).toBe(true);
    expect(historial.some((h) => h.estado === "skipped")).toBe(true);
  }, 120_000);
});

describe("desconexión", () => {
  it("solo el dueño desconecta y la información ya guardada se conserva", async () => {
    await expect(
      desconectarSii(usuarios.business, { companyId: empresaA }),
    ).rejects.toThrow();

    const antes = await contarDocumentos(empresaA, PERIODO);
    const r = await desconectarSii(usuarios.owner, { companyId: empresaA });
    expect(r?.estado).toBe("disconnected");
    expect(await contarDocumentos(empresaA, PERIODO)).toBe(antes);

    await expect(
      syncSiiCompanyPeriod(
        usuarios.owner,
        { companyId: empresaA, periodo: PERIODO, triggerType: "manual" },
        { proveedor: proveedorNormal },
      ),
    ).rejects.toThrow(/activar la conexión/i);
  }, 180_000);
});
