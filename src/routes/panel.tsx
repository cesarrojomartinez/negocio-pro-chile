import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { PanelInicio } from "@/components/dashboard/PanelInicio";
import { LoadingBlock, LoadingCards } from "@/components/shared/States";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/panel")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mi panel del mes | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Panel de tu empresa: ventas, IVA estimado, reserva recomendada y estado del mes.",
      },
      { property: "og:title", content: "Mi panel del mes | Mi Negocio al Día" },
      {
        property: "og:description",
        content:
          "Revisa cómo va tu negocio este mes con información de tu propia empresa.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PanelRoute,
});

/** Panel del cliente autenticado. Nunca muestra datos demostrativos. */
function PanelRoute() {
  const { session, cargandoSesion } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!cargandoSesion && !session) {
      void navigate({ to: "/auth", replace: true });
    }
  }, [cargandoSesion, session, navigate]);

  if (cargandoSesion || !session) {
    return (
      <div className="mx-auto w-full max-w-[1100px] space-y-5 p-6">
        <LoadingBlock alto="h-24" />
        <LoadingCards />
      </div>
    );
  }

  return <PanelInicio />;
}
