import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { esRutValido, formatearRut } from "@/lib/rut";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Configura tu empresa | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Registra los datos básicos de tu empresa o carga una empresa de ejemplo para explorar la aplicación.",
      },
      { property: "og:title", content: "Configura tu empresa | Mi Negocio al Día" },
      {
        property: "og:description",
        content:
          "Primer paso para ver tus ventas, tu IVA estimado y tu reserva recomendada.",
      },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { session, cargandoSesion } = useAuth();
  const { crearEmpresa, crearEmpresaDemo } = useCompany();
  const navigate = useNavigate();

  const [rut, setRut] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [nombreFantasia, setNombreFantasia] = useState("");
  const [actividad, setActividad] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cargandoSesion && !session) void navigate({ to: "/auth" });
  }, [cargandoSesion, session, navigate]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!esRutValido(rut)) {
      setError("El RUT ingresado no es válido. Revisa el número y el dígito verificador.");
      return;
    }
    setEnviando(true);
    setError(null);
    const { error: err } = await crearEmpresa({
      rut: formatearRut(rut),
      razonSocial: razonSocial.trim(),
      nombreFantasia: nombreFantasia.trim() || undefined,
      actividad: actividad.trim() || undefined,
    });
    setEnviando(false);
    if (err) {
      setError(err);
      return;
    }
    toast.success("Empresa creada");
    void navigate({ to: "/demo" });
  }

  async function cargarDemo() {
    setEnviando(true);
    setError(null);
    const { error: err } = await crearEmpresaDemo();
    setEnviando(false);
    if (err) {
      setError(err);
      return;
    }
    toast.success("Empresa de ejemplo lista", {
      description: "Los datos son ficticios y sirven para explorar la aplicación.",
    });
    void navigate({ to: "/demo" });
  }

  return (
    <AuthCard
      titulo="Configura tu empresa"
      descripcion="Con estos datos podemos mostrarte tus ventas, tu IVA estimado y tu reserva recomendada."
    >
      <form onSubmit={enviar} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="rut">RUT de la empresa</Label>
          <Input
            id="rut"
            required
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            onBlur={() => esRutValido(rut) && setRut(formatearRut(rut))}
            placeholder="76.543.210-K"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="razon">Razón social</Label>
          <Input
            id="razon"
            required
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
            placeholder="Comercial Los Vilos SpA"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fantasia">Nombre de fantasía (opcional)</Label>
          <Input
            id="fantasia"
            value={nombreFantasia}
            onChange={(e) => setNombreFantasia(e.target.value)}
            placeholder="Almacén Los Vilos"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="actividad">Giro o actividad (opcional)</Label>
          <Input
            id="actividad"
            value={actividad}
            onChange={(e) => setActividad(e.target.value)}
            placeholder="Venta al por menor de alimentos"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Guardando…" : "Crear empresa"}
        </Button>
      </form>

      <div className="mt-5 rounded-xl bg-secondary p-4">
        <p className="text-sm font-medium">¿Solo quieres probar?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Creamos una empresa de ejemplo con documentos ficticios. No hay conexión con
          el SII.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full"
          onClick={() => void cargarDemo()}
          disabled={enviando}
        >
          Cargar empresa de ejemplo
        </Button>
      </div>
    </AuthCard>
  );
}
