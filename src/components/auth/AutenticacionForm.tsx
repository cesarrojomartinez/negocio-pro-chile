import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { esAdministradorFn } from "@/lib/cuenta.functions";

export function AutenticacionForm({
  pestanaInicial = "login",
  destinoTrasLogin,
}: {
  pestanaInicial?: "login" | "registro";
  /** Ruta relativa del mismo origen a la que volver tras iniciar sesión. */
  destinoTrasLogin?: string;
}) {
  const { session, cargandoSesion, iniciarSesion, registrar } = useAuth();
  const navigate = useNavigate();

  const retorno =
    destinoTrasLogin && destinoTrasLogin.startsWith("/") && !destinoTrasLogin.startsWith("//")
      ? destinoTrasLogin
      : null;

  const [emailLogin, setEmailLogin] = useState("");
  const [passLogin, setPassLogin] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [emailReg, setEmailReg] = useState("");
  const [passReg, setPassReg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorLogin, setErrorLogin] = useState<string | null>(null);
  const [errorReg, setErrorReg] = useState<string | null>(null);

  useEffect(() => {
    if (cargandoSesion || !session) return;
    if (retorno) {
      window.location.href = retorno;
      return;
    }
    void navigate({ to: "/demo" });
  }, [cargandoSesion, session, navigate, retorno]);

  async function enviarLogin(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErrorLogin(null);
    const { error } = await iniciarSesion(emailLogin.trim(), passLogin);
    setEnviando(false);
    if (error) {
      setErrorLogin(error);
      return;
    }
    toast.success("Sesión iniciada");
    // El rol global se consulta en el servidor: nunca se confía en un valor
    // guardado en el navegador para abrir el panel Master.
    const rol = await esAdministradorFn();
    if (rol.ok && rol.data) {
      void navigate({ to: "/admin" });
      return;
    }
    void navigate({ to: "/demo" });
  }

  async function enviarRegistro(e: React.FormEvent) {
    e.preventDefault();
    if (passReg.length < 8) {
      setErrorReg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setEnviando(true);
    setErrorReg(null);
    const { error, requiereConfirmacion } = await registrar({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: emailReg.trim(),
      password: passReg,
    });
    setEnviando(false);
    if (error) {
      setErrorReg(error);
      return;
    }
    if (requiereConfirmacion) {
      toast.success("Revisa tu correo", {
        description: "Te enviamos un enlace para confirmar tu cuenta.",
      });
      return;
    }
    toast.success("Cuenta creada");
    void navigate({ to: "/onboarding" });
  }

  return (
    <AuthCard
      titulo="Accede a tu cuenta"
      descripcion="Guarda tus metas, reservas y estimaciones para no perderlas."
      pie={
        <span className="text-muted-foreground">
          ¿Prefieres mirar primero?{" "}
          <Link to="/demo" className="font-medium text-primary hover:underline">
            Ver la demostración
          </Link>
        </span>
      }
    >
      <Tabs defaultValue={pestanaInicial}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
          <TabsTrigger value="registro">Crear cuenta</TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="mt-5">
          <form onSubmit={enviarLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email-login">Correo electrónico</Label>
              <Input
                id="email-login"
                type="email"
                autoComplete="email"
                required
                value={emailLogin}
                onChange={(e) => setEmailLogin(e.target.value)}
                placeholder="tucorreo@ejemplo.cl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pass-login">Contraseña</Label>
              <Input
                id="pass-login"
                type="password"
                autoComplete="current-password"
                required
                value={passLogin}
                onChange={(e) => setPassLogin(e.target.value)}
              />
            </div>
            {errorLogin && (
              <p role="alert" className="text-sm text-destructive">
                {errorLogin}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando ? "Ingresando…" : "Iniciar sesión"}
            </Button>
            <Link
              to="/recuperar-clave"
              className="block text-center text-sm text-primary hover:underline"
            >
              Olvidé mi contraseña
            </Link>
          </form>
        </TabsContent>

        <TabsContent value="registro" className="mt-5">
          <form onSubmit={enviarRegistro} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apellido">Apellido</Label>
                <Input
                  id="apellido"
                  required
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-reg">Correo electrónico</Label>
              <Input
                id="email-reg"
                type="email"
                autoComplete="email"
                required
                value={emailReg}
                onChange={(e) => setEmailReg(e.target.value)}
                placeholder="tucorreo@ejemplo.cl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pass-reg">Contraseña</Label>
              <Input
                id="pass-reg"
                type="password"
                autoComplete="new-password"
                required
                value={passReg}
                onChange={(e) => setPassReg(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Usa al menos 8 caracteres.</p>
            </div>
            {errorReg && (
              <p role="alert" className="text-sm text-destructive">
                {errorReg}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando ? "Creando cuenta…" : "Crear cuenta"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </AuthCard>
  );
}
