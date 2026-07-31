import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { envolver } from "@/lib/serverResult";
import type { CambioPreferencias } from "@/lib/syncPreferences.server";

/**
 * Preferencias de actualización. Ninguna de estas funciones recibe ni devuelve
 * la Clave Tributaria.
 */
export const obtenerPreferenciasSyncFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(async () => {
      const { obtenerPreferenciasSync } = await import("@/lib/syncPreferences.server");
      return obtenerPreferenciasSync(context.userId, data.companyId);
    }),
  );

export const actualizarPreferenciasSyncFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CambioPreferencias) => data)
  .handler(async ({ data, context }) =>
    envolver(async () => {
      const { actualizarPreferenciasSync } = await import(
        "@/lib/syncPreferences.server"
      );
      return actualizarPreferenciasSync(context.userId, data);
    }),
  );
