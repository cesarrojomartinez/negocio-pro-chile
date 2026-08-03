import { useState } from "react";
import { Mail, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ConfiguracionCorreos, PlantillaCorreo } from "@/lib/configuracion";

const LISTA_PLANTILLAS: Array<{ clave: keyof ConfiguracionCorreos; titulo: string }> = [
  { clave: "bienvenida", titulo: "Bienvenida" },
  { clave: "invitacion", titulo: "Invitación de Equipo" },
  { clave: "recuperacionPassword", titulo: "Recuperación de Contraseña" },
  { clave: "pagoRecibido", titulo: "Pago Recibido" },
  { clave: "pagoRechazado", titulo: "Pago Rechazado" },
  { clave: "suspension", titulo: "Notificación de Suspensión" },
  { clave: "renovacion", titulo: "Renovación de Suscripción" },
  { clave: "finTrial", titulo: "Fin de Período de Prueba" },
];

export function TabCorreos({
  datos,
  onGuardar,
  onRestablecer,
  guardando,
}: {
  datos: ConfiguracionCorreos;
  onGuardar: (valores: ConfiguracionCorreos) => void;
  onRestablecer: () => void;
  guardando: boolean;
}) {
  const [form, setForm] = useState<ConfiguracionCorreos>(datos);
  const [plantillaSeleccionada, setPlantillaSeleccionada] =
    useState<keyof ConfiguracionCorreos>("bienvenida");

  const actual = form[plantillaSeleccionada];

  const handleUpdate = (campo: keyof PlantillaCorreo, valor: any) => {
    setForm((prev) => ({
      ...prev,
      [plantillaSeleccionada]: {
        ...prev[plantillaSeleccionada],
        [campo]: valor,
      },
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" /> Plantillas de Correo Electrónico
              </CardTitle>
              <CardDescription className="text-xs">
                Edita los asuntos y textos de los correos transaccionales enviados por la plataforma.
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
          <div className="flex items-center gap-4 pb-2 border-b">
            <div className="w-64">
              <Label className="text-xs mb-1 block">Seleccionar Plantilla</Label>
              <Select
                value={plantillaSeleccionada}
                onValueChange={(val) => setPlantillaSeleccionada(val as keyof ConfiguracionCorreos)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LISTA_PLANTILLAS.map((p) => (
                    <SelectItem key={p.clave} value={p.clave}>
                      {p.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <Switch
                checked={actual.activado}
                onCheckedChange={(val) => handleUpdate("activado", val)}
              />
              <Label className="text-xs font-semibold">Envío Automático Activado</Label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Asunto del Correo</Label>
              <Input
                value={actual.asunto}
                onChange={(e) => handleUpdate("asunto", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cuerpo del Correo (Soporta variables {"{{nombre}}"}, {"{{empresa}}"})</Label>
              <Textarea
                rows={6}
                className="font-mono text-xs"
                value={actual.cuerpoHtml}
                onChange={(e) => handleUpdate("cuerpoHtml", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
