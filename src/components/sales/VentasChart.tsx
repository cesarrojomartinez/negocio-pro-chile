import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCLP } from "@/utils/currency";

export function VentasChart({
  serie,
}: {
  serie: { fecha: string; monto: number }[];
}) {
  const data = serie.map((d) => ({
    dia: new Date(d.fecha).getDate().toString(),
    monto: d.monto,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
          <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis
            tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
            tickLine={false}
            axisLine={false}
            width={44}
            fontSize={11}
          />
          <Tooltip
            formatter={(v: number) => [formatCLP(v), "Ventas"]}
            labelFormatter={(l: string) => `Día ${l}`}
          />
          <Bar
            dataKey="monto"
            fill="var(--color-primary)"
            radius={[6, 6, 0, 0]}
            name="Ventas"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
