import { useCallback, useEffect, useState } from "react";
import { KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { periodoService } from "@/services/periodoService";
import type {
  ModoActualizacion,
  ModoActualizacionEmpresa,
} from "@/lib/periodLifecycle.server";
import { cn } from "@/lib/utils";

const OPCIONES: {
  id: ModoActualizacion;
  titulo: string;
  descripcion: string;
  detalle: string[];
  icono: typeof KeyRound;
}[] = [
  {
    id: "manual_secure",
    titulo: "Actualización segura",
    descripcion: "Tú decides cuándo consultar y escribes tu clave solo en ese momento.",
    detalle: [
      "La Clave Tributaria se usa una sola vez y nunca queda guardada.",
      "Entre consultas mostramos la última información guardada.",
      "Ideal si prefieres tener el control de cada consulta.",
    ],
    icono: KeyRound,
  },
  {
    id: "advanced_automation",
    titulo: "Automatización avanzada",
    descripcion: "La información se actualizaría sola, sin que ingreses tu clave.",
    detalle: [
      "Requiere una autorización formal que todavía no está disponible.",
      "Puedes dejar registrado tu interés y te avisaremos cuando se habilite.",
      "Mientras tanto seguimos usando la actualización segura.",
    ],
    icono: Sparkles,
  },
];

/** Elección del modo de actualización y recordatorio semanal. */
export function ModoActualizacionPanel({ companyId }: { companyId: string | null }) {
  const [estado, setEstado] = useState<ModoActualizacionEmpresa | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(() => {
    if (!companyId) return setEstado(null);
    periodoService
      .modoActualizacion(companyId)
      .then(setEstado)
      .catch(() => setEstado(null));
  }, [companyId]);

  useEffect(() => cargar(), [cargar]);

  if (!companyId || !estado) return null;

  async function elegir(modo: ModoActualizacion) {
    if (!companyId) return;
    setOcupado(true);
    try {
      const r = await periodoService.elegirModo(companyId, modo);
      setEstado(r);
      toast.success(
        modo === "manual_secure"
          ? "Usaremos la actualización segura con tu clave en el momento."
          : "Registramos tu interés en la automatización avanzada.",
      );
    } catch (e) {
      toast.error("No pudimos guardar el modo de actualización", {
        description: e instanceof Error ? e.message : "Intenta nuevamente.",
      });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <SectionCard
      titulo="Modo de actualización"
      descripcion="Elige cómo quieres traer la información del SII. En ningún caso guardamos tu Clave Tributaria."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {OPCIONES.map((o) => {
          const activo = estado.modo === o.id;
          const Icono = o.icono;
          return (
            <button
              key={o.id}
              type="button"
              disabled={ocupado}
              onClick={() => void elegir(o.id)}
              className={cn(
                "rounded-2xl border p-4 text-left transition",
                activo
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-center gap-2">
                <Icono className="h-5 w-5 text-primary" aria-hidden />
                <span className="font-semibold">{o.titulo}</span>
                {activo && (
                  <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    Activo
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{o.descripcion}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {o.detalle.map((d) => (
                  <li key={d}>· {d}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {estado.modo === "advanced_automation" && (
        <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
          {estado.motivoAutomatizacion ??
            "La automatización avanzada todavía no está disponible."}{" "}
          Seguimos actualizando con el modo seguro.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3">
        <Label htmlFor="recordatorio-semanal" className="text-sm">
          Recordarme una vez por semana que actualice mi información
        </Label>
        <Switch
          id="recordatorio-semanal"
          checked={estado.recordatorioSemanal}
          disabled={ocupado}
          onCheckedChange={async (v) => {
            if (!companyId) return;
            setEstado({ ...estado, recordatorioSemanal: v });
            try {
              await periodoService.recordatorioSemanal(companyId, v);
            } catch {
              setEstado({ ...estado, recordatorioSemanal: !v });
              toast.error("No pudimos guardar el recordatorio");
            }
          }}
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Cualquiera sea el modo, las cifras son una estimación informativa y no
        reemplazan a tu contador.
      </p>
      <div className="mt-3">
        <Button variant="ghost" size="sm" onClick={cargar} disabled={ocupado}>
          Actualizar esta información
        </Button>
      </div>
    </SectionCard>
  );
}
