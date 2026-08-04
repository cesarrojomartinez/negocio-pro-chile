import { useState } from "react";
import { Cpu, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConfiguracionIaGateway } from "@/lib/configuracion";
import { formatCLP } from "@/utils/currency";

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
                <Cpu className="h-4 w-4 text-purple-500" /> Centro Económico del Gateway IA
              </CardTitle>
              <CardDescription className="text-xs">
                Administra los costos de infraestructura, valor del crédito y margen comercial del Gateway IA.
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
              <Label>Costo Mensual Infraestructura (CLP)</Label>
              <Input
                type="number"
                value={form.costoMensualInfraestructuraClp}
                onChange={(e) => handleChange("costoMensualInfraestructuraClp", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Costo Promedio Procesamiento (CLP)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.costoPromedioProcesamientoClp}
                onChange={(e) => handleChange("costoPromedioProcesamientoClp", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Costo OCR por Documento (CLP)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.costoOcrDocumentoClp}
                onChange={(e) => handleChange("costoOcrDocumentoClp", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Costo Procesamiento Adicional (CLP)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.costoProcesamientoAdicionalClp}
                onChange={(e) => handleChange("costoProcesamientoAdicionalClp", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Margen Plataforma (%)</Label>
              <Input
                type="number"
                step="1"
                value={form.margenPlataformaPorcentaje}
                onChange={(e) => handleChange("margenPlataformaPorcentaje", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Costo Mínimo por Operación (CLP)</Label>
              <Input
                type="number"
                step="0.5"
                value={form.costoMinimoOperacionClp}
                onChange={(e) => handleChange("costoMinimoOperacionClp", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-purple-500/5 text-xs text-purple-700 dark:text-purple-300 flex items-center justify-between font-medium">
            <span>Valor de 1 Crédito IA</span>
            <span className="font-bold text-sm">{formatCLP(form.valorUnCreditoClp)}</span>
          </div>

          <div className="p-3.5 rounded-xl border bg-muted/40 text-xs text-foreground flex items-center justify-between font-medium">
            <span>Créditos por llamada al API Gateway</span>
            <span className="font-bold text-sm">{form.creditosPorLlamadaGateway ?? 10} créditos</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
