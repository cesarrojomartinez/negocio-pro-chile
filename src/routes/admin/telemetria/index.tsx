import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowUpRight, Cpu, Globe, Radio, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/telemetria/")({
  component: TelemetriaIndexPage,
});

function TelemetriaIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Centro de Telemetría e Infraestructura</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Observabilidad completa de conexiones al SII, volumen de peticiones API y salud de servidores.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
                <Radio className="h-6 w-6 animate-pulse" />
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600">100% ONLINE</span>
            </div>
            <h3 className="text-lg font-bold">Salud del Gateway SII</h3>
            <p className="text-xs text-muted-foreground">
              Monitoreo del puente de comunicación con el SII en tiempo real, tasa de éxito de sincronizaciones, latencias e incidentes.
            </p>
          </div>

          <Button size="sm" className="w-full justify-between text-xs" asChild>
            <Link to="/admin/telemetria/sii">
              Ver Telemetría SII
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <Zap className="h-6 w-6" />
              </span>
              <span className="text-xs font-mono font-bold text-foreground">API Metrics</span>
            </div>
            <h3 className="text-lg font-bold">Consumo & API Health</h3>
            <p className="text-xs text-muted-foreground">
              Métricas de uso de API, volumen diario de llamadas de clientes, gráfico de latencia de 30 días y log de errores.
            </p>
          </div>

          <Button size="sm" variant="outline" className="w-full justify-between text-xs" asChild>
            <Link to="/admin/telemetria/api">
              Ver Consumo API
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
