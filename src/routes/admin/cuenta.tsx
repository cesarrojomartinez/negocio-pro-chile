import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, LogOut, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/shared/SectionCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin/cuenta")({
  head: () => ({
    meta: [
      { title: "Mi Cuenta Admin | Master 2.0" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminCuentaPage,
});

function AdminCuentaPage() {
  const { user, perfil, cerrarSesion } = useAuth();
  const esAdministrador = true;

  const email = user?.email ?? "admin@negocioaldia.cl";
  const inicial = email.charAt(0).toUpperCase();

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Mi Cuenta de Administración</h1>
        <p className="text-sm text-muted-foreground">
          Gestión de tu perfil de SuperAdmin del panel Master 2.0 y credenciales de acceso.
        </p>
      </header>

      {/* Tarjeta de Perfil Admin */}
      <SectionCard titulo="Perfil de Administrador Master">
        <div className="flex flex-wrap items-center justify-between gap-4 p-2">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-sm">
              <AvatarFallback className="bg-primary/10 text-primary font-black text-xl">
                {inicial}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">{email}</h3>
                {esAdministrador ? (
                  <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" /> SuperAdmin
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    Usuario Cliente
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                ID de Usuario: {user?.id ?? "No disponible"}
              </p>
              <p className="text-xs text-muted-foreground">
                Rol del sistema: <span className="font-semibold text-foreground">Administrador Master</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              asChild
            >
              <Link to="/actualizar-clave">
                <KeyRound className="h-4 w-4" /> Cambiar Contraseña
              </Link>
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => {
                toast.info("Cerrando sesión de administración...");
                void cerrarSesion();
              }}
            >
              <LogOut className="h-4 w-4" /> Cerrar Sesión
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* Seguridad & Permisos */}
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard titulo="Permisos del Sistema">
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Acceso a Dashboard Ejecutivo Master</span>
              <UserCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Gestión de Clientes & RLS Bypassing</span>
              <UserCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Configuración Global & Credenciales SII</span>
              <UserCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Billeteras & Tarifas de Inteligencia Artificial</span>
              <UserCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Publicación de Landing & Marketing</span>
              <UserCheck className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
        </SectionCard>

        <SectionCard titulo="Seguridad de la Sesión">
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Proveedor de Autenticación</span>
              <span className="font-semibold text-foreground">Supabase Auth (Servidor)</span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Modo de Verificación</span>
              <span className="font-semibold text-emerald-600">Bearer Token Validado</span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Seguridad Server Functions</span>
              <span className="font-semibold text-foreground">requireSupabaseAuth</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Auditoría RLS</span>
              <span className="font-semibold text-foreground">Rol Admin Activo</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
