import { TrendingUp } from "lucide-react";
import { DataRow, SectionCard } from "@/components/shared/SectionCard";
import { formatCLP } from "@/utils/currency";
import type { Proyeccion } from "@/types/tax";

export function ProyeccionCard({ proyeccion }: { proyeccion: Proyeccion }) {
  return (
    <SectionCard
      titulo="Proyección al cierre del mes"
      descripcion="Estimación construida con tu ritmo actual de ventas."
      acciones={<TrendingUp className="h-5 w-5 text-primary" aria-hidden />}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">Proyección conservadora</p>
          <p className="num-md mt-1 text-lg">{formatCLP(proyeccion.conservadora)}</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-info-soft p-3">
          <p className="text-xs text-muted-foreground">Proyección probable</p>
          <p className="num-md mt-1 text-lg text-primary">
            {formatCLP(proyeccion.probable)}
          </p>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">Proyección alta</p>
          <p className="num-md mt-1 text-lg">{formatCLP(proyeccion.alta)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-secondary/60 p-4">
        <DataRow
          label="Ventas actuales"
          value={formatCLP(proyeccion.ventasActuales)}
        />
        <DataRow
          label="Promedio diario"
          value={formatCLP(proyeccion.promedioDiario)}
        />
        <DataRow
          label="Impuestos proyectados al cierre"
          value={`entre ${formatCLP(proyeccion.impuestosMin)} y ${formatCLP(proyeccion.impuestosMax)}`}
          strong
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Esta proyección utiliza el ritmo actual de ventas y puede cambiar durante el
        mes.
      </p>
    </SectionCard>
  );
}
