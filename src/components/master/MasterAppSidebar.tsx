import { Link, useLocation } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  Coins,
  Cpu,
  CreditCard,
  FileText,
  Globe,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Radio,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface NavItem {
  titulo: string;
  ruta: string;
  icono: React.ElementType;
  badge?: string;
  proximamente?: boolean;
}

interface NavGrupo {
  titulo: string;
  items: NavItem[];
}

const GRUPOS_NAVEGACION: NavGrupo[] = [
  {
    titulo: "GESTIÓN PRINCIPAL",
    items: [
      {
        titulo: "Dashboard Ejecutivo",
        ruta: "/admin",
        icono: LayoutDashboard,
      },
      {
        titulo: "Clientes 360°",
        ruta: "/admin/clientes",
        icono: Building2,
      },
    ],
  },
  {
    titulo: "COMERCIAL",
    items: [
      {
        titulo: "Planes y Suscripciones",
        ruta: "/admin/planes",
        icono: CreditCard,
      },
      {
        titulo: "Métricas SaaS (MRR)",
        ruta: "/admin/metricas",
        icono: BarChart3,
      },
    ],
  },
  {
    titulo: "INTELIGENCIA ARTIFICIAL",
    items: [
      {
        titulo: "Billeteras de Créditos IA",
        ruta: "/admin/ia-creditos",
        icono: Coins,
      },
      {
        titulo: "Historial de Consumo IA",
        ruta: "/admin/ia-creditos/historial",
        icono: History,
      },
      {
        titulo: "Tarifas & Proveedores IA",
        ruta: "/admin/ia-creditos/configuracion",
        icono: Bot,
      },
    ],
  },
  {
    titulo: "INFRAESTRUCTURA Y TELEMETRÍA",
    items: [
      {
        titulo: "Centro de Telemetría",
        ruta: "/admin/telemetria",
        icono: Activity,
      },
      {
        titulo: "Salud Gateway SII",
        ruta: "/admin/telemetria/sii",
        icono: Radio,
      },
      {
        titulo: "Consumo y API Health",
        ruta: "/admin/telemetria/api",
        icono: Zap,
      },
    ],
  },
  {
    titulo: "MOTOR TRIBUTARIO ESPEJO",
    items: [
      {
        titulo: "Versiones y Reglas",
        ruta: "/admin/motor-tributario/versiones",
        icono: Cpu,
        badge: "v1.0",
      },
      {
        titulo: "Consola de Paridad",
        ruta: "/admin/motor-tributario/paridad",
        icono: ShieldCheck,
      },
      {
        titulo: "Comunicación In-App",
        ruta: "/admin/comunicacion",
        icono: MessageSquare,
      },
    ],
  },
  {
    titulo: "MARKETING Y CONFIG",
    items: [
      {
        titulo: "Configuración Global",
        ruta: "/admin/configuracion",
        icono: SlidersHorizontal,
      },
      {
        titulo: "Editor de Landing",
        ruta: "/admin/landing",
        icono: Globe,
      },
      {
        titulo: "Mi Cuenta Admin",
        ruta: "/admin/cuenta",
        icono: Settings,
      },
    ],
  },
];

export function MasterAppSidebar({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const { user, cerrarSesion } = useAuth();
  const location = useLocation();

  const userEmail = user?.email ?? "admin@negocioaldia.cl";
  const userInitial = userEmail.charAt(0).toUpperCase();

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      {/* Header Marca */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        <Link
          to="/admin"
          onClick={onNavigate}
          className="flex items-center gap-2 font-bold text-foreground hover:opacity-90 transition-opacity"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-sm shadow-sm">
            MN
          </div>
          <div className="flex flex-col">
            <span className="text-sm leading-none font-bold">Mi Negocio al Día</span>
            <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
              CENTER MASTER 2.0
            </span>
          </div>
        </Link>
        <Badge variant="outline" className="text-[10px] font-semibold border-primary/40 bg-primary/5 text-primary">
          SaaS Admin
        </Badge>
      </div>

      {/* Estado del Sistema */}
      <div className="mx-3 mt-3 rounded-lg border bg-secondary/50 p-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-500" />
            Gateway SII
          </span>
          <span className="font-mono text-[10px] text-emerald-600 font-bold">ONLINE</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Motor Tributario</span>
          <span className="font-mono">v1.0 (Espejo)</span>
        </div>
      </div>

      {/* Navegación por Grupos */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {GRUPOS_NAVEGACION.map((grupo) => (
          <div key={grupo.titulo} className="space-y-1">
            <h4 className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {grupo.titulo}
            </h4>
            <nav className="space-y-0.5">
              {grupo.items.map((item) => {
                const activo =
                  item.ruta === "/admin"
                    ? location.pathname === "/admin"
                    : location.pathname.startsWith(item.ruta);
                const Icono = item.icono;

                if (item.proximamente) {
                  return (
                    <div
                      key={item.ruta}
                      className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-muted-foreground/60 cursor-not-allowed"
                      title="Módulo planificado para la siguiente fase"
                    >
                      <div className="flex items-center gap-2">
                        <Icono className="h-4 w-4 shrink-0" />
                        <span>{item.titulo}</span>
                      </div>
                      {item.badge && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.ruta}
                    to={item.ruta as any}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      activo
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icono className="h-4 w-4 shrink-0" />
                      <span>{item.titulo}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-semibold",
                          activo
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-secondary text-foreground",
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer Usuario Administrator */}
      <div className="border-t p-3 space-y-2 bg-secondary/30">
        <div className="flex items-center gap-2.5 px-1">
          <Avatar className="h-8 w-8 border">
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
              {userInitial}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="truncate text-xs font-semibold text-foreground">
              {userEmail}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
              <ShieldCheck className="h-3 w-3 text-primary" />
              SuperAdmin
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] justify-center px-2"
            asChild
          >
            <Link to="/demo">
              <Home className="h-3 w-3 mr-1" />
              Ver aplicación
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] justify-center px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => void cerrarSesion()}
          >
            <LogOut className="h-3 w-3 mr-1" />
            Salir
          </Button>
        </div>
      </div>
    </aside>
  );
}
