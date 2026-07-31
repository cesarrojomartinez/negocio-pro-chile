import { Link } from "@tanstack/react-router";
import { Check, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { precioVisible, type ContenidoLanding, type PlanPublico } from "@/lib/landing";
import { cn } from "@/lib/utils";

export function PlanesGrid({
  planes,
  textos,
}: {
  planes: PlanPublico[];
  textos: ContenidoLanding["planes"];
}) {
  if (planes.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Estamos actualizando nuestros planes. Vuelve pronto.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {planes.map((plan) => (
        <article
          key={plan.id}
          className={cn(
            "relative flex flex-col rounded-2xl border bg-card p-5",
            plan.destacado ? "border-primary shadow-md" : "border-border",
          )}
        >
          {plan.destacado && (
            <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
              <Star className="h-3 w-3" aria-hidden /> Más elegido
            </span>
          )}
          <h3 className="text-lg font-bold">{plan.nombre}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{plan.descripcion}</p>
          <p className="mt-4 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold tabular-nums">
              {precioVisible(plan)}
            </span>
            <span className="text-xs text-muted-foreground">/{plan.periodicidad}</span>
          </p>
          <ul className="mt-4 flex-1 space-y-2">
            {plan.caracteristicas.map((c) => (
              <li key={c} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                <span className="min-w-0">{c}</span>
              </li>
            ))}
          </ul>
          <Button
            className="mt-5 w-full"
            variant={plan.destacado ? "default" : "outline"}
            asChild
          >
            <Link to="/registro" search={{ plan: plan.codigo }}>
              {textos.textoBoton}
            </Link>
          </Button>
        </article>
      ))}
    </div>
  );
}
