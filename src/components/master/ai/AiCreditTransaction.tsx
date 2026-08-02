import { ArrowDownRight, ArrowUpRight, Coins, Gift, RefreshCw, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TransaccionCreditoIAMaster } from "@/lib/cuenta.server";
import { cn } from "@/lib/utils";
import { formatFechaHora } from "@/utils/currency";

interface AiCreditTransactionProps {
  movimientos: TransaccionCreditoIAMaster[];
}

export function AiCreditTransaction({ movimientos }: AiCreditTransactionProps) {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      <div className="p-4 border-b bg-muted/30">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" /> Historial de Movimientos de Saldo IA ({movimientos.length})
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs divide-y">
          <thead className="bg-muted/50 font-semibold text-muted-foreground">
            <tr>
              <th className="p-3">Fecha y Hora</th>
              <th className="p-3">Empresa</th>
              <th className="p-3">Tipo</th>
              <th className="p-3 text-right">Monto Créditos</th>
              <th className="p-3">Descripción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {movimientos.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  Sin registro de transacciones de saldo de crédito IA.
                </td>
              </tr>
            ) : (
              movimientos.map((m) => {
                const esIncremento = m.type === "asignacion" || m.type === "regalo";
                return (
                  <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-muted-foreground">
                      {formatFechaHora(m.createdAt)}
                    </td>
                    <td className="p-3 font-bold text-foreground">{m.companyName}</td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] capitalize font-medium gap-1",
                          m.type === "asignacion"
                            ? "border-emerald-500/30 bg-emerald-50 text-emerald-700"
                            : m.type === "regalo"
                              ? "border-purple-500/30 bg-purple-50 text-purple-700"
                              : m.type === "consumo"
                                ? "border-amber-500/30 bg-amber-50 text-amber-700"
                                : "border-secondary text-muted-foreground",
                        )}
                      >
                        {m.type === "regalo" ? (
                          <Gift className="h-3 w-3" />
                        ) : esIncremento ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {m.type}
                      </Badge>
                    </td>
                    <td
                      className={cn(
                        "p-3 text-right font-mono font-bold text-sm",
                        esIncremento ? "text-emerald-600" : "text-amber-600",
                      )}
                    >
                      {esIncremento ? "+" : "-"}{m.amount.toLocaleString()} cr.
                    </td>
                    <td className="p-3 text-muted-foreground text-[11px] max-w-xs truncate">
                      {m.description}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
