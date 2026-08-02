import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  tendenciaPct?: number;
  icono: LucideIcon;
  color?: string;
}

export function MetricCard({
  titulo,
  valor,
  subtitulo,
  tendenciaPct,
  icono: Icono,
}: MetricCardProps) {
  const esPositivo = (tendenciaPct ?? 0) >= 0;

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2 flex flex-col justify-between">
      <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
        <span>{titulo}</span>
        <Icono className="h-4 w-4 text-primary" />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-black tracking-tight text-foreground tabular-nums">{valor}</span>
          {tendenciaPct !== undefined && (
            <span
              className={cn(
                "text-xs font-bold font-mono flex items-center gap-0.5",
                esPositivo ? "text-emerald-600" : "text-rose-600",
              )}
            >
              {esPositivo ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {esPositivo ? "+" : ""}
              {tendenciaPct}%
            </span>
          )}
        </div>
      </div>

      {subtitulo && <p className="text-[11px] text-muted-foreground pt-2 border-t">{subtitulo}</p>}
    </div>
  );
}
