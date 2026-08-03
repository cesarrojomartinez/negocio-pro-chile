import { useState } from "react";
import { Building2, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConfiguracionPlataforma } from "@/lib/configuracion";

export function TabPlataforma({
  datos,
  onGuardar,
  onRestablecer,
  guardando,
}: {
  datos: ConfiguracionPlataforma;
  onGuardar: (valores: ConfiguracionPlataforma) => void;
  onRestablecer: () => void;
  guardando: boolean;
}) {
  const [form, setForm] = useState<ConfiguracionPlataforma>(datos);

  const handleChange = (campo: keyof ConfiguracionPlataforma, valor: any) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleRedes = (red: keyof ConfiguracionPlataforma["redesSociales"], valor: string) => {
    setForm((prev) => ({
      ...prev,
      redesSociales: { ...prev.redesSociales, [red]: valor },
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Identidad y Contacto de Plataforma
              </CardTitle>
              <CardDescription className="text-xs">
                Información general de la empresa, datos de contacto comercial y soporte.
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
              <Label>Nombre Comercial</Label>
              <Input
                value={form.nombreComercial}
                onChange={(e) => handleChange("nombreComercial", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Correo de Soporte</Label>
              <Input
                type="email"
                value={form.correoSoporte}
                onChange={(e) => handleChange("correoSoporte", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Correo Comercial</Label>
              <Input
                type="email"
                value={form.correoComercial}
                onChange={(e) => handleChange("correoComercial", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono Oficial</Label>
              <Input
                value={form.telefono}
                onChange={(e) => handleChange("telefono", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp de Atención</Label>
              <Input
                value={form.whatsapp}
                onChange={(e) => handleChange("whatsapp", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Favicon URL</Label>
              <Input
                value={form.faviconUrl}
                onChange={(e) => handleChange("faviconUrl", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descripción Breve</Label>
            <Textarea
              rows={2}
              value={form.descripcion}
              onChange={(e) => handleChange("descripcion", e.target.value)}
            />
          </div>

          <div className="pt-2">
            <Label className="font-semibold text-xs block mb-2">Redes Sociales</Label>
            <div className="grid md:grid-cols-2 gap-3">
              <Input
                placeholder="LinkedIn URL"
                value={form.redesSociales.linkedin}
                onChange={(e) => handleRedes("linkedin", e.target.value)}
              />
              <Input
                placeholder="Instagram URL"
                value={form.redesSociales.instagram}
                onChange={(e) => handleRedes("instagram", e.target.value)}
              />
              <Input
                placeholder="Twitter URL"
                value={form.redesSociales.twitter}
                onChange={(e) => handleRedes("twitter", e.target.value)}
              />
              <Input
                placeholder="Facebook URL"
                value={form.redesSociales.facebook}
                onChange={(e) => handleRedes("facebook", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-warning/30 bg-warning/5">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            Modo Mantenimiento de Plataforma
          </CardTitle>
          <CardDescription className="text-xs">
            Al activar el modo mantenimiento, se desplegará una pantalla de aviso para usuarios normales.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <Label className="font-semibold">Activar Modo Mantenimiento</Label>
            <Switch
              checked={form.modoMantenimiento}
              onCheckedChange={(val) => handleChange("modoMantenimiento", val)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mensaje para Clientes</Label>
            <Textarea
              rows={2}
              value={form.mensajeMantenimiento}
              onChange={(e) => handleChange("mensajeMantenimiento", e.target.value)}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-xs text-muted-foreground pt-2 border-t">
            <div>
              <span className="font-semibold">Versión Actual:</span> {form.versionActual}
            </div>
            <div>
              <span className="font-semibold">Último Despliegue:</span> {form.fechaDespliegue}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
