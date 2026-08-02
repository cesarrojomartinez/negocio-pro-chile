import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Bell,
  ChevronRight,
  Menu,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MasterAppSidebar } from "./MasterAppSidebar";

export function MasterLayout({ children }: { children?: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Mapeo de rutas a breadcrumbs
  const getTituloPagina = () => {
    const path = location.pathname;
    if (path.startsWith("/admin/clientes/")) return "Ficha Cliente 360°";
    if (path === "/admin/clientes") return "Gestión de Clientes 360°";
    if (path.startsWith("/admin/planes")) return "Planes y Suscripciones SaaS";
    if (path === "/admin/telemetria/sii") return "Salud Gateway SII";
    if (path === "/admin/telemetria/api") return "Consumo & API Health";
    if (path.startsWith("/admin/telemetria")) return "Centro de Telemetría";
    if (path === "/admin/motor-tributario/versiones") return "Versiones y Reglas del Motor";
    if (path === "/admin/motor-tributario/paridad") return "Consola de Paridad SII";
    if (path === "/admin/ia-creditos/historial") return "Historial de Consumo IA";
    if (path === "/admin/ia-creditos/configuracion") return "Tarifas & Proveedores IA";
    if (path.startsWith("/admin/ia-creditos")) return "Créditos IA & Billeteras";
    if (path.startsWith("/admin/metricas")) return "Métricas SaaS — MRR & Crecimiento";
    if (path === "/admin/landing") return "Editor de Landing Page";
    return "Dashboard Ejecutivo Master";
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar Escritorio */}
      <div className="hidden lg:block lg:shrink-0">
        <MasterAppSidebar className="h-screen" />
      </div>

      {/* Sidebar Móvil Drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-72">
          <MasterAppSidebar onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Contenido Principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header Superior Master */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 lg:px-6 bg-card/50 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <Link to="/admin" className="hover:text-foreground transition-colors">
                Master SaaS
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground font-semibold">
                {getTituloPagina()}
              </span>
            </div>
          </div>

          {/* Acciones de Cabecera */}
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar cliente, RUT o email..."
                className="h-9 pl-9 text-xs rounded-lg bg-secondary/50 border-0 focus-visible:ring-1"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              asChild
            >
              <Link to="/demo">
                <Sparkles className="h-3.5 w-3.5" />
                Modo Demo
              </Link>
            </Button>

            <Button variant="ghost" size="icon" className="h-8 w-8 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500" />
              <span className="sr-only">Notificaciones</span>
            </Button>
          </div>
        </header>

        {/* Área de Trabajo Desplazable */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
