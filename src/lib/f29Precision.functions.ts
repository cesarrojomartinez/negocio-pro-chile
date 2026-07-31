import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { envolver } from "@/lib/serverResult";

const entrada = z.object({
  companyId: z.string().uuid(),
  meses: z.number().int().min(3).max(24).optional(),
});

export const obtenerPrecisionEstimacionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entrada.parse(data))
  .handler(async ({ data, context }) =>
    envolver(async () => {
      const { obtenerPrecisionEstimacion } = await import("@/lib/f29Precision.server");
      return obtenerPrecisionEstimacion(context.userId, data);
    }),
  );

/** Rehace el cálculo de todos los periodos con la versión vigente del motor. */
export const recalcularHistorialFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ companyId: z.string().uuid(), meses: z.number().int().min(1).max(36).optional() }).parse(data),
  )
  .handler(async ({ data, context }) =>
    envolver(async () => {
      const { recalculateCompanyHistory } = await import("@/lib/taxRecalc.server");
      return recalculateCompanyHistory(context.userId, data);
    }),
  );
