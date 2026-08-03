import { useState } from "react";
import { BadgePercent, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConfiguracionComercial } from "@/lib/configuracion";

export function TabComercial({
  datos,
  onGuardar,
  onRestablecer,
  guardando,
}: {
  datos: ConfiguracionComercial;
  onGuardar: (valores: ConfiguracionComercial) => void;
  onRestablecer: () => void;
  guardando: boolean;
}) {
  const [form, setForm] = useState<ConfiguracionComercial>(datos);

  const handleChange = (campo: keyof ConfiguracionComercial, valor: any) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BadgePercent className="h-4 w-4 text-primary" /> Parámetros Comerciales & Facturación
              </CardTitle>
              <CardDescription className="text-xs">
                Configura la moneda por defecto, impuestos generales, días de prueba y reglas de promociones.
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
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Moneda Base</Label>
              <Input
                value={form.moneda}
                onChange={(e) => handleChange("moneda", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>IVA por Defecto (%)</Label>
              <Input
                type="number"
                value={form.ivaPorDefecto}
                onChange={(e) => handleChange("ivaPorDefecto", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Días de Trial Gratuito</Label>
              <Input
                type="number"
                value={form.diasTrial}
                onChange={(e) => handleChange("diasTrial", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Plan Asignado por Defecto</Label>
              <Input
                value={form.planPorDefecto}
                onChange={(e) => handleChange("planPorDefecto", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            Campañas Promocionales & Cupones
          </CardTitle>
          <CardDescription className="text-xs">
            Gestión de cupones de descuento automáticos para nuevos registros.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <Label className="font-semibold">Activar Promoción General</Label>
            <Switch
              checked={form.promocionActiva}
              onCheckedChange={(val) => handleChange("promocionActiva", val)}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Código Promocional</Label>
              <Input
                value={form.codigoDescuento}
                onChange={(e) => handleChange("codigoDescuento", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Porcentaje Descuento (%)</Label>
              <Input
                type="number"
                value={form.valorDescuentoPorcentaje}
                onChange={(e) => handleChange("valorDescuentoPorcentaje", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha Inicio Promoción</Label>
              <Input
                type="date"
                value={form.fechaInicioPromocion}
                onChange={(e) => handleChange("fechaInicioPromocion", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha Término Promoción</Label>
              <Input
                type="date"
                value={form.fechaTerminoPromocion}
                onChange={(e) => handleChange("fechaTerminoPromocion", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
