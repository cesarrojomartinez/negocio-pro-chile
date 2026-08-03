import { useState } from "react";
import { Bot, Cpu, Filter, Search, Sparkles, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConsumoIAMaster } from "@/lib/cuenta.server";
import { formatCLP, formatFechaHora } from "@/utils/currency";

interface AiUsageTableProps {
  consumos: ConsumoIAMaster[];
}

export function AiUsageTable({ consumos }: AiUsageTableProps) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("todos");

  const filtrados = consumos.filter((c) => {
    const coincideBusqueda = `${c.companyName} ${c.actionType} ${c.userName}`
      .toLowerCase()
      .includes(busqueda.trim().toLowerCase());

    const coincideProv = filtroProveedor === "todos" ? true : c.provider.toLowerCase().includes(filtroProveedor);
    return coincideBusqueda && coincideProv;
  });

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por Empresa, Usuario o Acción..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Proveedor:
          </span>
          {[
            { id: "todos", label: "Todos" },
            { id: "gemini", label: "Motor Primario" },
            { id: "claude", label: "Motor Avanzado" },
            { id: "openai", label: "Motor Rápido" },
          ].map((p) => (
            <Button
              key={p.id}
              variant={filtroProveedor === p.id ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs px-2.5"
              onClick={() => setFiltroProveedor(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y">
            <thead className="bg-muted/50 font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Fecha y Hora</th>
                <th className="p-3">Empresa</th>
                <th className="p-3">Acción IA</th>
                <th className="p-3">Proveedor</th>
                <th className="p-3 text-right">Créditos Usados</th>
                <th className="p-3 text-right">Costo Estimado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No se encontraron registros de consumo de IA.
                  </td>
                </tr>
              ) : (
                filtrados.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-muted-foreground">
                      {formatFechaHora(c.createdAt)}
                    </td>
                    <td className="p-3 font-bold text-foreground">{c.companyName}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px] capitalize bg-muted/40">
                        {c.actionType.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-muted-foreground flex items-center gap-1">
                      <Bot className="h-3.5 w-3.5 text-primary" /> {c.provider}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600">
                      {c.creditsUsed.toLocaleString()} cr.
                    </td>
                    <td className="p-3 text-right font-mono font-medium text-foreground">
                      {formatCLP(c.estimatedCostClp)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
