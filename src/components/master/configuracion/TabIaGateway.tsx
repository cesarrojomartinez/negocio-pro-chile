import { useState } from "react";
import { Cpu, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConfiguracionIaGateway } from "@/lib/configuracion";

export function TabIaGateway({
  datos,
  onGuardar,
  onRestablecer,
  guardando,
}: {
  datos: ConfiguracionIaGateway;
  onGuardar: (valores: ConfiguracionIaGateway) => void;
  onRestablecer: () => void;
  guardando: boolean;
}) {
  const [form, setForm] = useState<ConfiguracionIaGateway>(datos);

  const handleChange = (campo: keyof ConfiguracionIaGateway, valor: any) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Cpu className="h-4 w-4 text-purple-500" /> Gateway de Créditos y Tarifas IA
              </CardTitle>
              <CardDescription className="text-xs">
                Administra los costos por mil tokens, modelos de procesamiento y margen comercial de créditos IA.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onRestablecer} disabled={guardando}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restablecer
              </Button>
              <Button size="sm" onClick={() => onGuardar(form)} disabled={guardando}>
                <Save className="h-3.5 w-3.5 mr-1" /> {guardando ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Proveedor IA</Label>
              <Input
                value={form.proveedor}
                onChange={(e) => handleChange("proveedor", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo Activo</Label>
              <Input
                value={form.modelo}
                onChange={(e) => handleChange("modelo", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Costo Entrada (por 1k tokens CLP)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.costoEntradaPorMilTokensClp}
                onChange={(e) => handleChange("costoEntradaPorMilTokensClp", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Costo Salida (por 1k tokens CLP)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.costoSalidaPorMilTokensClp}
                onChange={(e) => handleChange("costoSalidaPorMilTokensClp", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Margen Plataforma (Multiplicador)</Label>
              <Input
                type="number"
                step="0.05"
                value={form.margenPlataformaMultiplicador}
                onChange={(e) => handleChange("margenPlataformaMultiplicador", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Costo Promedio por Consulta (CLP)</Label>
              <Input
                type="number"
                step="0.5"
                value={form.costoPromedioConsultaClp}
                onChange={(e) => handleChange("costoPromedioConsultaClp", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-purple-500/5 text-xs text-purple-700 dark:text-purple-300 flex items-center justify-between font-medium">
            <span>Consumo Mensual de Créditos IA Acumulado</span>
            <span className="font-bold text-sm">{form.consumoMensualCreditos.toLocaleString("es-CL")} unidades</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
