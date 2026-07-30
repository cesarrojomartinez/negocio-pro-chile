import { FlaskConical } from "lucide-react";
import { ESCENARIOS } from "@/data/mockTaxData";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";
import type { EscenarioId } from "@/types/company";
import { cn } from "@/lib/utils";

export function ScenarioSwitcher({ compacto = false }: { compacto?: boolean }) {
  const { escenario, setEscenario } = useTaxDashboard();

  return (
    <div className="card-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">Escenario demostrativo</h2>
      </div>
      <div
        role="radiogroup"
        aria-label="Escenario demostrativo"
        className="grid gap-2 sm:grid-cols-3"
      >
        {ESCENARIOS.map((e) => {
          const activo = e.id === escenario;
          return (
            <button
              key={e.id}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => setEscenario(e.id as EscenarioId)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                activo
                  ? "border-primary bg-info-soft"
                  : "border-border bg-card hover:bg-secondary",
              )}
            >
              <p className="text-sm font-semibold">{e.nombre}</p>
              {!compacto && (
                <p className="mt-1 text-xs text-muted-foreground">{e.descripcion}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
