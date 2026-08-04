import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  FileCheck,
  Globe,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/shared/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { panelMasterFn } from "@/lib/cuenta.functions";
import type { PanelMaster } from "@/lib/cuenta.server";
import { cn } from "@/lib/utils";
import { formatCLP, formatFechaHora } from "@/utils/currency";

export const Route = createFileRoute("/admin/")({
  component: DashboardMasterPage,
});

function DashboardMasterPage() {
  const [panel, setPanel] = useState<PanelMaster | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (cargando) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Cargando Dashboard Master...
        </p>
      </div>
    );
  }

  if (error || !panel) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="text-base font-bold text-destructive">Error al cargar el panel Master</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          {error ?? "No fue posible verificar tus credenciales de superadministrador."}
        </p>
        <Button variant="outline" size="sm" onClick={() => void cargar()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const { totales, empresas, alertas } = panel;

  const totalEmpresas = empresas.length;
  const empresasActivas = totales.empresasActivas;
  const empresasDemo = empresas.filter((e) => e.esDemo).length;
  const empresasSuspendidas = totales.empresasSuspendidas;

  const mrrEstimado = empresasActivas * 29900; // Plan Pyme Estándar ~$29.900 CLP/mes
  const suscripcionesActivas = empresasActivas;

  const erroresRecientes = totales.errores;
  const syncsExitosas = totales.actualizacionesExitosas;

  return (
    <div className="space-y-6">
      {/* Header Titular */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Ejecutivo Master</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Monitoreo en tiempo real de clientes, salud del SII, uso de la plataforma e ingresos SaaS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void cargar()} className="h-8 text-xs gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar Datos
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5" asChild>
            <Link to="/admin/clientes">
              Ver Clientes 360°
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* BLOQUE 1: METRICAS GENERALES SAAS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CLIENTES */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">CLIENTES</span>
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums">{totalEmpresas}</span>
            <span className="text-xs text-muted-foreground ml-1.5">empresas registradas</span>
          </div>
          <div className="grid grid-cols-3 gap-1 pt-2 border-t text-[11px]">
            <div>
              <span className="block font-bold text-emerald-600 tabular-nums">{empresasActivas}</span>
              <span className="text-muted-foreground">Activas</span>
            </div>
            <div>
              <span className="block font-bold text-amber-600 tabular-nums">{empresasDemo}</span>
              <span className="text-muted-foreground">Demos</span>
            </div>
            <div>
              <span className="block font-bold text-rose-600 tabular-nums">{empresasSuspendidas}</span>
              <span className="text-muted-foreground">Suspendidas</span>
            </div>
          </div>
        </div>

        {/* INGRESOS */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">INGRESOS RECURRENTES (MRR)</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums text-emerald-600">
              {formatCLP(mrrEstimado)}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">estimado / mes</span>
          </div>
          <div className="grid grid-cols-2 gap-1 pt-2 border-t text-[11px]">
            <div>
              <span className="block font-bold text-foreground tabular-nums">{suscripcionesActivas}</span>
              <span className="text-muted-foreground">Suscripciones</span>
            </div>
            <div>
              <span className="block font-bold text-foreground tabular-nums">
                {empresas.filter((e) => e.estadoCuenta === "trial").length}
              </span>
              <span className="text-muted-foreground">En prueba</span>
            </div>
          </div>
        </div>

        {/* SISTEMA Y GATEWAY */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">SALUD DEL SISTEMA</span>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-lg font-bold text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> 100% Operational
              </span>
              <span className="text-[11px] text-muted-foreground">Conexión SII directa</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 pt-2 border-t text-[11px]">
            <div>
              <span className="block font-bold text-emerald-600 tabular-nums">{syncsExitosas}</span>
              <span className="text-muted-foreground">Syncs Exitosas</span>
            </div>
            <div>
              <span className={cn("block font-bold tabular-nums", erroresRecientes > 0 ? "text-rose-600" : "text-muted-foreground")}>
                {erroresRecientes}
              </span>
              <span className="text-muted-foreground">Errores Recientes</span>
            </div>
          </div>
        </div>

        {/* ACTIVIDAD */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">ACTIVIDAD DE PLATAFORMA</span>
            <Activity className="h-4 w-4 text-info" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums">
              {empresas.reduce((acc, e) => acc + e.periodosSincronizados, 0)}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">períodos tributarios</span>
          </div>
          <div className="grid grid-cols-2 gap-1 pt-2 border-t text-[11px]">
            <div>
              <span className="block font-bold text-foreground tabular-nums">
                {empresas.reduce((acc, e) => acc + e.usuarios, 0)}
              </span>
              <span className="text-muted-foreground">Usuarios activos</span>
            </div>
            <div>
              <span className="block font-bold text-foreground tabular-nums">
                {totales.usoCache}
              </span>
              <span className="text-muted-foreground">Respuestas Caché</span>
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE 2: ALERTAS OPERATIVAS Y ACTIVIDAD RECIENTE */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Alertas Operativas */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alertas Operativas ({alertas.length})
            </h3>
          </div>

          {alertas.length === 0 ? (
            <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
              <ShieldCheck className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
              No hay alertas pendientes. La plataforma está operando sin contratiempos.
            </div>
          ) : (
            <div className="rounded-2xl border bg-card divide-y overflow-hidden shadow-sm">
              {alertas.map((a) => (
                <div key={a.id} className="p-4 flex items-start gap-3 hover:bg-muted/40 transition-colors">
                  <AlertTriangle
                    className={cn(
                      "h-4 w-4 shrink-0 mt-0.5",
                      a.severidad === "critical" ? "text-destructive" : "text-amber-500",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-foreground truncate">
                        {a.empresa ?? "Plataforma General"}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                        {formatFechaHora(a.fecha)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{a.mensaje}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Acceso Rápido y Estado */}
        <div className="space-y-4">
          <SectionCard titulo="Acciones Rápidas B2B">
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start text-xs" asChild>
                <Link to="/admin/clientes">
                  <Building2 className="h-3.5 w-3.5 mr-2 text-primary" />
                  Gestionar Clientes (Ficha 360°)
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs" asChild>
                <Link to="/admin/landing">
                  <Globe className="h-3.5 w-3.5 mr-2 text-primary" />
                  Editar Landing y Precios Públicos
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs" asChild>
                <Link to="/panel">
                  <FileCheck className="h-3.5 w-3.5 mr-2 text-primary" />
                  Ir al Dashboard Demostrativo
                </Link>
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
