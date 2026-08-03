import { useState } from "react";
import { ShieldCheck, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConfiguracionSeguridad } from "@/lib/configuracion";

export function TabSeguridad({
  datos,
  onGuardar,
  onRestablecer,
  guardando,
}: {
  datos: ConfiguracionSeguridad;
  onGuardar: (valores: ConfiguracionSeguridad) => void;
  onRestablecer: () => void;
  guardando: boolean;
}) {
  const [form, setForm] = useState<ConfiguracionSeguridad>(datos);

  const handleChange = (campo: keyof ConfiguracionSeguridad, valor: any) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Políticas de Seguridad & Accesos
              </CardTitle>
              <CardDescription className="text-xs">
                Ajusta los timeouts de sesión, límites de autenticación fallida y reglas de contraseña.
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
              <Label>Timeout de Sesión (Minutos)</Label>
              <Input
                type="number"
                value={form.timeoutSesionMinutos}
                onChange={(e) => handleChange("timeoutSesionMinutos", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Máximo Intentos Login</Label>
              <Input
                type="number"
                value={form.maxIntentosLogin}
                onChange={(e) => handleChange("maxIntentosLogin", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Longitud Mínima Contraseña</Label>
              <Input
                type="number"
                value={form.longitudMinimaPassword}
                onChange={(e) => handleChange("longitudMinimaPassword", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <Label className="font-semibold">Exigir Autenticación 2FA para Administradores</Label>
            <Switch
              checked={form.exigirDosFactoresAdmin}
              onCheckedChange={(val) => handleChange("exigirDosFactoresAdmin", val)}
            />
          </div>

          <div className="space-y-1.5 pt-2">
            <Label>Descripción Formato Política de Contraseñas</Label>
            <Textarea
              rows={2}
              value={form.politicaContrasenasFormato}
              onChange={(e) => handleChange("politicaContrasenasFormato", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
