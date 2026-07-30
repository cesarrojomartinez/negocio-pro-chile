import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  titulo,
  descripcion,
  acciones,
  children,
  className,
}: {
  titulo?: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card-surface p-5 sm:p-6", className)}>
      {(titulo || acciones) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {titulo && (
              <h2 className="text-base font-semibold sm:text-lg">{titulo}</h2>
            )}
            {descripcion && (
              <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>
            )}
          </div>
          {acciones}
        </header>
      )}
      {children}
    </section>
  );
}

export function DataRow({
  label,
  value,
  hint,
  tone = "default",
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "primary";
  strong?: boolean;
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning-foreground",
    danger: "text-destructive",
    primary: "text-primary",
  }[tone];

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border/70 py-2.5 last:border-0">
      <div className="min-w-0">
        <p className={cn("text-sm", strong && "font-semibold")}>{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <p
        className={cn(
          "shrink-0 tabular-nums",
          strong ? "text-base font-bold" : "text-sm font-semibold",
          toneClass,
        )}
      >
        {value}
      </p>
    </div>
  );
}
