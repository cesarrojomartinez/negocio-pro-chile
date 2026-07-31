import { Lock, Sparkles } from "lucide-react";

import { SectionCard } from "@/components/shared/SectionCard";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Automatización avanzada: arquitectura preparada, sin ninguna llamada.
 * El interruptor está bloqueado a propósito: mientras no exista un método de
 * autorización verificado, no puede activarse.
 */
export function AutomatizacionAvanzadaPanel() {
  return (
    <SectionCard
      titulo="Automatización avanzada"
      descripcion="Próximamente: actualización programada mediante un método de autorización compatible, sin almacenar tu Clave Tributaria."
      acciones={<Sparkles className="h-5 w-5 text-primary" aria-hidden />}
    >
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/40 px-3 py-3">
        <div>
          <Label htmlFor="automatizacion-avanzada" className="text-sm">
            Actualizar mi información automáticamente
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Todavía no está disponible. Seguimos usando la actualización segura,
            en la que tú ingresas tu clave solo en el momento de consultar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
          <Switch id="automatizacion-avanzada" checked={false} disabled />
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Mi Negocio al Día nunca guardará tu Clave Tributaria para automatizar
        consultas, ni siquiera cifrada.
      </p>
    </SectionCard>
  );
}
