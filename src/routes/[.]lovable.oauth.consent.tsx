import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type OauthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function oauthApi(): OauthApi {
  return (supabase.auth as unknown as { oauth: OauthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Falta authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const inmediato = data?.redirect_url ?? data?.redirect_to;
    if (inmediato && !data?.client) throw redirect({ href: inmediato });
    return data;
  },
  component: Consentimiento,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md p-6 text-sm">
      No pudimos cargar esta solicitud de autorización:{" "}
      {String((error as Error)?.message ?? error)}
    </main>
  ),
});

function Consentimiento() {
  const detalles = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nombreCliente = detalles?.client?.name ?? "esta aplicación";

  async function decidir(aprobar: boolean) {
    setEnviando(true);
    setError(null);
    const { data, error: err } = aprobar
      ? await oauthApi().approveAuthorization(authorization_id)
      : await oauthApi().denyAuthorization(authorization_id);
    if (err) {
      setEnviando(false);
      setError(err.message);
      return;
    }
    const destino = data?.redirect_url ?? data?.redirect_to;
    if (!destino) {
      setEnviando(false);
      setError("El servidor de autorización no devolvió una redirección.");
      return;
    }
    window.location.href = destino;
  }

  return (
    <AuthCard
      titulo={`Conectar ${nombreCliente}`}
      descripcion="Esta aplicación podrá consultar tu información en Mi Negocio al Día actuando como tú."
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Solo entregamos estimaciones informativas de tus periodos. Nunca se comparten
          claves ni credenciales.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <Button className="flex-1" disabled={enviando} onClick={() => void decidir(true)}>
            Autorizar
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={enviando}
            onClick={() => void decidir(false)}
          >
            Rechazar
          </Button>
        </div>
      </div>
    </AuthCard>
  );
}
