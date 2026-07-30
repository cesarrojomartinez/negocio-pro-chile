import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  conectarSiiSimulado,
  desconectarSii,
  listarSincronizaciones,
  obtenerConexionSii,
  syncSiiCompanyPeriod,
} from "@/lib/siiSync.server";
import { envolver } from "@/lib/serverResult";

export const obtenerConexionSiiFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => obtenerConexionSii(context.userId, data.companyId)),
  );

export const conectarSiiFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; consentimiento: boolean }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => conectarSiiSimulado(context.userId, data)),
  );

export const desconectarSiiFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => desconectarSii(context.userId, data)),
  );

export const sincronizarSiiFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      companyId: string;
      periodo: string;
      triggerType?:
        | "manual"
        | "login_refresh"
        | "weekly_refresh"
        | "scheduled"
        | "demo_connect"
        | "retry";
      idempotencyKey?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(() => syncSiiCompanyPeriod(context.userId, data)),
  );

export const listarSincronizacionesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; limite?: number }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => listarSincronizaciones(context.userId, data.companyId, data.limite)),
  );
