import { useState } from "react";
import { Palette, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConfiguracionBranding } from "@/lib/configuracion";

export function TabBranding({
  datos,
  onGuardar,
  onRestablecer,
  guardando,
}: {
  datos: ConfiguracionBranding;
  onGuardar: (valores: ConfiguracionBranding) => void;
  onRestablecer: () => void;
  guardando: boolean;
}) {
  const [form, setForm] = useState<ConfiguracionBranding>(datos);

  const handleColor = (color: keyof ConfiguracionBranding["colores"], valor: string) => {
    setForm((prev) => ({
      ...prev,
      colores: { ...prev.colores, [color]: valor },
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" /> Branding & Paleta de Colores
              </CardTitle>
              <CardDescription className="text-xs">
                Personaliza la paleta institucional, tipografía y estilos del diseño.
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
              <Label>Color Primario</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  className="w-12 h-9 p-1 cursor-pointer"
                  value={form.colores.primario}
                  onChange={(e) => handleColor("primario", e.target.value)}
                />
                <Input
                  value={form.colores.primario}
                  onChange={(e) => handleColor("primario", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Color Secundario</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  className="w-12 h-9 p-1 cursor-pointer"
                  value={form.colores.secundario}
                  onChange={(e) => handleColor("secundario", e.target.value)}
                />
                <Input
                  value={form.colores.secundario}
                  onChange={(e) => handleColor("secundario", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Color Éxito</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  className="w-12 h-9 p-1 cursor-pointer"
                  value={form.colores.exito}
                  onChange={(e) => handleColor("exito", e.target.value)}
                />
                <Input
                  value={form.colores.exito}
                  onChange={(e) => handleColor("exito", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Color Advertencia</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  className="w-12 h-9 p-1 cursor-pointer"
                  value={form.colores.advertencia}
                  onChange={(e) => handleColor("advertencia", e.target.value)}
                />
                <Input
                  value={form.colores.advertencia}
                  onChange={(e) => handleColor("advertencia", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Color Error</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  className="w-12 h-9 p-1 cursor-pointer"
                  value={form.colores.error}
                  onChange={(e) => handleColor("error", e.target.value)}
                />
                <Input
                  value={form.colores.error}
                  onChange={(e) => handleColor("error", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-1.5">
              <Label>Tipografía Principal</Label>
              <Input
                value={form.tipografia}
                onChange={(e) => setForm((p) => ({ ...p, tipografia: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Radio de Bordes</Label>
              <Input
                value={form.radioBordes}
                onChange={(e) => setForm((p) => ({ ...p, radioBordes: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Logo Login URL</Label>
              <Input
                value={form.logoLoginUrl}
                onChange={(e) => setForm((p) => ({ ...p, logoLoginUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Logo Dashboard URL</Label>
              <Input
                value={form.logoDashboardUrl}
                onChange={(e) => setForm((p) => ({ ...p, logoDashboardUrl: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
