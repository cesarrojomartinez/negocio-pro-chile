import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { envolver } from "@/lib/serverResult";

const periodo = z.string().regex(/^\d{4}-\d{2}$/);
const tipo = z.enum(["f29", "f29_sale", "f29_purchase", "f29_both"]);
const archivos = z.array(z.enum(["pdf", "xml"])).max(2);

const entradaPrevisualizacion = z.object({
  companyId: z.string().uuid(),
  periodo,
  tipo,
  documentoVentaId: z.string().uuid().nullable().optional(),
  documentoCompraId: z.string().uuid().nullable().optional(),
  archivos: archivos.optional(),
});

const entradaEjecucion = z.object({
  companyId: z.string().uuid(),
  periodo,
  tipo,
  documentoVentaId: z.string().uuid().nullable().optional(),
  documentoCompraId: z.string().uuid().nullable().optional(),
  archivos,
  rutUsuario: z.string().min(8),
  claveTributaria: z.string().min(4),
  consentimiento: z.literal(true),
  folioConfirmado: z.string().min(1).nullable().optional(),
});

export const previsualizarValidacionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entradaPrevisualizacion.parse(data))
  .handler(async ({ data, context }) => {
    return envolver(async () => {
      const { previsualizarValidacion } = await import("@/lib/validacionOficial.server");
      return previsualizarValidacion(context.userId, data);
    });
  });

export const ejecutarValidacionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entradaEjecucion.parse(data))
  .handler(async ({ data, context }) => {
    return envolver(async () => {
      const { ejecutarValidacion } = await import("@/lib/validacionOficial.server");
      return ejecutarValidacion(context.userId, data);
    });
  });

export const listarValidacionesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ companyId: z.string().uuid(), limite: z.number().int().min(1).max(50).optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    return envolver(async () => {
      const { listarValidaciones } = await import("@/lib/validacionOficial.server");
      return listarValidaciones(context.userId, data);
    });
  });
