import { createFileRoute, Link } from "@tanstack/react-router";

import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { PlanesGrid } from "@/components/landing/PlanesGrid";
import { Button } from "@/components/ui/button";
import type { LandingPublica } from "@/lib/landing";
import { landingPublicaFn } from "@/lib/landing.functions";

export const Route = createFileRoute("/planes")({
  loader: async () => landingPublicaFn(),
  head: () => ({
    meta: [
      { title: "Planes y precios | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Compara los planes de Mi Negocio al Día: prueba gratis, plan básico y plan profesional para tu microempresa.",
      },
      { property: "og:title", content: "Planes y precios | Mi Negocio al Día" },
      {
        property: "og:description",
        content:
          "Planes simples y sin permanencia para ordenar tus ventas, IVA y reserva mensual.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanesPage,
});

function PlanesPage() {
  const { contenido, planes } = Route.useLoaderData() as LandingPublica;

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-12">
        <header className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {contenido.planes.titulo}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {contenido.planes.subtitulo}
          </p>
        </header>

        <PlanesGrid planes={planes} textos={contenido.planes} />

        <p className="text-center text-xs text-muted-foreground">
          {contenido.planes.nota}
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="outline" asChild>
            <Link to="/demo">Ver la demostración</Link>
          </Button>
          <Button asChild>
            <Link to="/registro" search={{ plan: undefined }}>Crear mi cuenta</Link>
          </Button>
        </div>
      </main>
      <LandingFooter textos={contenido.footer} />
    </div>
  );
}
