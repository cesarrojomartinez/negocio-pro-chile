import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Calculator,
  Home,
  Receipt,
  RefreshCw,
  Settings,
  ShoppingCart,
  Target,
  UserRound,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { SimulatedDataNotice } from "@/components/shared/SimulatedDataNotice";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EMPRESA_DEMO } from "@/data/mockTaxData";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { formatFechaHora } from "@/utils/currency";
import { MENSAJE_PERIODO_SIN_SINCRONIZAR } from "@/lib/f29Antecedent";
import type { FuentePeriodo } from "@/types/tax";
import { formatearRut } from "@/lib/rut";
import { cn } from "@/lib/utils";
import { ConnectionBadge, FuentePeriodoBadge } from "./Badges";

const NAV = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/ventas", label: "Ventas", icon: Receipt },
  { to: "/compras", label: "Compras", icon: ShoppingCart },
  { to: "/impuestos", label: "Impuestos", icon: Calculator },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/configuracion", label: "Configuración", icon: Settings },
] as const;

const NAV_MOVIL = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/ventas", label: "Movimientos", icon: ArrowLeftRight },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/configuracion", label: "Ajustes", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const {
    periodoId,
    setPeriodo,
    actualizar,
    actualizando,
    estadoConexion,
    ultimaSincronizacion,
    periodosDisponibles,
    modo,
    data,
  } = useTaxDashboard();
  const { empresas, empresaActiva, seleccionarEmpresa, necesitaOnboarding } =
    useCompany();
  const navigate = useNavigate();

  useEffect(() => {
    if (necesitaOnboarding) void navigate({ to: "/onboarding" });
  }, [necesitaOnboarding, navigate]);
  const { perfil, user, cerrarSesion } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const esCloud = modo === "cloud";
  // El encabezado describe el periodo seleccionado, no la conexión de la empresa.
  // Mientras no haya datos cargados no se afirma nada sobre el origen.
  const fuentePeriodo: FuentePeriodo | null =
    data?.fuentePeriodo ?? (esCloud ? null : "mock");
  const empresaId = esCloud ? (empresaActiva?.id ?? "") : EMPRESA_DEMO.id;
  const rutVisible = esCloud
    ? empresaActiva
      ? formatearRut(empresaActiva.rut)
      : "—"
    : EMPRESA_DEMO.rut;
  const nombreUsuario = esCloud
    ? (perfil?.display_name ?? user?.email ?? "Mi cuenta")
    : "Camila Rojas";
  const detalleUsuario = esCloud
    ? (user?.email ?? "Sesión activa")
    : "Usuaria demostrativa";

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-background">
      <div className="mx-auto flex w-full max-w-[1400px]">
        {/* Barra lateral de escritorio */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-6 lg:flex">
          <Link to="/" className="mb-8 flex items-center gap-3 rounded-lg px-2 py-1">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Calculator className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-bold leading-tight">
                Mi Negocio al Día
              </span>
              <span className="block text-xs text-muted-foreground">
                Visor informativo
              </span>
            </span>
          </Link>
          <nav aria-label="Navegación principal" className="flex flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon }) => {
              const activo = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    activo
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                  aria-current={activo ? "page" : undefined}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
            Estimaciones informativas. No corresponden a una declaración oficial del
            SII.
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
              <div className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto sm:flex-1">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
                  <Calculator className="h-4.5 w-4.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <Select
                    value={empresaId}
                    onValueChange={(v) => esCloud && seleccionarEmpresa(v)}
                  >
                    <SelectTrigger
                      aria-label="Seleccionar empresa"
                      className="h-9 w-full max-w-[260px] border-0 bg-transparent px-1 font-semibold shadow-none focus-visible:ring-2"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {esCloud ? (
                        empresas.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.razonSocial}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value={EMPRESA_DEMO.id}>
                          {EMPRESA_DEMO.razonSocial}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="truncate px-1 text-xs text-muted-foreground">
                    RUT {rutVisible}
                  </p>
                </div>
              </div>

              <Select value={periodoId} onValueChange={setPeriodo}>
                <SelectTrigger
                  aria-label="Seleccionar periodo"
                  className="h-10 w-[140px] flex-1 sm:flex-none"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodosDisponibles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={() => void actualizar()}
                disabled={actualizando}
                className="h-10"
              >
                <RefreshCw
                  className={cn("h-4 w-4", actualizando && "animate-spin")}
                  aria-hidden
                />
                {actualizando ? "Actualizando" : "Actualizar"}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    aria-label="Perfil del usuario"
                  >
                    <UserRound className="h-4.5 w-4.5" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    {nombreUsuario}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {detalleUsuario}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/configuracion">Configuración</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/impuestos">Estimación tributaria</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {esCloud ? (
                    <DropdownMenuItem onSelect={() => void cerrarSesion()}>
                      Cerrar sesión
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem asChild>
                      <Link to="/auth">Iniciar sesión</Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3 sm:px-6">
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Empresa:</span>
                <ConnectionBadge estado={estadoConexion} />
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  Fuente del periodo:
                </span>
                <FuentePeriodoBadge fuente={fuentePeriodo} />
              </span>
              <span className="text-xs text-muted-foreground">
                {fuentePeriodo === "accountant_confirmed"
                  ? "Antecedentes confirmados por tu contador."
                  : estadoConexion === "stale"
                    ? `Información desactualizada. Última sincronización: ${formatFechaHora(ultimaSincronizacion)}`
                    : `Última sincronización: ${formatFechaHora(ultimaSincronizacion)}`}
              </span>
            </div>
          </header>

          <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
            {fuentePeriodo === "mock" && (
              <SimulatedDataNotice className="mb-4" compacto />
            )}
            {fuentePeriodo === "not_synchronized" && (
              <div
                role="note"
                className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-warning-soft px-3 py-2 text-xs font-medium text-warning-foreground"
              >
                <span>{MENSAJE_PERIODO_SIN_SINCRONIZAR}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => void actualizar()}
                  disabled={actualizando}
                >
                  {actualizando ? "Sincronizando" : "Sincronizar este periodo"}
                </Button>
              </div>
            )}

            {children}
          </main>

        </div>
      </div>

      {/* Navegación inferior móvil */}
      <nav
        aria-label="Navegación móvil"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {NAV_MOVIL.map(({ to, label, icon: Icon }) => {
            const activo =
              pathname === to ||
              (to === "/ventas" && (pathname === "/compras" || pathname === "/impuestos"));
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  aria-current={activo ? "page" : undefined}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium",
                    activo ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
