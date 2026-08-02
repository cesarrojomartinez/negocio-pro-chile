import { Activity } from "lucide-react";

interface UsageChartProps {
  historial: { mes: string; syncs: number; dtes: number; ia: number }[];
}

export function UsageChart({ historial }: UsageChartProps) {
  const maxUso = historial.reduce((max, h) => (h.dtes > max ? h.dtes : max), 1);

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Activity className="h-4 w-4 text-info" /> Volumen de Uso y Carga de la Plataforma
        </h3>
        <span className="text-xs font-mono text-muted-foreground">Documentos & Syncs SII</span>
      </div>

      <div className="flex h-48 items-end gap-2 pt-6 pb-2 border-b overflow-x-auto">
        {historial.map((h) => {
          const pctAltura = Math.max(12, Math.round((h.dtes / maxUso) * 100));

          return (
            <div
              key={h.mes}
              className="flex-1 flex flex-col items-center gap-1 min-w-[24px] group relative"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-20 rounded-lg bg-popover p-2 text-[10px] text-popover-foreground shadow-md border whitespace-nowrap">
                <div className="font-bold">{h.mes}</div>
                <div>Documentos DTE: {h.dtes}</div>
                <div>Syncs SII: {h.syncs}</div>
                <div>Consultas IA: {h.ia}</div>
              </div>

              <div
                className="w-full bg-info/80 rounded-t transition-all group-hover:bg-info"
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
