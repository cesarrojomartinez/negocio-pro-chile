import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/actualizar-clave")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña | Mi Negocio al Día" },
      {
        name: "description",
        content: "Define una contraseña nueva para volver a entrar a tu cuenta.",
      },
      { property: "og:title", content: "Nueva contraseña | Mi Negocio al Día" },
      {
        property: "og:description",
        content: "Actualiza la contraseña de tu cuenta de Mi Negocio al Día.",
      },
    ],
  }),
  component: ActualizarClave,
});

function ActualizarClave() {
  const { actualizarClave } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setEnviando(true);
    setError(null);
    const { error: err } = await actualizarClave(password);
    setEnviando(false);
    if (err) {
      setError(err);
      return;
    }
    toast.success("Contraseña actualizada");
    void navigate({ to: "/demo" });
  }

  return (
    <AuthCard
      titulo="Crear contraseña nueva"
      descripcion="Elige una clave que recuerdes y que tenga al menos 8 caracteres."
    >
      <form onSubmit={enviar} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pass-nueva">Nueva contraseña</Label>
          <Input
            id="pass-nueva"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </AuthCard>
  );
}
