import {
  CircleDot,
  Cloud,
  CloudOff,
  FileCheck2,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import type { EstadoConexionSii } from "@/types/company";
import type { FuentePeriodo } from "@/types/tax";
import { etiquetaFuentePeriodo } from "@/lib/f29Antecedent";
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

const MAPA_FUENTE: Record<FuentePeriodo, { clase: string; Icono: typeof Cloud }> = {
  mock: { clase: "bg-accent text-accent-foreground", Icono: CircleDot },
  rcv_real: { clase: "bg-info-soft text-primary", Icono: Cloud },
  accountant_confirmed: { clase: "bg-success-soft text-success", Icono: FileCheck2 },
  rcv_real_plus_accountant: {
    clase: "bg-success-soft text-success",
    Icono: FileCheck2,
  },
  not_synchronized: {
    clase: "bg-warning-soft text-warning-foreground",
    Icono: TriangleAlert,
  },
};

/** Origen de la información del periodo seleccionado (no de la conexión). */
export function FuentePeriodoBadge({
  fuente,
  className,
}: {
  fuente: FuentePeriodo;
  className?: string;
}) {
  const { clase, Icono } = MAPA_FUENTE[fuente];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        clase,
        className,
      )}
    >
      <Icono className="h-3.5 w-3.5" aria-hidden />
      {etiquetaFuentePeriodo(fuente)}
    </span>
  );
}
