import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MasterLayout } from "@/components/master/MasterLayout";
import { esAdministradorFn } from "@/lib/cuenta.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Center Master B2B | Mi Negocio al Día" },
      {
        name: "description",
        content: "Centro de control ejecutivo SaaS para la administración de Mi Negocio al Día.",
      },
      { property: "og:title", content: "Center Master B2B | Mi Negocio al Día" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayoutRoute,
});

function AdminLayoutRoute() {
  const navigate = useNavigate();
  const [autorizado, setAutorizado] = useState<boolean | null>(null);

  useEffect(() => {
    let activo = true;

    const verificar = async () => {
      let permitido = false;
      try {
        const r = await esAdministradorFn();
        permitido = r.ok === true && r.data === true;
      } catch {
        permitido = false;
      }
      if (!activo) return;
      setAutorizado(permitido);
      if (!permitido) {
        toast.error("No eres administrador", {
          description: "Esta sección es solo para la cuenta de administración.",
        });
        navigate({ to: "/", replace: true });
      }
    };

    void verificar();
    return () => {
      activo = false;
    };
  }, [navigate]);

  if (autorizado !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">
          {autorizado === null ? "Verificando tus permisos…" : "No eres administrador. Te llevamos al inicio…"}
        </p>
      </div>
    );
  }

  return (
    <MasterLayout>
      <Outlet />
    </MasterLayout>
  );
}

