import { Quote } from "lucide-react";

import type { TestimonioLanding } from "@/lib/landing";
import { cn } from "@/lib/utils";

export function Testimonios({
  testimonios,
  nota,
}: {
  testimonios: TestimonioLanding[];
  nota: string;
}) {
  if (testimonios.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-3">
        {testimonios.map((t) => (
          <figure
            key={t.id}
            className={cn(
              "flex h-full flex-col rounded-2xl border bg-card p-5",
              t.destacado ? "border-primary/50" : "border-border",
            )}
          >
            <Quote className="h-5 w-5 text-primary" aria-hidden />
            <blockquote className="mt-3 flex-1 text-sm leading-relaxed">
              “{t.testimonio}”
            </blockquote>
            <figcaption className="mt-4 flex min-w-0 items-center gap-3">
              {t.imagenUrl ? (
                <img
                  src={t.imagenUrl}
                  alt={`${t.nombre}, ${t.rubro}`}
                  loading="lazy"
                  decoding="async"
                  width={44}
                  height={44}
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary"
                >
                  {t.nombre.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{t.nombre}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {t.rubro}
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">{nota}</p>
    </div>
  );
}
