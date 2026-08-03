import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";

import { HeroPreview } from "@/components/landing/HeroPreview";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { PlanesGrid } from "@/components/landing/PlanesGrid";
import { Testimonios } from "@/components/landing/Testimonios";
import { Button } from "@/components/ui/button";
import { landingPublicaFn } from "@/lib/landing.functions";
import type { LandingPublica, SeccionLanding } from "@/lib/landing";
import { useAuth } from "@/hooks/useAuth";
import { esAdministradorFn } from "@/lib/cuenta.functions";

export const Route = createFileRoute("/")({
  loader: async () => landingPublicaFn(),
  head: () => ({
    meta: [
      { title: "Mi Negocio al Día | Tus números claros cada mes" },
      {
        name: "description",
        content:
          "Controla tus ventas, anticipa tu IVA y sabe cuánto reservar cada mes. Información clara para microempresarios en Chile.",
      },
      { property: "og:title", content: "Mi Negocio al Día | Tus números claros cada mes" },
      {
        property: "og:description",
        content:
          "Ventas, compras, IVA estimado y reserva sugerida en un solo lugar. Prueba la demostración sin registrarte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { contenido, planes, testimonios } = Route.useLoaderData() as LandingPublica;
  const { session, cargandoSesion } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!cargandoSesion && session) {
      void esAdministradorFn().then((rol) => {
        if (rol.ok && rol.data) {
          void navigate({ to: "/admin" });
        }
      });
    }
  }, [session, cargandoSesion, navigate]);

  const secciones: Record<SeccionLanding, React.ReactNode> = {
    problema: contenido.problema.visible ? (
      <Seccion key="problema" id="problema">
        <Encabezado
          titulo={contenido.problema.titulo}
          subtitulo={contenido.problema.descripcion}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {contenido.problema.items.map((i) => (
            <article key={i.titulo} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-base font-bold">{i.titulo}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{i.descripcion}</p>
            </article>
          ))}
        </div>
      </Seccion>
    ) : null,

    testimonios: contenido.testimonios.visible ? (
      <Seccion key="testimonios" id="testimonios" tono="suave">
        <Encabezado titulo={contenido.testimonios.titulo} />
        <Testimonios testimonios={testimonios} nota={contenido.testimonios.nota} />
      </Seccion>
    ) : null,

    beneficios: contenido.beneficios.visible ? (
      <Seccion key="beneficios" id="beneficios">
        <Encabezado titulo={contenido.beneficios.titulo} />
        <div className="grid gap-4 md:grid-cols-3">
          {contenido.beneficios.items.map((i) => (
            <article key={i.titulo} className="rounded-2xl border border-border bg-card p-5">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-3 text-base font-bold">{i.titulo}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{i.descripcion}</p>
            </article>
          ))}
        </div>
        <ul className="flex flex-wrap justify-center gap-2">
          {contenido.beneficios.sellos.map((s) => (
            <li
              key={s}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium"
            >
              <Check className="h-3.5 w-3.5 text-success" aria-hidden />
              {s}
            </li>
          ))}
        </ul>
      </Seccion>
    ) : null,

    planes: contenido.planes.visible ? (
      <Seccion key="planes" id="planes" tono="suave">
        <Encabezado
          titulo={contenido.planes.titulo}
          subtitulo={contenido.planes.subtitulo}
        />
        <PlanesGrid planes={planes} textos={contenido.planes} />
        <p className="text-center text-xs text-muted-foreground">
          {contenido.planes.nota}
        </p>
      </Seccion>
    ) : null,

    cierre: contenido.cierre.visible ? (
      <Seccion key="cierre" id="cierre">
        <div className="rounded-2xl bg-primary px-6 py-10 text-center text-primary-foreground">
          <h2 className="text-xl font-extrabold sm:text-2xl">
            {contenido.cierre.titulo}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm opacity-90">
            {contenido.cierre.descripcion}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/demo">{contenido.cierre.botonPrimario}</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              asChild
            >
              <Link to="/registro" search={{ plan: undefined }}>{contenido.cierre.botonSecundario}</Link>
            </Button>
          </div>
        </div>
      </Seccion>
    ) : null,
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 lg:grid-cols-2 lg:items-center lg:py-16">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
              {contenido.hero.etiqueta}
            </span>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {contenido.hero.titulo}{" "}
              <span className="text-primary">{contenido.hero.tituloDestacado}</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              {contenido.hero.descripcion}
            </p>
            <ul className="mt-5 space-y-2">
              {contenido.hero.beneficios.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                  <span className="min-w-0">{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/demo">
                  {contenido.hero.botonPrimario}
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/planes">{contenido.hero.botonSecundario}</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {contenido.hero.notaPie}
            </p>
          </div>

          <div className="min-w-0">
            <HeroPreview />
          </div>
        </section>

        {contenido.orden.map((s) => secciones[s])}
      </main>

      <LandingFooter textos={contenido.footer} />
    </div>
  );
}

function Seccion({
  id,
  children,
  tono = "normal",
}: {
  id: string;
  children: React.ReactNode;
  tono?: "normal" | "suave";
}) {
  return (
    <section
      id={id}
      className={tono === "suave" ? "bg-secondary/40 py-12 sm:py-16" : "py-12 sm:py-16"}
    >
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4">{children}</div>
    </section>
  );
}

function Encabezado({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{titulo}</h2>
      {subtitulo && <p className="mt-2 text-sm text-muted-foreground">{subtitulo}</p>}
    </div>
  );
}
