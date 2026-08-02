import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Globe,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listarApiHealthMasterFn } from "@/lib/cuenta.functions";
import type { ApiHealthMaster } from "@/lib/cuenta.server";
import { cn } from "@/lib/utils";
import { formatFechaHora } from "@/utils/currency";

export const Route = createFileRoute("/admin/telemetria/api")({
  component: ApiHealthMasterPage,
});

function ApiHealthMasterPage() {
  const [apiHealth, setApiHealth] = useState<ApiHealthMaster | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    const res = await listarApiHealthMasterFn();
    if (res.ok) {
      setApiHealth(res.data);
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
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Cargando telemetría de APIs...
        </p>
      </div>
    );
  }

  if (error || !apiHealth) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="text-base font-bold text-destructive">Error al cargar la telemetría de APIs</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void cargar()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const maxLlamadas = Math.max(
    ...apiHealth.historialDiario30Dias.map((d) => d.exitosas + d.fallidas),
    1,
  );

  return (
    <div className="space-y-6">
      {/* Header Titular */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Consumo y Telemetría API Health</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Estadísticas detalladas de tráfico, porcentajes de éxito, latencias y registro de errores de API.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void cargar()} className="h-8 text-xs gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refrescar
          </Button>
        </div>
      </div>

      {/* METRICAS GENERALES API */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Total Llamadas API</span>
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums">{apiHealth.totalLlamadas}</span>
            <span className="text-xs text-muted-foreground ml-1.5 font-medium">peticiones</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Volumen acumulado evaluado
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Tasa de Éxito</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums text-emerald-600">
              {apiHealth.porcentajeExito}%
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Peticiones completadas correctamente
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Tasa de Error</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div>
            <span
              className={cn(
                "text-2xl font-black tabular-nums",
                apiHealth.porcentajeError > 5 ? "text-rose-600" : "text-muted-foreground",
              )}
            >
              {apiHealth.porcentajeError}%
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Incidentes o caídas del servicio
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Latencia Promedio</span>
            <Clock className="h-4 w-4 text-info" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums font-mono">
              {apiHealth.latenciaPromedioMs} ms
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Tiempo promedio de ida y vuelta
          </p>
        </div>
      </div>

      {/* GRAFICO VISUAL HISTORIAL 30 DIAS */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Tráfico Diario y Latencia (Últimos 30 Días)
          </h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Exitosas
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Fallidas
            </span>
          </div>
        </div>

        <div className="flex h-48 items-end gap-1.5 pt-6 pb-2 border-b overflow-x-auto">
          {apiHealth.historialDiario30Dias.map((d) => {
            const total = d.exitosas + d.fallidas;
            const pctAltura = Math.max(10, Math.round((total / maxLlamadas) * 100));
            const pctExito = total > 0 ? (d.exitosas / total) * 100 : 100;

            return (
              <div
                key={d.fecha}
                className="flex-1 flex flex-col items-center gap-1 min-w-[16px] group relative"
              >
                {/* Tooltip Hover */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block z-20 rounded-lg bg-popover p-2 text-[10px] text-popover-foreground shadow-md border whitespace-nowrap">
                  <div className="font-bold">{d.fecha}</div>
                  <div>Exitosas: {d.exitosas}</div>
                  <div>Fallidas: {d.fallidas}</div>
                  <div>Latencia: {d.latenciaMs} ms</div>
                </div>

                <div
                  className="w-full rounded-t transition-all flex flex-col overflow-hidden"
                  style={{ height: `${pctAltura}%` }}
                >
                  <div
                    className="bg-emerald-500 w-full"
                    style={{ height: `${pctExito}%` }}
                  />
                  <div
                    className="bg-rose-500 w-full flex-1"
                  />
                </div>
                <span className="text-[9px] text-muted-foreground font-mono truncate w-full text-center">
                  {d.fecha.slice(8)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* REGISTRO DE ULTIMOS ERRORES */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-muted/30">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" /> Registro de Últimos Errores de API ({apiHealth.ultimosErrores.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y">
            <thead className="bg-muted/50 font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Fecha y Hora</th>
                <th className="p-3">Empresa</th>
                <th className="p-3">Proveedor</th>
                <th className="p-3">Código Error</th>
                <th className="p-3">Mensaje de Error</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {apiHealth.ultimosErrores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No se han registrado errores de API recientemente.
                  </td>
                </tr>
              ) : (
                apiHealth.ultimosErrores.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-muted-foreground text-[11px]">
                      {formatFechaHora(e.fecha)}
                    </td>
                    <td className="p-3 font-bold text-foreground">{e.companyName}</td>
                    <td className="p-3 text-muted-foreground">{e.proveedor}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px] font-mono text-rose-600 border-rose-500/30">
                        {e.codigoError}
                      </Badge>
                    </td>
                    <td className="p-3 text-rose-600 font-medium">
                      {e.mensajeError}
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
