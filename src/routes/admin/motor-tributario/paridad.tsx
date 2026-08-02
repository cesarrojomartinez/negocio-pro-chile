import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  Cpu,
  FileCheck,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listarResultadosParidadMasterFn } from "@/lib/cuenta.functions";
import type { ParidadResultadoMaster } from "@/lib/cuenta.server";
import { cn } from "@/lib/utils";
import { formatCLP, formatFechaHora } from "@/utils/currency";

export const Route = createFileRoute("/admin/motor-tributario/paridad")({
  component: ConsolaParidadMasterPage,
});

function ConsolaParidadMasterPage() {
  const [paridad, setParidad] = useState<ParidadResultadoMaster | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  const cargar = async () => {
    setCargando(true);
    const res = await listarResultadosParidadMasterFn();
    if (res.ok) {
      setParidad(res.data);
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
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Cargando consola de paridad SII vs Motor...
        </p>
      </div>
    );
  }

  if (error || !paridad) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="text-base font-bold text-destructive font-sans">Error al cargar la consola de paridad</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void cargar()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const casosFiltrados = paridad.casos.filter((c) => {
    const coincideBusqueda = `${c.companyName} ${c.companyRut} ${c.periodo}`
      .toLowerCase()
      .includes(busqueda.trim().toLowerCase());

    const coincideEstado = filtroEstado === "todos" ? true : c.estado === filtroEstado;
    return coincideBusqueda && coincideEstado;
  });

  return (
    <div className="space-y-6">
      {/* Header Titular */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Consola de Paridad SII vs Motor Espejo</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Auditoría comparativa y verificación matemática entre las declaraciones F29 del SII y los cálculos del motor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void cargar()} className="h-8 text-xs gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refrescar Paridad
          </Button>
        </div>
      </div>

      {/* METRICAS DE PARIDAD */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Casos Evaluados</span>
            <FileCheck className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums">{paridad.resumen.totalCasos}</span>
            <span className="text-xs text-muted-foreground ml-1.5">períodos verificados</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Pruebas completadas
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>✅ Coinciden 100%</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums text-emerald-600 font-sans">
              {paridad.resumen.coinciden}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">casos exactos</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Paridad matemática perfecta
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>⚠️ Con Diferencia</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <span
              className={cn(
                "text-2xl font-black tabular-nums font-sans",
                paridad.resumen.conDiferencia > 0 ? "text-amber-500" : "text-muted-foreground",
              )}
            >
              {paridad.resumen.conDiferencia}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">observaciones</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Diferencias no bloqueantes
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>❌ Errores Bloqueantes</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div>
            <span
              className={cn(
                "text-2xl font-black tabular-nums font-sans",
                paridad.resumen.conError > 0 ? "text-rose-600" : "text-emerald-600",
              )}
            >
              {paridad.resumen.conError}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5 font-medium">errores</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Descalces de reglas
          </p>
        </div>
      </div>

      {/* FILTROS Y BUSQUEDA */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por Empresa, RUT o Período..."
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
              { id: "coincide", label: "✅ Coincide" },
              { id: "diferencia", label: "⚠️ Diferencia" },
              { id: "error", label: "❌ Error" },
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

      {/* TABLA DE CASOS EVALUADOS */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-muted/30">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" /> Casos Evaluados de Paridad SII vs Motor ({casosFiltrados.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y">
            <thead className="bg-muted/50 font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Período</th>
                <th className="p-3">Empresa / RUT</th>
                <th className="p-3">Estado Paridad</th>
                <th className="p-3 text-right">Monto SII</th>
                <th className="p-3 text-right">Monto Motor</th>
                <th className="p-3 text-right">Diferencia</th>
                <th className="p-3">Explicación de Auditoría</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {casosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No se encontraron resultados de paridad para los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                casosFiltrados.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono font-bold text-foreground text-sm">{c.periodo}</td>
                    <td className="p-3">
                      <span className="font-bold text-foreground block text-sm">{c.companyName}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">RUT: {c.companyRut}</span>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-medium",
                          c.estado === "coincide"
                            ? "border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : c.estado === "diferencia"
                              ? "border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                              : "border-rose-500/30 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
                        )}
                      >
                        {c.estado === "coincide"
                          ? "✅ Coincide 100%"
                          : c.estado === "diferencia"
                            ? "⚠️ Diferencia"
                            : "❌ Error"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right font-mono font-medium">
                      {formatCLP(c.montoSii)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-foreground">
                      {formatCLP(c.montoMotor)}
                    </td>
                    <td
                      className={cn(
                        "p-3 text-right font-mono font-bold",
                        c.diferencia === 0
                          ? "text-emerald-600"
                          : c.diferencia > 0
                            ? "text-amber-600"
                            : "text-rose-600",
                      )}
                    >
                      {c.diferencia === 0 ? "$0" : formatCLP(c.diferencia)}
                    </td>
                    <td className="p-3">
                      <span className="text-[11px] text-muted-foreground font-medium block max-w-sm">
                        {c.explicacion}
                      </span>
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
