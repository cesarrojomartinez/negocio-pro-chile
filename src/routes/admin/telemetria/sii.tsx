import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listarSaludSiiMasterFn } from "@/lib/cuenta.functions";
import type { SaludSiiMaster } from "@/lib/cuenta.server";
import { cn } from "@/lib/utils";
import { formatFechaHora } from "@/utils/currency";

export const Route = createFileRoute("/admin/telemetria/sii")({
  component: SaludSiiMasterPage,
});

function SaludSiiMasterPage() {
  const [salud, setSalud] = useState<SaludSiiMaster | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  const cargar = async () => {
    setCargando(true);
    const res = await listarSaludSiiMasterFn();
    if (res.ok) {
      setSalud(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setCargando(false);
  };

  useEffect(() => {
    void cargar();
  }, []);

  if (cargando) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Cargando salud de conexión SII...
        </p>
      </div>
    );
  }

  if (error || !salud) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="text-base font-bold text-destructive">Error al cargar la telemetría del SII</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void cargar()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const syncsFiltradas = salud.historialSyncs.filter((s) => {
    const coincideBusqueda = `${s.companyName} ${s.companyRut}`
      .toLowerCase()
      .includes(busqueda.trim().toLowerCase());

    const coincideEstado = filtroEstado === "todos" ? true : s.estado === filtroEstado;
    return coincideBusqueda && coincideEstado;
  });

  return (
    <div className="space-y-6">
      {/* Header Titular */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salud del Gateway SII & Sincronización</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Monitoreo técnico en tiempo real de conexiones, disponibilidad, latencias e incidentes con el SII.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void cargar()} className="h-8 text-xs gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar Telemetría
          </Button>
        </div>
      </div>

      {/* TARJETAS KPIS DE SALUD DE INFRAESTRUCTURA */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* ESTADO GATEWAY */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Estado Gateway SII</span>
            <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
          </div>
          <div>
            <span
              className={cn(
                "text-2xl font-black flex items-center gap-2",
                salud.estadoGateway === "conectado" || salud.estadoGateway === "operativo"
                  ? "text-emerald-600"
                  : salud.estadoGateway === "demo"
                    ? "text-blue-600"
                    : salud.estadoGateway === "sin_configurar"
                      ? "text-muted-foreground"
                      : salud.estadoGateway === "desconectado" || salud.estadoGateway === "degradado"
                        ? "text-amber-500"
                        : "text-rose-600",
              )}
            >
              {salud.estadoGateway === "conectado" || salud.estadoGateway === "operativo"
                ? "🟢 Conectado"
                : salud.estadoGateway === "demo"
                  ? "🔵 Modo demostración"
                  : salud.estadoGateway === "sin_configurar"
                    ? "⚪ Sin configurar"
                    : salud.estadoGateway === "desconectado"
                      ? "🟡 Desconectado"
                      : salud.estadoGateway === "degradado"
                        ? "🟠 Degradado"
                        : "🔴 Error real"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Conexión directa con servidores SII
          </p>
        </div>

        {/* ULTIMA SYNC EXITOSA */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Última Sync Exitosa</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <span className="text-base font-bold font-mono text-foreground block">
              {salud.ultimaSyncExitosa
                ? formatFechaHora(salud.ultimaSyncExitosa)
                : "Sin registro"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Confirmación de datos más reciente
          </p>
        </div>

        {/* SYNCS 24H */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Syncs Últimas 24h</span>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums">{salud.syncsUltimas24h}</span>
            <span className="text-xs text-muted-foreground ml-1.5">operaciones</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Promedio respuesta: {salud.tiempoPromedioRespuestaMs} ms
          </p>
        </div>

        {/* ERRORES 7 DIAS */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Errores (7 Días)</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div>
            <span
              className={cn(
                "text-2xl font-black tabular-nums",
                salud.erroresUltimos7Dias > 0 ? "text-rose-600" : "text-emerald-600",
              )}
            >
              {salud.erroresUltimos7Dias}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">fallas</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            {salud.empresasAfectadasCount} empresas afectadas
          </p>
        </div>
      </div>

      {/* FILTROS Y BUSQUEDA */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por Empresa o RUT..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Estado:
            </span>
            {[
              { id: "todos", label: "Todos" },
              { id: "success", label: "Exitosos" },
              { id: "failed", label: "Fallidos" },
              { id: "pending", label: "Pendientes" },
            ].map((f) => (
              <Button
                key={f.id}
                variant={filtroEstado === f.id ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs px-2.5"
                onClick={() => setFiltroEstado(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* TABLA DE HISTORIAL DE SINCRONIZACIONES */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-muted/30">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Historial Reciente de Sincronizaciones SII ({syncsFiltradas.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y">
            <thead className="bg-muted/50 font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Empresa / RUT</th>
                <th className="p-3">Fecha y Hora</th>
                <th className="p-3">Período</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Duración</th>
                <th className="p-3 text-right">DTEs Procesados</th>
                <th className="p-3">Detalle / Error</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {syncsFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No se encontraron registros de sincronización.
                  </td>
                </tr>
              ) : (
                syncsFiltradas.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <span className="font-bold text-foreground block text-sm">{s.companyName}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">RUT: {s.companyRut}</span>
                    </td>
                    <td className="p-3 font-mono text-muted-foreground text-[11px]">
                      {formatFechaHora(s.fecha)}
                    </td>
                    <td className="p-3 font-mono font-semibold text-foreground">
                      {s.periodo}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-medium",
                          s.estado === "success"
                            ? "border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : s.estado === "failed"
                              ? "border-rose-500/30 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                              : "border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                        )}
                      >
                        {s.estado === "success" ? "Exitoso" : s.estado === "failed" ? "Fallido" : s.estado}
                      </Badge>
                    </td>
                    <td className="p-3 text-right font-mono font-medium">
                      {s.duracionMs ? `${s.duracionMs} ms` : "-"}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-foreground">
                      {s.documentosObtenidos}
                    </td>
                    <td className="p-3">
                      {s.error ? (
                        <span className="text-[11px] text-rose-600 font-medium block truncate max-w-xs" title={s.error}>
                          {s.error}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Operación sin observaciones</span>
                      )}
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
