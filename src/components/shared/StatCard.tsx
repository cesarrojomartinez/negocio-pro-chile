import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { VariationPill } from "./VariationPill";

interface Props {
  titulo: string;
  monto: string;
  descripcion: string;
  variacion?: number | null;
  interpretarComoPositivo?: boolean;
  icono?: ReactNode;
  destacado?: boolean;
  contexto?: string;
}

export function StatCard({
  titulo,
  monto,
  descripcion,
  variacion,
  interpretarComoPositivo = true,
  icono,
  destacado,
  contexto,
}: Props) {
  return (
    <article
      className={cn(
        "card-surface flex flex-col gap-2 p-5",
        destacado && "border-primary/30 bg-info-soft",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{titulo}</h3>
        {icono && <span className="text-primary">{icono}</span>}
      </div>
      <p className="num-md break-words sm:text-[1.6rem]">{monto}</p>
      <p className="text-xs text-muted-foreground">{descripcion}</p>
      {variacion !== undefined && (
        <div className="pt-1">
          <VariationPill
            variacion={variacion}
            interpretarComoPositivo={interpretarComoPositivo}
          />
        </div>
      )}
      {contexto && <p className="text-xs text-muted-foreground">{contexto}</p>}
    </article>
  );
}
