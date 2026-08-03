import { createFileRoute, useRouter } from "@tanstack/react-router";
import { AiPricingRules } from "@/components/master/ai/AiPricingRules";
import { obtenerConfiguracionGlobalMasterFn } from "@/lib/configuracion.functions";
import { CONFIGURACION_POR_DEFECTO } from "@/lib/configuracion";

export const Route = createFileRoute("/admin/ia-creditos/configuracion")({
  loader: () => obtenerConfiguracionGlobalMasterFn(),
  component: IaConfiguracionPage,
});

function IaConfiguracionPage() {
  const loaderData = Route.useLoaderData();
  const router = useRouter();

  const datosIa = loaderData.ok ? loaderData.data.ia_gateway : CONFIGURACION_POR_DEFECTO.ia_gateway;

  return (
    <div className="space-y-6">
      <div>
      <h1 className="text-2xl font-bold tracking-tight">Centro Económico de Créditos IA</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Configura costos de infraestructura, valor del crédito, catálogo de operaciones y simula la rentabilidad económica del Gateway IA.
        </p>
      </div>

      <AiPricingRules
        datosIniciales={datosIa}
        onActualizado={() => router.invalidate()}
      />
    </div>
  );
}
