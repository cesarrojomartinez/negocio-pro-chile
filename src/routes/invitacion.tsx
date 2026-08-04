import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { ETIQUETA_ROL } from "@/lib/permisos";
import {
  aceptarInvitacionFn,
  revisarInvitacionFn,
} from "@/lib/cuenta.functions";
import type { DetalleInvitacion } from "@/lib/cuenta.server";

export const Route = createFileRoute("/invitacion")({
  head: () => ({
    meta: [
      { title: "Invitación a una empresa | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Acepta la invitación para acceder a los indicadores de una empresa en Mi Negocio al Día.",
      },
      { property: "og:title", content: "Invitación a una empresa | Mi Negocio al Día" },
      {
        property: "og:description",
        content: "Revisa y acepta tu invitación para colaborar en una empresa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitacionPage,
});

function InvitacionPage() {
  const { session, cargandoSesion } = useAuth();
  const { refrescarEmpresas, seleccionarEmpresa } = useCompany();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleInvitacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [aceptando, setAceptando] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    if (!t) {
      setError("Este enlace no es válido. Pídele al propietario que te envíe uno nuevo.");
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!token || cargandoSesion || !session) return;
    let activo = true;
    void (async () => {
      const r = await revisarInvitacionFn({ data: { token } });
      if (!activo) return;
      if (r.ok) setDetalle(r.data);
      else setError(r.error);
      setCargando(false);
    })();
    return () => {
      activo = false;
    };
  }, [token, session, cargandoSesion]);

  const aceptar = async () => {
    if (!token) return;
    setAceptando(true);
    const r = await aceptarInvitacionFn({ data: { token } });
    setAceptando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    await refrescarEmpresas();
    seleccionarEmpresa(r.data.companyId);
    toast.success("Listo, ya tienes acceso a la empresa.");
    void navigate({ to: "/panel" });
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-4 py-10">
      <SectionCard
        titulo="Invitación a una empresa"
        descripcion="Revisa a qué empresa te están invitando antes de aceptar."
        className="w-full"
      >
        {cargandoSesion ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : !session ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Primero inicia sesión o crea tu cuenta con el correo al que llegó esta
              invitación. Luego vuelve a abrir este enlace.
            </p>
            <Button onClick={() => void navigate({ to: "/auth" })}>
              Iniciar sesión
            </Button>
          </div>
        ) : error ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void navigate({ to: "/panel" })}>
              Volver al inicio
            </Button>
          </div>
        ) : cargando ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Revisando tu
            invitación…
          </p>
        ) : detalle ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-sm font-semibold">{detalle.empresa}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Acceso: {ETIQUETA_ROL[detalle.rol]}
              </p>
              <p className="text-xs text-muted-foreground">
                Invitación enviada a {detalle.correo}
              </p>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Este enlace sirve una sola vez. Al aceptar verás los indicadores de la
              empresa según el acceso asignado.
            </p>
            <Button className="w-full" disabled={aceptando} onClick={() => void aceptar()}>
              {aceptando ? "Aceptando" : "Aceptar invitación"}
            </Button>
          </div>
        ) : null}
      </SectionCard>
    </main>
  );
}
