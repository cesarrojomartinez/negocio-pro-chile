import { createFileRoute } from "@tanstack/react-router";
import { PlanEditor } from "@/components/master/plans/PlanEditor";

export const Route = createFileRoute("/admin/planes/nuevo")({
  component: CrearPlanMasterPage,
});

function CrearPlanMasterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crear Nuevo Plan Comercial</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Configura un nuevo plan de suscripción con límites cuantitativos y privilegios funcionales.
        </p>
      </div>

      <PlanEditor />
    </div>
  );
}
