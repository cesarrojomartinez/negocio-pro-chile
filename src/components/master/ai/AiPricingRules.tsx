import { useState } from "react";
import { ArrowRight, Bot, Check, Cpu, DollarSign, Layers, Lock, Save, ShieldAlert, Sparkles, TrendingUp, Zap } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { guardarGrupoConfiguracionMasterFn } from "@/lib/configuracion.functions";
import type { ConfiguracionIaGateway } from "@/lib/configuracion";
import { formatCLP } from "@/utils/currency";

interface AiPricingRulesProps {
  datosIniciales?: ConfiguracionIaGateway;
  onActualizado?: () => void;
}

export function AiPricingRules({ datosIniciales, onActualizado }: AiPricingRulesProps) {
  const [proveedorActivo, setProveedorActivo] = useState(datosIniciales?.proveedor ?? "gemini");
  const [modeloActivo, setModeloActivo] = useState(datosIniciales?.modelo ?? "gateway-ia-auto");
  const [costoBaseUsd, setCostoBaseUsd] = useState(String(datosIniciales?.costoEntradaPorMilTokensClp ?? "0.02"));
  const [creditosPorCall, setCreditosPorCall] = useState("100");
  const [multiplicadorMargen, setMultiplicadorMargen] = useState(String(datosIniciales?.margenPlataformaMultiplicador ?? "1.8"));
  const [guardando, setGuardando] = useState(false);
  const [guardadoExito, setGuardadoExito] = useState(false);

  const costoClpCalculado = Math.round(parseFloat(costoBaseUsd || "0") * 980);
  const precioClienteCalculado = Math.round(costoClpCalculado * parseFloat(multiplicadorMargen || "1"));
  const margenPorcentaje = Math.round((parseFloat(multiplicadorMargen || "1") - 1) * 100);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);

    const payload: ConfiguracionIaGateway = {
      proveedor: proveedorActivo,
      modelo: modeloActivo,
      costoEntradaPorMilTokensClp: parseFloat(costoBaseUsd) || 0.15,
      costoSalidaPorMilTokensClp: Math.round((parseFloat(costoBaseUsd) || 0.15) * 3 * 100) / 100,
      margenPlataformaMultiplicador: parseFloat(multiplicadorMargen) || 1.8,
      costoPromedioConsultaClp: precioClienteCalculado || 12.5,
      consumoMensualCreditos: datosIniciales?.consumoMensualCreditos ?? 18500,
    };

    const res = await guardarGrupoConfiguracionMasterFn({
      data: { grupo: "ia_gateway", valores: payload },
    });

    setGuardando(false);

    if (!res.ok) {
      toast.error(res.error || "Error al guardar la configuración del Gateway IA.");
      return;
    }

    toast.success("Configuración del Gateway IA guardada y persistida correctamente.");
    setGuardadoExito(true);
    setTimeout(() => setGuardadoExito(false), 3000);
    if (onActualizado) onActualizado();
  };

  return (
    <form onSubmit={handleGuardar} className="space-y-6">
      {/* EXPLICACIÓN VISUAL DEL FLUJO DE CRÉDITOS IA */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Cpu className="h-4 w-4 text-purple-600" /> Flujo Económico del Gateway IA
          </h3>
          <Badge variant="outline" className="text-[11px] font-mono bg-purple-50 text-purple-700 border-purple-300">
            Pipeline de Precios & Créditos
          </Badge>
        </div>

        {/* Diagrama de Pasos */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center text-xs pt-1">
          <div className="rounded-xl border bg-muted/40 p-2.5 space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">1. Costo Proveedor</span>
            <div className="font-mono font-bold text-foreground">{formatCLP(costoClpCalculado)}</div>
            <span className="text-[9px] text-muted-foreground block">USD → CLP ($980)</span>
          </div>

          <div className="flex items-center justify-center text-muted-foreground hidden md:flex">
            <ArrowRight className="h-4 w-4" />
          </div>

          <div className="rounded-xl border bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 p-2.5 space-y-1">
            <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300 block">2. Gateway IA</span>
            <div className="font-mono font-bold text-purple-700 dark:text-purple-300">Consumo Tokens</div>
            <span className="text-[9px] text-muted-foreground block">In/Out por consulta</span>
          </div>

          <div className="flex items-center justify-center text-muted-foreground hidden md:flex">
            <ArrowRight className="h-4 w-4" />
          </div>

          <div className="rounded-xl border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-2.5 space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 block">3. Créditos Internos</span>
            <div className="font-mono font-bold text-amber-700 dark:text-amber-300">{creditosPorCall} cr/call</div>
            <span className="text-[9px] text-muted-foreground block">Equivalencia interna</span>
          </div>

          <div className="rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 p-2.5 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">4. Precio & Margen</span>
            <div className="font-mono font-bold text-emerald-700 dark:text-emerald-300">{formatCLP(precioClienteCalculado)}</div>
            <span className="text-[9px] text-emerald-600 block">+{margenPorcentaje}% margen</span>
          </div>
        </div>
      </div>

      {/* FORMULARIO DE REGLAS DE PRECIOS */}
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
            <Label className="text-xs font-medium">Motor Principal de IA</Label>
            <Select value={proveedorActivo} onValueChange={setProveedorActivo}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini" className="text-xs">Motor IA Primario (Gateway IA)</SelectItem>
                <SelectItem value="openai" className="text-xs">Motor IA Alta Velocidad (Gateway IA)</SelectItem>
                <SelectItem value="claude" className="text-xs">Motor IA Razonamiento Avanzado (Gateway IA)</SelectItem>
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

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Modelo Identificador Activo</Label>
            <Input
              value={modeloActivo}
              onChange={(e) => setModeloActivo(e.target.value)}
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
                {margenPorcentaje}%
              </span>
            </div>
          </div>
        </div>

        {/* Botón Guardar */}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="submit" size="sm" disabled={guardando} className="text-xs gap-1.5">
            {guardadoExito ? <Check className="h-4 w-4 text-emerald-400" /> : <Save className="h-4 w-4" />}
            {guardando ? "Guardando..." : guardadoExito ? "Configuración Guardada" : "Guardar Cambios Tarifarios"}
          </Button>
        </div>
      </div>
    </form>
  );
}
