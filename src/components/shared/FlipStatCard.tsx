import type { ReactNode } from "react";
import { useState } from "react";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { VariationPill } from "./VariationPill";

interface FlipStatCardProps {
  tituloFrente: string;
  montoFrente: string;
  descripcionFrente: string;
  tituloReverso: string;
  montoReverso: string;
  descripcionReverso: string;
  notaReverso?: string;
  variacion?: number | null;
  interpretarComoPositivo?: boolean;
  icono?: ReactNode;
  destacado?: boolean;
}

export function FlipStatCard({
  tituloFrente,
  montoFrente,
  descripcionFrente,
  tituloReverso,
  montoReverso,
  descripcionReverso,
  notaReverso,
  variacion,
  interpretarComoPositivo = true,
  icono,
  destacado,
}: FlipStatCardProps) {
  const [volteada, setVolteada] = useState(false);

  return (
    <article
      className={cn(
        "group relative min-h-[160px] cursor-pointer perspective-1000",
        destacado && "",
      )}
      onClick={() => setVolteada((v) => !v)}
      aria-pressed={volteada}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setVolteada((v) => !v);
        }
      }}
    >
      <div
        className={cn(
          "relative h-full w-full transition-transform duration-500",
          "transform-style-3d",
          volteada && "rotate-y-180",
        )}
      >
        {/* Frente */}
        <div
          className={cn(
            "card-surface absolute inset-0 flex flex-col gap-2 p-5 backface-hidden",
            destacado && "border-primary/30 bg-info-soft",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {tituloFrente}
            </h3>
            <span
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Ver compras netas"
              onClick={(e) => {
                e.stopPropagation();
                setVolteada(true);
              }}
            >
              <Info className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <p className="num-md break-words sm:text-[1.6rem]">{montoFrente}</p>
          <p className="text-xs text-muted-foreground">{descripcionFrente}</p>
          {variacion !== undefined && (
            <div className="pt-1">
              <VariationPill
                variacion={variacion}
                interpretarComoPositivo={interpretarComoPositivo}
              />
            </div>
          )}
        </div>

        {/* Reverso */}
        <div
          className={cn(
            "card-surface absolute inset-0 flex flex-col gap-2 p-5 backface-hidden rotate-y-180",
            destacado && "border-primary/30 bg-info-soft",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {tituloReverso}
            </h3>
            <span
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Volver"
              onClick={(e) => {
                e.stopPropagation();
                setVolteada(false);
              }}
            >
              <X className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <p className="num-md break-words sm:text-[1.6rem]">{montoReverso}</p>
          <p className="text-xs text-muted-foreground">{descripcionReverso}</p>
          {notaReverso && (
            <p className="mt-auto text-[10px] leading-tight text-muted-foreground">
              {notaReverso}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
