import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  CreditCard,
  DollarSign,
  FileCheck,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CustomerGrowthChart } from "@/components/master/metrics/CustomerGrowthChart";
import { MetricCard } from "@/components/master/metrics/MetricCard";
import { RevenueChart } from "@/components/master/metrics/RevenueChart";
import { UsageChart } from "@/components/master/metrics/UsageChart";
import { listarMetricasSaaSMasterFn } from "@/lib/cuenta.functions";
import type { MetricasSaaSMaster } from "@/lib/cuenta.server";
import { formatCLP } from "@/utils/currency";

export const Route = createFileRoute("/admin/metricas/")({
  component: MetricasSaaSIndexPage,
});

function MetricasSaaSIndexPage() {
  const [metricas, setMetricas] = useState<MetricasSaaSMaster | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    const res = await listarMetricasSaaSMasterFn();
    if (res.ok) {
      setMetricas(res.data);
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
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Cargando métricas comerciales SaaS...
        </p>
      </div>
    );
  }

  if (error || !metricas) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="text-base font-bold text-destructive">Error al cargar métricas comerciales</h3>
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
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Ejecutivo de Métricas SaaS</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Control comercial integral: MRR, ARR, crecimiento de clientes, tasas de conversión y uso de plataforma.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void cargar()} className="h-8 text-xs gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar Métricas
          </Button>
        </div>
      </div>

      {/* METRICAS CLAVE INGRESOS Y MRR */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Ingresos Recurrentes & Financiero
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            titulo="MRR (Ingreso Mensual)"
            valor={formatCLP(metricas.ingresos.mrr)}
            tendenciaPct={metricas.ingresos.crecimientoMrrPct}
            subtitulo="Total suscripciones activas mensuales"
            icono={DollarSign}
          />
          <MetricCard
            titulo="ARR (Ingreso Anual Estimado)"
            valor={formatCLP(metricas.ingresos.arr)}
            subtitulo="Proyección anualizada de ingresos"
            icono={TrendingUp}
          />
          <MetricCard
            titulo="Ingresos Mes Actual"
            valor={formatCLP(metricas.ingresos.ingresosMesActual)}
            subtitulo="Facturación cerrada este período"
            icono={CreditCard}
          />
          <MetricCard
            titulo="Crecimiento MRR MoM"
            valor={`+${metricas.ingresos.crecimientoMrrPct}%`}
            subtitulo="Variación mes contra mes anterior"
            icono={BarChart3}
          />
        </div>
      </div>

      {/* METRICAS CLIENTES Y CHURN */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Clientes, Conversión & Churn
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            titulo="Total Empresas"
            valor={metricas.clientes.totalEmpresas}
            subtitulo="Empresas registradas en la plataforma"
            icono={Building2}
          />
          <MetricCard
            titulo="Clientes Activos (Pago)"
            valor={metricas.clientes.clientesActivos}
            subtitulo="Suscripciones activas de pago"
            icono={UserCheck}
          />
          <MetricCard
            titulo="Clientes Demo / Trial"
            valor={metricas.clientes.clientesTrial}
            subtitulo="En período de evaluación"
            icono={Users}
          />
          <MetricCard
            titulo="Tasa de Churn"
            valor={`${metricas.clientes.churnRatePct}%`}
            subtitulo="Suscripciones canceladas"
            icono={Activity}
          />
        </div>
      </div>

      {/* GRAFICOS VISUALES */}
      <div className="grid gap-6 md:grid-cols-2">
        <RevenueChart historial={metricas.historialMrr} />
        <CustomerGrowthChart historial={metricas.historialCrecimiento} />
      </div>

      {/* USO DE PLATAFORMA */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Carga de Plataforma & Adopción
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            titulo="Usuarios Activos"
            valor={metricas.uso.usuariosActivos}
            subtitulo="Usuarios con sesión este mes"
            icono={Users}
          />
          <MetricCard
            titulo="Syncs SII Mes"
            valor={metricas.uso.syncsSiiMes.toLocaleString()}
            subtitulo="Conexiones ejecutadas exitosas"
            icono={Activity}
          />
          <MetricCard
            titulo="DTEs Procesados"
            valor={metricas.uso.documentosProcesados.toLocaleString()}
            subtitulo="Documentos tributarios mapeados"
            icono={FileCheck}
          />
          <MetricCard
            titulo="Consultas IA Mes"
            valor={metricas.uso.consultasIaMes.toLocaleString()}
            subtitulo="Interactuadas por el motor IA"
            icono={Zap}
          />
        </div>

        <UsageChart historial={metricas.historialUso} />
      </div>
    </div>
  );
}
