import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { envolver } from "@/lib/serverResult";

/**
 * Funciones del proveedor real. La lógica vive en módulos `.server` que se
 * cargan dentro del handler: nunca entran al paquete del navegador.
 */
export const diagnosticarApiGatewayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data?: { probarProductos?: boolean; companyId?: string }) => data ?? {},
  )
  .handler(async ({ data, context }) =>
    envolver(async () => {
      const { exigirRol } = await import("@/lib/companies.server");
      const { diagnoseApiGatewayConfiguration, empresaAutorizadaParaPruebaReal } = await import(
        "@/lib/apiGateway.server"
      );
      const companyId = data.companyId;
      if (companyId) await exigirRol(context.userId, companyId, ["owner"]);
      return diagnoseApiGatewayConfiguration({
        probarProductos: data?.probarProductos === true,
        empresaAutorizada: companyId
          ? empresaAutorizadaParaPruebaReal(companyId)
          : false,
      });
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
      sesionNueva?: boolean;
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

export const auditarF29RealFn = createServerFn({ method: "POST" })
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
      const { auditarF29Real } = await import("@/lib/f29Audit.server");
      return auditarF29Real(context.userId, data);
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

