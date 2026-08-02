import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpDown,
  Building2,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ETIQUETA_ESTADO, type EstadoCuenta } from "@/lib/cuenta";
import { cambiarEstadoCuentaFn, panelMasterFn } from "@/lib/cuenta.functions";
import type { FichaCliente, PanelMaster } from "@/lib/cuenta.server";
import { cn } from "@/lib/utils";
import { formatFechaHora } from "@/utils/currency";

export const Route = createFileRoute("/admin/clientes/")({
  component: ClientesMasterPage,
});

type FiltroEstado = "todos" | "active" | "trial" | "suspended" | "cancelled";
type OrdenCampo = "alta" | "razonSocial" | "consultasMes";

const CLASE_ESTADO: Record<EstadoCuenta, string> = {
  active: "border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  trial: "border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  payment_pending: "border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  suspended: "border-rose-500/30 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  cancelled: "border-secondary bg-secondary text-muted-foreground",
};

function ClientesMasterPage() {
  const [panel, setPanel] = useState<PanelMaster | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de Filtro y Búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [orden, setOrden] = useState<OrdenCampo>("alta");
  const [ordenAsc, setOrdenAsc] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const res = await panelMasterFn();
    if (res.ok) {
      setPanel(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setCargando(false);
  };

  useEffect(() => {
    void cargar();
  }, []);

  const cambiarEstado = async (companyId: string, estado: EstadoCuenta) => {
    const res = await cambiarEstadoCuentaFn({ data: { companyId, estado } });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Cuenta ${estado === "active" ? "activada" : "suspendida"} con éxito.`);
    await cargar();
  };

  if (cargando) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Cargando directorio de clientes...
        </p>
      </div>
    );
  }

  if (error || !panel) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="text-base font-bold text-destructive font-sans">Error al cargar clientes</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void cargar()}>
          Reintentar
        </Button>
      </div>
    );
  }

  // Filtrado y Ordenamiento
  const empresasFiltradas = panel.empresas
    .filter((e) => {
      const coincideBusqueda = `${e.razonSocial} ${e.rut}`
        .toLowerCase()
        .includes(busqueda.trim().toLowerCase());
      const coincideEstado =
        filtroEstado === "todos"
          ? true
          : filtroEstado === "trial"
            ? e.estadoCuenta === "trial" || e.esDemo
            : e.estadoCuenta === filtroEstado;

      return coincideBusqueda && coincideEstado;
    })
    .sort((a, b) => {
      let valA: any = a[orden];
      let valB: any = b[orden];

      if (orden === "alta") {
        valA = new Date(a.alta).getTime();
        valB = new Date(b.alta).getTime();
      }

      if (valA < valB) return ordenAsc ? -1 : 1;
      if (valA > valB) return ordenAsc ? 1 : -1;
      return 0;
    });

  return (
    <div className="space-y-6">
      {/* Header Titular */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Clientes 360°</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Directorio completo de empresas, organizaciones, planes, estado de cuenta y telemetría.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void cargar()} className="h-8 text-xs gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refrescar
          </Button>
        </div>
      </div>

      {/* BARRA DE BUSQUEDA Y FILTROS */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por Razón Social o RUT..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          {/* Filtros por Estado */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Estado:
            </span>
            {[
              { id: "todos", label: "Todos" },
              { id: "active", label: "Activos" },
              { id: "trial", label: "Demos / Prueba" },
              { id: "suspended", label: "Suspendidos" },
              { id: "cancelled", label: "Cancelados" },
            ].map((f) => (
              <Button
                key={f.id}
                variant={filtroEstado === f.id ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs px-2.5"
                onClick={() => setFiltroEstado(f.id as FiltroEstado)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* TABLA AVANZADA DE CLIENTES */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/50 font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">
                  <button
                    className="flex items-center gap-1 hover:text-foreground font-semibold"
                    onClick={() => {
                      if (orden === "razonSocial") setOrdenAsc(!ordenAsc);
                      else {
                        setOrden("razonSocial");
                        setOrdenAsc(true);
                      }
                    }}
                  >
                    Razón Social / RUT <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="p-3">Plan</th>
                <th className="p-3">Estado Cuenta</th>
                <th className="p-3">
                  <button
                    className="flex items-center gap-1 hover:text-foreground font-semibold"
                    onClick={() => {
                      if (orden === "alta") setOrdenAsc(!ordenAsc);
                      else {
                        setOrden("alta");
                        setOrdenAsc(false);
                      }
                    }}
                  >
                    Alta <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="p-3">Última Sync SII</th>
                <th className="p-3 text-right">
                  <button
                    className="flex items-center gap-1 ml-auto hover:text-foreground font-semibold"
                    onClick={() => {
                      if (orden === "consultasMes") setOrdenAsc(!ordenAsc);
                      else {
                        setOrden("consultasMes");
                        setOrdenAsc(false);
                      }
                    }}
                  >
                    Consumo Mes <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="p-3 text-center">Usuarios</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {empresasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No se encontraron empresas con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                empresasFiltradas.map((e) => (
                  <tr key={e.companyId} className="hover:bg-muted/30 transition-colors">
                    {/* Razón Social y RUT */}
                    <td className="p-3">
                      <div className="font-bold text-foreground text-sm flex items-center gap-2">
                        <span>{e.razonSocial}</span>
                        {e.esDemo && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal bg-secondary">
                            Demo
                          </Badge>
                        )}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground mt-0.5">
                        RUT: {e.rut}
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="p-3">
                      <span className="font-semibold text-foreground">{e.plan}</span>
                    </td>

                    {/* Estado Cuenta */}
                    <td className="p-3">
                      <Badge variant="outline" className={cn("text-[11px] font-medium", CLASE_ESTADO[e.estadoCuenta])}>
                        {ETIQUETA_ESTADO[e.estadoCuenta] ?? e.estadoCuenta}
                      </Badge>
                    </td>

                    {/* Alta */}
                    <td className="p-3 text-muted-foreground font-mono text-[11px]">
                      {new Date(e.alta).toLocaleDateString("es-CL")}
                    </td>

                    {/* Última Sync */}
                    <td className="p-3 text-muted-foreground text-[11px]">
                      {e.ultimaActualizacion
                        ? formatFechaHora(e.ultimaActualizacion)
                        : "Sin registro"}
                    </td>

                    {/* Consumo Mes */}
                    <td className="p-3 text-right font-mono">
                      <div className="font-bold">{e.consultasMes} reqs</div>
                      <div className="text-[10px] text-muted-foreground">{e.periodosSincronizados} períodos</div>
                    </td>

                    {/* Usuarios */}
                    <td className="p-3 text-center font-bold">
                      <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {e.usuarios}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5 font-medium gap-1"
                          asChild
                        >
                          <Link to="/admin/clientes/$companyId" params={{ companyId: e.companyId }}>
                            Ficha 360°
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>

                        {e.estadoCuenta === "active" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] text-destructive hover:bg-destructive/10"
                            onClick={() => void cambiarEstado(e.companyId, "suspended")}
                          >
                            Suspender
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] text-emerald-600 hover:bg-emerald-50"
                            onClick={() => void cambiarEstado(e.companyId, "active")}
                          >
                            Activar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
