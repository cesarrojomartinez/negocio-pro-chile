/**
 * Funciones de Servidor para SimpleAPI y Comparación Dual de Proveedores.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { envolver } from "@/lib/serverResult";

export const healthCheckSimpleApiFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { baseUrl?: string }) => data ?? {})
  .handler(async ({ data }) =>
    envolver(async () => {
      const { SimpleApiProviderAdapter } = await import(
        "@/integrations/sii/simpleApiProviderAdapter"
      );
      // Reads process.env.SIMPLEAPI_API_KEY securely on server side
      const adapter = new SimpleApiProviderAdapter({
        baseUrl: data?.baseUrl,
      });
      return adapter.healthCheck();
    }),
  );

export const compararProveedoresFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      companyId: string;
      rutEmpresa: string;
      periodo: string;
      usarMockParaGateway?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(async () => {
      const { exigirRol } = await import("@/lib/companies.server");
      const { compararProveedoresTributarios } = await import(
        "@/lib/providerComparison.server"
      );
      await exigirRol(context.userId, data.companyId, ["owner"]);
      return compararProveedoresTributarios(data);
    }),
  );

export const guardarConfiguracionProveedorFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      modoProveedor: "api_gateway" | "simple_api" | "automatic" | "compare";
      endpointSimpleApi?: string;
    }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(async () => {
      const {
        obtenerConfiguracionGlobalMaster,
        guardarGrupoConfiguracionMaster,
      } = await import("@/lib/configuracion.server");

      const actual = await obtenerConfiguracionGlobalMaster(context.userId);

      const nuevoGrupoGateway = {
        ...actual.gateway_api,
        modoProveedor: data.modoProveedor,
        ...(data.endpointSimpleApi !== undefined
          ? { endpointSimpleApi: data.endpointSimpleApi }
          : {}),
        proveedorActual:
          data.modoProveedor === "simple_api"
            ? "SimpleAPI Chile (API Directa)"
            : data.modoProveedor === "compare"
              ? "Modo Comparación Dual (Gateway vs SimpleAPI)"
              : data.modoProveedor === "automatic"
                ? "Conmutación Automática de Proveedor"
                : "SII Gateway Core (Dual Engine v2.4)",
      };

      await guardarGrupoConfiguracionMaster(
        context.userId,
        "gateway_api",
        nuevoGrupoGateway,
      );

      return { exito: true, configuracion: nuevoGrupoGateway };
    }),
  );
