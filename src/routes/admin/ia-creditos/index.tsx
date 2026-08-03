import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Coins,
  CreditCard,
  History,
  Loader2,
  RefreshCw,
  Settings,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { AiWalletCard } from "@/components/master/ai/AiWalletCard";
import { listarWalletsIAMasterFn } from "@/lib/cuenta.functions";
import type { ResumenCreditosIAMaster } from "@/lib/cuenta.server";
import { formatCLP } from "@/utils/currency";

export const Route = createFileRoute("/admin/ia-creditos/")({
  component: IaCreditosIndexPage,
});

function IaCreditosIndexPage() {
  const [data, setData] = useState<ResumenCreditosIAMaster | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    const res = await listarWalletsIAMasterFn();
    if (res.ok) {
      setData(res.data);
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
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Cargando billeteras de créditos IA...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="text-base font-bold text-destructive">Error al cargar billeteras IA</h3>
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
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Créditos y Billeteras IA</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Administración comercial de créditos de inteligencia artificial, asignaciones mensuales y consumo por cliente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1.5">
            <Link to="/admin/ia-creditos/historial">
              <History className="h-3.5 w-3.5" />
              Historial Consumo
            </Link>
          </Button>

          <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1.5">
            <Link to="/admin/ia-creditos/configuracion">
              <Settings className="h-3.5 w-3.5" />
              Centro Económico
            </Link>
          </Button>

          <Button variant="outline" size="sm" onClick={() => void cargar()} className="h-8 text-xs gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refrescar
          </Button>
        </div>
      </div>

      {/* METRICAS GENERALES DE CRÉDITOS IA */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Créditos Totales Asignados</span>
            <Coins className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums">
              {data.resumen.creditosAsignadosTotal.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">cr.</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Cuota mensual combinada
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Créditos Consumidos Mes</span>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums text-amber-600">
              {data.resumen.creditosConsumidosTotal.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">cr.</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Uso activo este período
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Costo Estimado Proveedores</span>
            <CreditCard className="h-4 w-4 text-rose-500" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums text-foreground">
              {formatCLP(data.resumen.costoEstimadoProveedorClp)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Gasto operativo de IA
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
            <span>Margen Generado Estimado</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <span className="text-2xl font-black tabular-nums text-emerald-600">
              {formatCLP(data.resumen.margenGeneradoClp)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Margen bruto de servicio IA
          </p>
        </div>
      </div>

      {/* TARJETAS DE BILLETERAS IA POR CLIENTE */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Billeteras IA de Clientes ({data.billeteras.length})
        </h3>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.billeteras.map((b) => (
            <AiWalletCard key={b.companyId} billetera={b} onActualizado={() => void cargar()} />
          ))}
        </div>
      </div>
    </div>
  );
}
