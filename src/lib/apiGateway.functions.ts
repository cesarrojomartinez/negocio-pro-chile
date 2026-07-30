import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { envolver } from "@/lib/serverResult";

/**
 * Funciones del proveedor real. La lógica vive en módulos `.server` que se
 * cargan dentro del handler: nunca entran al paquete del navegador.
 */
export const diagnosticarApiGatewayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () =>
    envolver(async () => {
      const { diagnoseApiGatewayConfiguration } = await import(
        "@/lib/apiGateway.server"
      );
      return diagnoseApiGatewayConfiguration();
    }),
  );

export const pruebaRealApiGatewayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      companyId: string;
      periodo: string;
      rutUsuario: string;
      claveTributaria: string;
      consentimiento: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(async () => {
      const { ejecutarPruebaRealApiGateway } = await import(
        "@/lib/apiGatewayReal.server"
      );
      return ejecutarPruebaRealApiGateway(context.userId, data);
    }),
  );

export const desconectarApiGatewayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(async () => {
      const { desconectarPruebaReal } = await import("@/lib/apiGatewayReal.server");
      await desconectarPruebaReal(context.userId, data.companyId);
      return true;
    }),
  );
