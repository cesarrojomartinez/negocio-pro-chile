import { useState } from "react";
import { Coins, CreditCard, Plus, Sparkles, TrendingUp, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actualizarSaldoCreditoIAFn } from "@/lib/cuenta.functions";
import type { BilleteraIAMaster } from "@/lib/cuenta.server";
import { formatCLP } from "@/utils/currency";

interface AiWalletCardProps {
  billetera: BilleteraIAMaster;
  onActualizado?: () => void;
}

export function AiWalletCard({ billetera, onActualizado }: AiWalletCardProps) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tipo, setTipo] = useState<"asignacion" | "ajuste" | "regalo">("asignacion");
  const [monto, setMonto] = useState("1000");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const porcentajeConsumido =
    billetera.monthlyAllowance > 0
      ? Math.min(100, Math.round((billetera.consumedMonth / billetera.monthlyAllowance) * 100))
      : 0;

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    const amountNum = parseInt(monto, 10);
    if (!isNaN(amountNum) && amountNum > 0) {
      const res = await actualizarSaldoCreditoIAFn({
        data: {
          companyId: billetera.companyId,
          amount: amountNum,
          type: tipo,
          description: descripcion || `Carga manual de crédito (${tipo})`,
        },
      });
      if (res.ok) {
        setModalAbierto(false);
        setMonto("1000");
        setDescripcion("");
        onActualizado?.();
      }
    }
    setGuardando(false);
  };

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-base text-foreground leading-tight">{billetera.companyName}</h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">RUT: {billetera.companyRut}</p>
          </div>
          <Badge variant="outline" className="text-[11px] font-semibold border-primary/20 bg-primary/5 text-primary">
            Plan {billetera.planName}
          </Badge>
        </div>

        {/* Saldo y Asignacion */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3 text-xs">
          <div>
            <span className="text-[11px] text-muted-foreground block">Saldo Disponible</span>
            <span className="text-lg font-black text-emerald-600 font-mono flex items-center gap-1">
              <Coins className="h-4 w-4" /> {billetera.balance.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground block">Cuota Mensual</span>
            <span className="text-sm font-bold text-foreground font-mono">
              {billetera.monthlyAllowance.toLocaleString()} cr.
            </span>
          </div>
        </div>

        {/* Barra de Progreso Consumo */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
            <span>Consumo Mes: {billetera.consumedMonth.toLocaleString()} cr.</span>
            <span>{porcentajeConsumido}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all rounded-full"
              style={{ width: `${porcentajeConsumido}%` }}
            />
          </div>
        </div>

        {/* Costo Estimado IA */}
        <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>Costo estimado IA:</span>
          <span className="font-bold text-foreground font-mono">{formatCLP(billetera.estimatedCostClp)}</span>
        </div>
      </div>

      {/* Botón para cargar / ajustar créditos */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 mt-2">
            <Plus className="h-3.5 w-3.5" />
            Cargar / Ajustar Créditos
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Ajuste de Créditos IA — {billetera.companyName}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleGuardar(e)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Operación</Label>
              <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asignacion" className="text-xs">➕ Carga / Asignación</SelectItem>
                  <SelectItem value="regalo" className="text-xs">🎁 Regalo Promocional</SelectItem>
                  <SelectItem value="ajuste" className="text-xs">⚙️ Ajuste Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Cantidad de Créditos</Label>
              <Input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="1000"
                className="text-xs h-9 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descripción / Motivo</Label>
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Bonificación paquete pro"
                className="text-xs h-9"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={guardando}>
                {guardando ? "Aplicando..." : "Confirmar Carga"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
