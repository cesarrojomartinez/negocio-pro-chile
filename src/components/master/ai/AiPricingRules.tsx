import { useState } from "react";
import { Bot, Check, DollarSign, Layers, Lock, Save, ShieldAlert, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCLP } from "@/utils/currency";

export function AiPricingRules() {
  const [proveedorActivo, setProveedorActivo] = useState("gemini");
  const [costoBaseUsd, setCostoBaseUsd] = useState("0.02");
  const [creditosPorCall, setCreditosPorCall] = useState("100");
  const [multiplicadorMargen, setMultiplicadorMargen] = useState("1.8");
  const [guardado, setGuardado] = useState(false);

  const costoClpCalculado = Math.round(parseFloat(costoBaseUsd || "0") * 980);
  const precioClienteCalculado = Math.round(costoClpCalculado * parseFloat(multiplicadorMargen || "1"));

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
  };

  return (
    <form onSubmit={handleGuardar} className="space-y-6">
      {/* Configuración Proveedor Principal */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Reglas de Precios & Proveedores IA</h3>
          </div>
          <Badge variant="outline" className="text-xs font-mono bg-emerald-50 text-emerald-700 border-emerald-500/30">
            🟢 Motor IA Operativo
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Proveedor Principal de IA</Label>
            <Select value={proveedorActivo} onValueChange={setProveedorActivo}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini" className="text-xs">Google Gemini 1.5 Flash / Pro</SelectItem>
                <SelectItem value="openai" className="text-xs">OpenAI GPT-4o / Mini</SelectItem>
                <SelectItem value="claude" className="text-xs">Anthropic Claude 3.5 Sonnet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Costo Base Proveedor (USD / llamada)</Label>
            <Input
              value={costoBaseUsd}
              onChange={(e) => setCostoBaseUsd(e.target.value)}
              className="text-xs h-9 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Créditos Internos por Llamada</Label>
            <Input
              value={creditosPorCall}
              onChange={(e) => setCreditosPorCall(e.target.value)}
              className="text-xs h-9 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Multiplicador de Margen Comercial</Label>
            <Input
              value={multiplicadorMargen}
              onChange={(e) => setMultiplicadorMargen(e.target.value)}
              className="text-xs h-9 font-mono"
            />
          </div>
        </div>

        {/* Tarjeta Resumen Cálculo Automático */}
        <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-xs">
          <h4 className="font-bold text-foreground flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-emerald-600" /> Cálculo Tarifario Automático
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <span className="text-muted-foreground block text-[11px]">Costo Estimado CLP (Dólar $980):</span>
              <span className="font-mono font-bold text-foreground text-sm">{formatCLP(costoClpCalculado)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Precio Cliente Venta:</span>
              <span className="font-mono font-bold text-emerald-600 text-sm">{formatCLP(precioClienteCalculado)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Margen Bruto Estimado:</span>
              <span className="font-mono font-bold text-primary text-sm">
                {Math.round((parseFloat(multiplicadorMargen) - 1) * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Botón Guardar */}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="submit" size="sm" className="text-xs gap-1.5">
            {guardado ? <Check className="h-4 w-4 text-emerald-400" /> : <Save className="h-4 w-4" />}
            {guardado ? "Configuración Guardada" : "Guardar Cambios Tarifarios"}
          </Button>
        </div>
      </div>
    </form>
  );
}
