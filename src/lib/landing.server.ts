/**
 * Contenido de la landing pública: lectura pública (solo publicado) y
 * administración reservada al rol global `admin`.
 *
 * No consulta al SII ni al API Gateway y no consume créditos.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ErrorNegocio } from "@/lib/companies.server";
import { esAdministrador } from "@/lib/cuenta.server";
import {
  CONTENIDO_LANDING_POR_DEFECTO,
  fusionarContenido,
  type ContenidoLanding,
  type LandingPublica,
  type PlanPublico,
  type TestimonioLanding,
  type VersionLanding,
} from "@/lib/landing";

type FilaPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_clp: number | string | null;
  billing_period: string | null;
  public_features: string[] | null;
  is_featured: boolean;
  is_public: boolean;
  is_active: boolean;
  sort_order: number;
};

type FilaTestimonio = {
  id: string;
  name: string;
  industry: string;
  quote: string;
  image_url: string | null;
  sort_order: number;
  is_visible: boolean;
  is_featured: boolean;
};

const CAMPOS_PLAN =
  "id, code, name, description, price_clp, billing_period, public_features, is_featured, is_public, is_active, sort_order";
const CAMPOS_TESTIMONIO =
  "id, name, industry, quote, image_url, sort_order, is_visible, is_featured";

function mapPlan(f: FilaPlan): PlanPublico {
  return {
    id: f.id,
    codigo: f.code,
    nombre: f.name,
    descripcion: f.description ?? "",
    precioClp: f.price_clp === null ? null : Number(f.price_clp),
    periodicidad: f.billing_period ?? "mensual",
    caracteristicas: f.public_features ?? [],
    destacado: f.is_featured,
    publico: f.is_public,
    activo: f.is_active,
    orden: f.sort_order,
  };
}

function mapTestimonio(f: FilaTestimonio): TestimonioLanding {
  return {
    id: f.id,
    nombre: f.name,
    rubro: f.industry,
    testimonio: f.quote,
    imagenUrl: f.image_url,
    orden: f.sort_order,
    visible: f.is_visible,
    destacado: f.is_featured,
  };
}

async function contenidoPorEstado(
  estado: "draft" | "published",
): Promise<{ contenido: ContenidoLanding; version: number | null } | null> {
  const { data } = await supabaseAdmin
    .from("tax_landing_content")
    .select("content, version")
    .eq("status", estado)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    contenido: fusionarContenido((data as { content: unknown }).content),
    version: (data as { version: number }).version,
  };
}

/** Lectura pública: solo contenido publicado, planes públicos y testimonios visibles. */
export async function landingPublica(): Promise<LandingPublica> {
  const [publicado, planes, testimonios] = await Promise.all([
    contenidoPorEstado("published"),
    supabaseAdmin
      .from("tax_plans")
      .select(CAMPOS_PLAN)
      .eq("is_active", true)
      .eq("is_public", true)
      .order("sort_order"),
    supabaseAdmin
      .from("tax_landing_testimonials")
      .select(CAMPOS_TESTIMONIO)
      .eq("is_visible", true)
      .order("sort_order"),
  ]);

  return {
    contenido: publicado?.contenido ?? CONTENIDO_LANDING_POR_DEFECTO,
    planes: ((planes.data ?? []) as unknown as FilaPlan[]).map(mapPlan),
    testimonios: ((testimonios.data ?? []) as unknown as FilaTestimonio[]).map(
      mapTestimonio,
    ),
  };
}

async function exigirAdmin(userId: string) {
  if (!(await esAdministrador(userId)))
    throw new ErrorNegocio("Esta sección es solo para el equipo de administración.");
}

export interface LandingAdmin {
  borrador: ContenidoLanding;
  publicado: ContenidoLanding | null;
  hayBorradorSinPublicar: boolean;
  planes: PlanPublico[];
  testimonios: TestimonioLanding[];
  historial: VersionLanding[];
}

export async function landingAdmin(userId: string): Promise<LandingAdmin> {
  await exigirAdmin(userId);
  const [borrador, publicado, planes, testimonios, historial] = await Promise.all([
    contenidoPorEstado("draft"),
    contenidoPorEstado("published"),
    supabaseAdmin.from("tax_plans").select(CAMPOS_PLAN).order("sort_order"),
    supabaseAdmin
      .from("tax_landing_testimonials")
      .select(CAMPOS_TESTIMONIO)
      .order("sort_order"),
    supabaseAdmin
      .from("tax_landing_content")
      .select("id, version, status, note, updated_at")
      .order("version", { ascending: false })
      .limit(20),
  ]);

  return {
    borrador:
      borrador?.contenido ?? publicado?.contenido ?? CONTENIDO_LANDING_POR_DEFECTO,
    publicado: publicado?.contenido ?? null,
    hayBorradorSinPublicar:
      !!borrador &&
      JSON.stringify(borrador.contenido) !== JSON.stringify(publicado?.contenido),
    planes: ((planes.data ?? []) as unknown as FilaPlan[]).map(mapPlan),
    testimonios: ((testimonios.data ?? []) as unknown as FilaTestimonio[]).map(
      mapTestimonio,
    ),
    historial: (
      (historial.data ?? []) as unknown as {
        id: string;
        version: number;
        status: VersionLanding["estado"];
        note: string | null;
        updated_at: string;
      }[]
    ).map((f) => ({
      id: f.id,
      version: f.version,
      estado: f.status,
      nota: f.note,
      actualizado: f.updated_at,
    })),
  };
}

async function proximaVersion(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("tax_landing_content")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as { version: number } | null)?.version ?? 0) + 1;
}

/** Guarda el borrador (nunca visible para el público). */
export async function guardarBorradorLanding(
  userId: string,
  contenido: unknown,
  nota?: string | null,
): Promise<{ ok: true }> {
  await exigirAdmin(userId);
  const limpio = fusionarContenido(contenido);
  const { data: existente } = await supabaseAdmin
    .from("tax_landing_content")
    .select("id")
    .eq("status", "draft")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente) {
    const { error } = await supabaseAdmin
      .from("tax_landing_content")
      .update({ content: limpio as unknown as never, note: nota ?? null, updated_by: userId })
      .eq("id", (existente as { id: string }).id);
    if (error) throw new ErrorNegocio("No pudimos guardar el borrador.");
    return { ok: true };
  }

  const { error } = await supabaseAdmin.from("tax_landing_content").insert({
    status: "draft",
    version: await proximaVersion(),
    content: limpio as unknown as never,
    note: nota ?? null,
    updated_by: userId,
  });
  if (error) throw new ErrorNegocio("No pudimos guardar el borrador.");
  return { ok: true };
}

/** Publica el borrador actual: archiva la versión publicada anterior. */
export async function publicarLanding(userId: string): Promise<{ ok: true }> {
  await exigirAdmin(userId);
  const borrador = await contenidoPorEstado("draft");
  if (!borrador) throw new ErrorNegocio("No hay un borrador para publicar.");

  await supabaseAdmin
    .from("tax_landing_content")
    .update({ status: "archived" })
    .eq("status", "published");

  const { error } = await supabaseAdmin.from("tax_landing_content").insert({
    status: "published",
    version: await proximaVersion(),
    content: borrador.contenido as unknown as never,
    note: "Publicación",
    updated_by: userId,
  });
  if (error) throw new ErrorNegocio("No pudimos publicar los cambios.");
  return { ok: true };
}

/** Restaura una versión anterior dejándola como borrador. */
export async function restaurarVersionLanding(
  userId: string,
  versionId: string,
): Promise<{ ok: true }> {
  await exigirAdmin(userId);
  const { data } = await supabaseAdmin
    .from("tax_landing_content")
    .select("content")
    .eq("id", versionId)
    .maybeSingle();
  if (!data) throw new ErrorNegocio("No encontramos esa versión.");
  return guardarBorradorLanding(userId, (data as { content: unknown }).content, "Restaurada");
}

export interface EntradaTestimonio {
  id?: string | null;
  nombre: string;
  rubro: string;
  testimonio: string;
  imagenUrl?: string | null;
  orden: number;
  visible: boolean;
  destacado: boolean;
}

export async function guardarTestimonio(
  userId: string,
  entrada: EntradaTestimonio,
): Promise<{ ok: true }> {
  await exigirAdmin(userId);
  if (!entrada.nombre.trim() || !entrada.testimonio.trim())
    throw new ErrorNegocio("El nombre y el testimonio son obligatorios.");
  const fila = {
    name: entrada.nombre.trim(),
    industry: entrada.rubro.trim(),
    quote: entrada.testimonio.trim(),
    image_url: entrada.imagenUrl?.trim() || null,
    sort_order: entrada.orden,
    is_visible: entrada.visible,
    is_featured: entrada.destacado,
  };
  const { error } = entrada.id
    ? await supabaseAdmin
        .from("tax_landing_testimonials")
        .update(fila)
        .eq("id", entrada.id)
    : await supabaseAdmin.from("tax_landing_testimonials").insert(fila);
  if (error) throw new ErrorNegocio("No pudimos guardar el testimonio.");
  return { ok: true };
}

export async function eliminarTestimonio(
  userId: string,
  id: string,
): Promise<{ ok: true }> {
  await exigirAdmin(userId);
  const { error } = await supabaseAdmin
    .from("tax_landing_testimonials")
    .delete()
    .eq("id", id);
  if (error) throw new ErrorNegocio("No pudimos eliminar el testimonio.");
  return { ok: true };
}

export interface EntradaPlanPublico {
  id: string;
  nombre: string;
  descripcion: string;
  precioClp: number | null;
  periodicidad: string;
  caracteristicas: string[];
  destacado: boolean;
  publico: boolean;
  orden: number;
}

/**
 * Actualiza solo la presentación comercial del plan.
 * No modifica límites, cuotas ni presupuesto de actualizaciones.
 */
export async function actualizarPlanPublico(
  userId: string,
  entrada: EntradaPlanPublico,
): Promise<{ ok: true }> {
  await exigirAdmin(userId);
  const { error } = await supabaseAdmin
    .from("tax_plans")
    .update({
      name: entrada.nombre.trim(),
      description: entrada.descripcion.trim() || null,
      price_clp: entrada.precioClp,
      billing_period: entrada.periodicidad.trim() || "mensual",
      public_features: entrada.caracteristicas.filter((c) => c.trim().length > 0),
      is_featured: entrada.destacado,
      is_public: entrada.publico,
      sort_order: entrada.orden,
    })
    .eq("id", entrada.id);
  if (error) throw new ErrorNegocio("No pudimos actualizar el plan.");
  if (entrada.destacado) {
    await supabaseAdmin
      .from("tax_plans")
      .update({ is_featured: false })
      .neq("id", entrada.id);
  }
  return { ok: true };
}
