import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { envolver } from "@/lib/serverResult";
import type { CambioConfiguracionOpcional } from "@/lib/mirror/optionalConfig.server";

/**
 * Configuración tributaria opcional ("Mejorar precisión de los cálculos").
 * Todo es opcional: si no se declara nada, la aplicación funciona igual.
 */
export const listarConfiguracionTributariaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(async () => {
      const { listarConfiguracionOpcional } = await import(
        "@/lib/mirror/optionalConfig.server"
      );
      return listarConfiguracionOpcional(context.userId, data.companyId);
    }),
  );

export const guardarConfiguracionTributariaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CambioConfiguracionOpcional) => data)
  .handler(async ({ data, context }) =>
    envolver(async () => {
      const { guardarConfiguracionOpcional } = await import(
        "@/lib/mirror/optionalConfig.server"
      );
      return guardarConfiguracionOpcional(context.userId, data);
    }),
  );

export const revocarConfiguracionTributariaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; id: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(async () => {
      const { revocarConfiguracionOpcional } = await import(
        "@/lib/mirror/optionalConfig.server"
      );
      return revocarConfiguracionOpcional(context.userId, data);
    }),
  );
