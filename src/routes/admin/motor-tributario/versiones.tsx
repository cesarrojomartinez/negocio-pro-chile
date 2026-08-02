import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileCheck,
  GitBranch,
  History,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listarVersionesMotorMasterFn } from "@/lib/cuenta.functions";
import type { VersionesMotorMaster } from "@/lib/cuenta.server";
import { cn } from "@/lib/utils";
import { formatFechaHora } from "@/utils/currency";

export const Route = createFileRoute("/admin/motor-tributario/versiones")({
  component: VersionesMotorMasterPage,
});

function VersionesMotorMasterPage() {
  const [versiones, setVersiones] = useState<VersionesMotorMaster | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    const res = await listarVersionesMotorMasterFn();
    if (res.ok) {
      setVersiones(res.data);
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
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Cargando versiones del motor tributario...
        </p>
      </div>
    );
  }

  if (error || !versiones) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="text-base font-bold text-destructive font-sans">Error al cargar versiones del motor</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void cargar()}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Titular */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Control de Versiones del Motor Tributario</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Registro de versiones activas de motor, reglas de cálculo de F29 e historial de paridad.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void cargar()} className="h-8 text-xs gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refrescar Versiones
          </Button>
        </div>
      </div>

      {/* VERSION ACTIVA DESTACADA */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-lg border">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">Motor Espejo Unificado</h2>
                <Badge variant="outline" className="text-xs border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold">
                  Versión Activa en Producción
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                Engine: {versiones.engineVersion} · Ruleset: {versiones.rulesVersion} · Shadow Projection: {versiones.projectionVersion}
              </p>
            </div>
          </div>

          <Badge variant="outline" className="text-xs font-mono bg-secondary gap-1">
            <Lock className="h-3 w-3 text-muted-foreground" />
            Modo Solo Lectura
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t pt-4 text-xs">
          <div>
            <span className="block text-muted-foreground text-[11px]">Garantía de Certeza</span>
            <span className="font-bold text-emerald-600 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> 100% Sin Estimaciones
            </span>
          </div>
          <div>
            <span className="block text-muted-foreground text-[11px]">Algoritmo IVA Débito</span>
            <span className="font-semibold text-foreground">Trace DTE Completo</span>
          </div>
          <div>
            <span className="block text-muted-foreground text-[11px]">Algoritmo IVA Crédito</span>
            <span className="font-semibold text-foreground">Proporcional & Trace</span>
          </div>
          <div>
            <span className="block text-muted-foreground text-[11px]">Paridad Espejo SII</span>
            <span className="font-mono font-bold text-emerald-600">Golden Parity v1.0</span>
          </div>
        </div>
      </div>

      {/* REGLAS DEL MOTOR ACTIVAS */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-muted/30">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Reglas Tributarias Habilitadas ({versiones.reglasActivas.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y">
            <thead className="bg-muted/50 font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Código Regla</th>
                <th className="p-3">Nombre de la Regla</th>
                <th className="p-3">Categoría</th>
                <th className="p-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {versiones.reglasActivas.map((r) => (
                <tr key={r.codigo} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-mono font-bold text-foreground">{r.codigo}</td>
                  <td className="p-3 font-medium text-foreground">{r.nombre}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-[10px]">
                      {r.categoria}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 font-medium">
                      {r.estado}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* HISTORIAL DE VERSIONES */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-muted/30">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Historial de Versiones del Motor
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y">
            <thead className="bg-muted/50 font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Versión Engine</th>
                <th className="p-3">Ruleset</th>
                <th className="p-3">Fecha Publicación</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Casos Evaluados</th>
                <th className="p-3 text-right">Resultado Paridad</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {versiones.historialVersiones.map((v) => (
                <tr key={v.version} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-mono font-bold text-foreground">{v.version}</td>
                  <td className="p-3 font-mono text-muted-foreground">{v.rulesVersion}</td>
                  <td className="p-3 font-mono text-muted-foreground text-[11px]">
                    {formatFechaHora(v.fechaPublicacion)}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-medium",
                        v.estado === "activa"
                          ? "border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40"
                          : "border-secondary bg-secondary text-muted-foreground",
                      )}
                    >
                      {v.estado}
                    </Badge>
                  </td>
                  <td className="p-3 text-right font-mono font-bold">{v.casosEvaluados}</td>
                  <td className="p-3 text-right font-semibold text-emerald-600">{v.resultadoParidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
