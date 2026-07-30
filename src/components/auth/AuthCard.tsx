import { Calculator } from "lucide-react";
import type { ReactNode } from "react";

export function AuthCard({
  titulo,
  descripcion,
  children,
  pie,
}: {
  titulo: string;
  descripcion: string;
  children: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-secondary/60 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Calculator className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="block text-base font-bold leading-tight">
              Mi Negocio al Día
            </span>
            <span className="block text-xs text-muted-foreground">
              Visor informativo de ventas e impuestos
            </span>
          </span>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight">{titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>
          <div className="mt-5">{children}</div>
        </section>

        {pie && <div className="mt-4 text-center text-sm">{pie}</div>}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Las cifras de la aplicación son estimaciones informativas y no reemplazan a
          tu contador.
        </p>
      </div>
    </main>
  );
}
