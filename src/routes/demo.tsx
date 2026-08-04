import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { PanelInicio } from "@/components/dashboard/PanelInicio";
import { LoadingBlock, LoadingCards } from "@/components/shared/States";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demostración | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Revisa tus ventas, tu IVA estimado y la reserva recomendada del mes en un panel simple para microempresarios chilenos.",
      },
      { property: "og:title", content: "Demostración | Mi Negocio al Día" },
      {
        property: "og:description",
        content:
          "Controla tus ventas, anticipa tus impuestos y toma mejores decisiones durante el mes.",
      },
    ],
  }),
  component: DemoRoute,
});

/**
 * `/demo` es solo la demostración pública. Si la persona tiene sesión activa
 * la enviamos a su propio panel para que nunca vea datos de ejemplo.
 */
function DemoRoute() {
  const { session, cargandoSesion } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!cargandoSesion && session) {
      void navigate({ to: "/panel", replace: true });
    }
  }, [cargandoSesion, session, navigate]);

  if (cargandoSesion || session) {
    return (
      <div className="mx-auto w-full max-w-[1100px] space-y-5 p-6">
        <LoadingBlock alto="h-24" />
        <LoadingCards />
      </div>
    );
  }

  return <PanelInicio />;
}
