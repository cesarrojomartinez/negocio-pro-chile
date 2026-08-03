import { useState } from "react";
import { Bell, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CanalNotificacion, ConfiguracionNotificaciones } from "@/lib/configuracion";

export function TabNotificaciones({
  datos,
  onGuardar,
  onRestablecer,
  guardando,
}: {
  datos: ConfiguracionNotificaciones;
  onGuardar: (valores: ConfiguracionNotificaciones) => void;
  onRestablecer: () => void;
  guardando: boolean;
}) {
  const [form, setForm] = useState<ConfiguracionNotificaciones>(datos);

  const handleUpdate = (canal: keyof ConfiguracionNotificaciones, campo: keyof CanalNotificacion, valor: any) => {
    setForm((prev) => ({
      ...prev,
      [canal]: { ...prev[canal], [campo]: valor },
    }));
  };

  const canales: Array<{ clave: keyof ConfiguracionNotificaciones; nombre: string }> = [
    { clave: "email", nombre: "Notificaciones por Email" },
    { clave: "popup", nombre: "Popups en Interfaz" },
    { clave: "banner", nombre: "Banners Informativos Top" },
    { clave: "push", nombre: "Notificaciones Push Navegador" },
    { clave: "webhook", nombre: "Webhooks Integración API" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Canales de Notificaciones & Webhooks
              </CardTitle>
              <CardDescription className="text-xs">
                Configura los canales activos para alertas del sistema, avisos y llamadas externas.
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
          {canales.map((c) => {
            const item = form[c.clave];
            return (
              <div key={c.clave} className="p-3.5 rounded-xl border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{c.nombre}</span>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={item.activo}
                      onCheckedChange={(val) => handleUpdate(c.clave, "activo", val)}
                    />
                    <div className="w-32">
                      <Select
                        value={item.prioridad}
                        onValueChange={(val) => handleUpdate(c.clave, "prioridad", val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alta">Prioridad Alta</SelectItem>
                          <SelectItem value="media">Prioridad Media</SelectItem>
                          <SelectItem value="baja">Prioridad Baja</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                {c.clave === "webhook" && item.activo && (
                  <div className="space-y-1 pt-2 border-t">
                    <Label className="text-xs">Endpoint URL Webhook</Label>
                    <Input
                      value={item.destino ?? ""}
                      onChange={(e) => handleUpdate("webhook", "destino", e.target.value)}
                      placeholder="https://api.empresa.cl/webhooks"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
