import { Link } from "@tanstack/react-router";

import type { ContenidoLanding } from "@/lib/landing";

export function LandingFooter({ textos }: { textos: ContenidoLanding["footer"] }) {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 md:grid-cols-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">Mi Negocio al Día</p>
          <p className="mt-2 text-sm text-muted-foreground">{textos.descripcion}</p>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Soporte</p>
          <p className="mt-2 text-sm text-muted-foreground">{textos.soporte}</p>
          <Link
            to="/soporte"
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            Ir a soporte
          </Link>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Términos y privacidad</p>
          <p className="mt-2 text-sm text-muted-foreground">{textos.terminos}</p>
          <p className="mt-2 text-sm text-muted-foreground">{textos.privacidad}</p>
        </div>
      </div>
      <p className="border-t border-border/70 py-4 text-center text-xs text-muted-foreground">
        {textos.legal}
      </p>
    </footer>
  );
}
