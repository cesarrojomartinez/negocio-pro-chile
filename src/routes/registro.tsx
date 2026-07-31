import { createFileRoute } from "@tanstack/react-router";

import { AutenticacionForm } from "@/components/auth/AutenticacionForm";

export const Route = createFileRoute("/registro")({
  validateSearch: (search: Record<string, unknown>) => ({
    plan: typeof search["plan"] === "string" ? (search["plan"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Crear cuenta | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Crea tu cuenta y comienza a ver tus ventas, IVA estimado y reserva sugerida mes a mes.",
      },
      { property: "og:title", content: "Crear cuenta | Mi Negocio al Día" },
      {
        property: "og:description",
        content:
          "Regístrate en Mi Negocio al Día y ordena tu mes tributario en minutos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegistroPage,
});

function RegistroPage() {
  return <AutenticacionForm pestanaInicial="registro" />;
}
