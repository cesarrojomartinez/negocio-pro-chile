import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";

import { PlanEditor } from "@/components/master/plans/PlanEditor";
import { Button } from "@/components/ui/button";
import { listarPlanesMasterAdminFn } from "@/lib/cuenta.functions";
import type { PlanMaster } from "@/lib/cuenta.server";

export const Route = createFileRoute("/admin/planes/$planId")({
  component: EditarPlanMasterPage,
});

function EditarPlanMasterPage() {
  const { planId } = Route.useParams();
  const [plan, setPlan] = useState<PlanMaster | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      const res = await listarPlanesMasterAdminFn();
      if (res.ok) {
        const encontrado = res.data.find((p) => p.id === planId);
        if (encontrado) {
          setPlan(encontrado);
          setError(null);
        } else {
          setError("El plan indicado no existe o fue eliminado.");
        }
      } else {
        setError(res.error);
      }
      setCargando(false);
    };

    void cargar();
  }, [planId]);

  if (cargando) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Cargando plan...
        </p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="text-base font-bold text-destructive font-sans">Error al cargar el plan</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/planes">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Volver a Planes
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Editar Plan: {plan.name}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Modifica los parámetros comerciales, tarifas y capacidades habilitadas de este plan.
        </p>
      </div>

      <PlanEditor planExistente={plan} />
    </div>
  );
}
