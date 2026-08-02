import { Users } from "lucide-react";

interface CustomerGrowthChartProps {
  historial: { mes: string; activos: number; trial: number; churn: number }[];
}

export function CustomerGrowthChart({ historial }: CustomerGrowthChartProps) {
  const maxClientes = historial.reduce((max, h) => {
    const total = h.activos + h.trial + h.churn;
    return total > max ? total : max;
  }, 1);

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Distribución y Crecimiento de Clientes
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Activos
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Trial
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Churn
          </span>
        </div>
      </div>

      <div className="flex h-48 items-end gap-2 pt-6 pb-2 border-b overflow-x-auto">
        {historial.map((h) => {
          const total = h.activos + h.trial + h.churn;
          const pctAltura = Math.max(12, Math.round((total / maxClientes) * 100));

          return (
            <div
              key={h.mes}
              className="flex-1 flex flex-col items-center gap-1 min-w-[24px] group relative"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-20 rounded-lg bg-popover p-2 text-[10px] text-popover-foreground shadow-md border whitespace-nowrap">
                <div className="font-bold">{h.mes}</div>
                <div>Activos: {h.activos}</div>
                <div>Trial: {h.trial}</div>
                <div>Churn: {h.churn}</div>
              </div>

              <div
                className="w-full rounded-t transition-all flex flex-col overflow-hidden"
                style={{ height: `${pctAltura}%` }}
              >
                <div className="bg-primary w-full flex-1" />
                <div className="bg-amber-500 w-full h-2" />
                {h.churn > 0 && <div className="bg-rose-500 w-full h-1.5" />}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono truncate w-full text-center">
                {h.mes}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
