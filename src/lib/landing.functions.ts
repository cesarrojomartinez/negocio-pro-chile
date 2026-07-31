import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { envolver } from "@/lib/serverResult";
import {
  actualizarPlanPublico,
  eliminarTestimonio,
  guardarBorradorLanding,
  guardarTestimonio,
  landingAdmin,
  landingPublica,
  publicarLanding,
  restaurarVersionLanding,
  type EntradaPlanPublico,
  type EntradaTestimonio,
} from "@/lib/landing.server";

/** Público: solo devuelve contenido publicado, planes públicos y testimonios visibles. */
export const landingPublicaFn = createServerFn({ method: "GET" }).handler(async () =>
  landingPublica(),
);

export const landingAdminFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => envolver(() => landingAdmin(context.userId)));

export const guardarBorradorLandingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contenido: unknown; nota?: string | null }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => guardarBorradorLanding(context.userId, data.contenido, data.nota)),
  );

export const publicarLandingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => envolver(() => publicarLanding(context.userId)));

export const restaurarVersionLandingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { versionId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => restaurarVersionLanding(context.userId, data.versionId)),
  );

export const guardarTestimonioFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: EntradaTestimonio) => data)
  .handler(async ({ data, context }) =>
    envolver(() => guardarTestimonio(context.userId, data)),
  );

export const eliminarTestimonioFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => eliminarTestimonio(context.userId, data.id)),
  );

export const actualizarPlanPublicoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: EntradaPlanPublico) => data)
  .handler(async ({ data, context }) =>
    envolver(() => actualizarPlanPublico(context.userId, data)),
  );
