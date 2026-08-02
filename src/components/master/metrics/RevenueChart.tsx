import { BarChart3, DollarSign, TrendingUp } from "lucide-react";
import { formatCLP } from "@/utils/currency";

interface RevenueChartProps {
  historial: { mes: string; mrr: number; clientes: number }[];
}

export function RevenueChart({ historial }: RevenueChartProps) {
  const maxMrr = historial.reduce((max, h) => (h.mrr > max ? h.mrr : max), 1);

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600" /> Crecimiento MRR / Ingreso Recurrente Mensual
        </h3>
        <span className="text-xs font-mono font-semibold text-emerald-600">
          Últimos 12 Meses
        </span>
      </div>

      <div className="flex h-48 items-end gap-2 pt-6 pb-2 border-b overflow-x-auto">
        {historial.map((h) => {
          const pctAltura = Math.max(12, Math.round((h.mrr / maxMrr) * 100));

          return (
            <div
              key={h.mes}
              className="flex-1 flex flex-col items-center gap-1 min-w-[24px] group relative"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-20 rounded-lg bg-popover p-2 text-[10px] text-popover-foreground shadow-md border whitespace-nowrap">
                <div className="font-bold">{h.mes}</div>
                <div>MRR: {formatCLP(h.mrr)}</div>
                <div>Clientes: {h.clientes}</div>
              </div>

              <div
                className="w-full bg-emerald-500 rounded-t transition-all group-hover:bg-emerald-400"
                style={{ height: `${pctAltura}%` }}
              />
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
