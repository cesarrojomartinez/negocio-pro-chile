import { CircleDot, Cloud, CloudOff, Loader2, TriangleAlert } from "lucide-react";
import type { EstadoConexionSii } from "@/types/company";
import { cn } from "@/lib/utils";

const MAPA: Record<
  EstadoConexionSii,
  { texto: string; clase: string; Icono: typeof Cloud }
> = {
  connected: {
    texto: "Conectado",
    clase: "bg-success-soft text-success",
    Icono: Cloud,
  },
  connecting: {
    texto: "Conectando",
    clase: "bg-info-soft text-primary",
    Icono: Loader2,
  },
  stale: {
    texto: "Información pendiente de actualización",
    clase: "bg-warning-soft text-warning-foreground",
    Icono: TriangleAlert,
  },
  disconnected: {
    texto: "Desconectado",
    clase: "bg-muted text-muted-foreground",
    Icono: CloudOff,
  },
  error: {
    texto: "Error de sincronización",
    clase: "bg-danger-soft text-destructive",
    Icono: TriangleAlert,
  },
};

export function ConnectionBadge({
  estado,
  className,
}: {
  estado: EstadoConexionSii;
  className?: string;
}) {
  const { texto, clase, Icono } = MAPA[estado];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        clase,
        className,
      )}
    >
      <Icono
        className={cn("h-3.5 w-3.5", estado === "connecting" && "animate-spin")}
        aria-hidden
      />
      {texto}
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground",
        className,
      )}
    >
      <CircleDot className="h-3.5 w-3.5" aria-hidden />
      Datos demostrativos
    </span>
  );
}
