import { createFileRoute } from "@tanstack/react-router";
import { AiPricingRules } from "@/components/master/ai/AiPricingRules";

export const Route = createFileRoute("/admin/ia-creditos/configuracion")({
  component: IaConfiguracionPage,
});

function IaConfiguracionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración de Tarifas y Proveedores IA</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Ajusta costos de API, multiplicadores de margen comercial y equivalencias de créditos por llamada.
        </p>
      </div>

      <AiPricingRules />
    </div>
  );
}
