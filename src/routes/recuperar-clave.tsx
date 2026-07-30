import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/recuperar-clave")({
  head: () => ({
    meta: [
      { title: "Recuperar contraseña | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Te enviamos un enlace a tu correo para que puedas crear una contraseña nueva.",
      },
      { property: "og:title", content: "Recuperar contraseña | Mi Negocio al Día" },
      {
        property: "og:description",
        content: "Recupera el acceso a tu cuenta de Mi Negocio al Día.",
      },
    ],
  }),
  component: RecuperarClave,
});

function RecuperarClave() {
  const { recuperarClave } = useAuth();
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const { error: err } = await recuperarClave(email.trim());
    setEnviando(false);
    if (err) {
      setError(err);
      return;
    }
    setEnviado(true);
  }

  return (
    <AuthCard
      titulo="Recuperar contraseña"
      descripcion="Ingresa tu correo y te enviaremos un enlace para crear una clave nueva."
      pie={
        <Link to="/auth" className="font-medium text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      {enviado ? (
        <p className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
          Si el correo está registrado, recibirás un enlace en unos minutos. Revisa
          también la carpeta de spam.
        </p>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-rec">Correo electrónico</Label>
            <Input
              id="email-rec"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.cl"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar enlace"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
