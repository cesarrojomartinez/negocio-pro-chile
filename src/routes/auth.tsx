import { createFileRoute } from "@tanstack/react-router";

import { AutenticacionForm } from "@/components/auth/AutenticacionForm";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next: typeof s.next === "string" && s.next.startsWith("/") ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ingresar | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Inicia sesión o crea tu cuenta para guardar tus metas, reservas y estimaciones tributarias.",
      },
      { property: "og:title", content: "Ingresar | Mi Negocio al Día" },
      {
        property: "og:description",
        content:
          "Accede a tu cuenta de Mi Negocio al Día y mantén tu información guardada de forma segura.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RutaAuth,
});

function RutaAuth() {
  const { next } = Route.useSearch();
  return <AutenticacionForm pestanaInicial="login" destinoTrasLogin={next} />;
}
