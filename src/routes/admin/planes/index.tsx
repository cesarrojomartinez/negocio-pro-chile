import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { PlanCard } from "@/components/master/plans/PlanCard";
import { SubscriptionTable } from "@/components/master/plans/SubscriptionTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listarPlanesMasterAdminFn,
  listarSuscripcionesMasterFn,
  toggleEstadoPlanMasterFn,
} from "@/lib/cuenta.functions";
import type { PlanMaster, SuscripcionMaster } from "@/lib/cuenta.server";
import { formatCLP } from "@/utils/currency";

export const Route = createFileRoute("/admin/planes/")({
  component: PlanesMasterDashboardPage,
});

function PlanesMasterDashboardPage() {
  const [planes, setPlanes] = useState<PlanMaster[]>([]);
  const [suscripciones, setSuscripciones] = useState<SuscripcionMaster[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = async () => {
    setCargando(true);
    const [resPlanes, resSubs] = await Promise.all([
      listarPlanesMasterAdminFn(),
      listarSuscripcionesMasterFn(),
    ]);

    if (resPlanes.ok && resSubs.ok) {
      setPlanes(resPlanes.data);
      setSuscripciones(resSubs.data);
      setError(null);
    } else {
      setError(resPlanes.ok ? (resSubs as any).error : resPlanes.error);
    }
    setCargando(false);
  };

  useEffect(() => {
    void cargarDatos();
  }, []);

  const handleToggleEstado = async (planId: string, currentActive: boolean) => {
    const res = await toggleEstadoPlanMasterFn({
      data: { planId, isActive: !currentActive },
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Plan ${!currentActive ? "activado" : "desactivado"} con éxito.`);
    await cargarDatos();
  };

  if (cargando) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Cargando módulo de planes y suscripciones...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="text-base font-bold text-destructive font-sans">Error al cargar planes</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void cargarDatos()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const planesActivos = planes.filter((p) => p.isActive).length;
  const mrrEstimado = suscripciones
    .filter((s) => s.status === "active")
    .reduce((acc, s) => acc + (s.priceClp ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Titular */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Planes y Suscripciones SaaS</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Administra los niveles de precios, límites cuantitativos de empresas y suscripciones comerciales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void cargarDatos()} className="h-8 text-xs gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refrescar
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold" asChild>
            <Link to="/admin/planes/nuevo">
              <Plus className="h-3.5 w-3.5" />
              Crear Nuevo Plan
            </Link>
          </Button>
        </div>
      </div>

      {/* METRICAS COMERCIALES */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Planes Definidos</span>
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums">{planes.length}</span>
            <span className="text-xs text-muted-foreground ml-1.5">planes creados</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            {planesActivos} activos / {planes.length - planesActivos} inactivos
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Suscripciones Totales</span>
            <Building2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums text-foreground">{suscripciones.length}</span>
            <span className="text-xs text-muted-foreground ml-1.5">empresas suscritas</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            {suscripciones.filter((s) => s.status === "active").length} activas pagadas
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Ingreso Recurrente (MRR)</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums text-emerald-600">
              {formatCLP(mrrEstimado)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Estimación de ingresos mensuales
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Períodos de Prueba</span>
            <Users className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums">
              {suscripciones.filter((s) => s.status === "trial").length}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">demos / trial</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Oportunidades de conversión
          </p>
        </div>
      </div>

      {/* PESTAÑAS PRINCIPALES */}
      <Tabs defaultValue="planes" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-1 max-w-xs">
          <TabsTrigger value="planes" className="text-xs">Planes ({planes.length})</TabsTrigger>
          <TabsTrigger value="suscripciones" className="text-xs">Suscripciones ({suscripciones.length})</TabsTrigger>
        </TabsList>

        {/* Pestaña 1: Planes */}
        <TabsContent value="planes" className="space-y-4">
          {planes.length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground space-y-3">
              <Layers className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <h3 className="text-base font-bold text-foreground">No hay planes creados aún</h3>
              <p className="text-xs max-w-sm mx-auto">
                Crea tu primer plan comercial para asignar tarifas y límites a los clientes de Mi Negocio al Día.
              </p>
              <Button size="sm" className="h-8 text-xs" asChild>
                <Link to="/admin/planes/nuevo">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Crear Primer Plan
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {planes.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  onToggleEstado={handleToggleEstado}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Pestaña 2: Suscripciones */}
        <TabsContent value="suscripciones" className="space-y-4">
          <SubscriptionTable
            suscripciones={suscripciones}
            planes={planes}
            onRefrescar={() => void cargarDatos()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
