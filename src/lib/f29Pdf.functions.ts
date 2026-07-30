import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { envolver } from "@/lib/serverResult";

const entradaExtraccion = z.object({
  companyId: z.string().uuid(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  rutUsuario: z.string().min(8),
  claveTributaria: z.string().min(4),
  consentimiento: z.literal(true),
  folioConfirmado: z.string().min(1).nullable().optional(),
});

const entradaPeriodo = z.object({
  companyId: z.string().uuid(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
});

export const extraerF29CompactoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entradaExtraccion.parse(data))
  .handler(async ({ data, context }) => {
    return envolver(async () => {
      const { extraerF29Compacto } = await import("@/lib/f29PdfExtraction.server");
      return extraerF29Compacto(context.userId, data);
    });
  });

export const obtenerExtraccionF29Fn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entradaPeriodo.parse(data))
  .handler(async ({ data, context }) => {
    return envolver(async () => {
      const { obtenerExtraccionF29 } = await import("@/lib/f29PdfExtraction.server");
      return obtenerExtraccionF29(context.userId, data);
    });
  });

export const urlFirmadaF29Fn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entradaPeriodo.parse(data))
  .handler(async ({ data, context }) => {
    return envolver(async () => {
      const { urlFirmadaF29 } = await import("@/lib/f29PdfExtraction.server");
      return urlFirmadaF29(context.userId, data);
    });
  });
