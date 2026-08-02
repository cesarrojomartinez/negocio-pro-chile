import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { History, Loader2, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiUsageTable } from "@/components/master/ai/AiUsageTable";
import { obtenerConsumoIAMasterFn } from "@/lib/cuenta.functions";
import type { ConsumoIAMaster } from "@/lib/cuenta.server";

export const Route = createFileRoute("/admin/ia-creditos/historial")({
  component: IaHistorialPage,
});

function IaHistorialPage() {
  const [consumos, setConsumos] = useState<ConsumoIAMaster[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    const res = await obtenerConsumoIAMasterFn();
    if (res.ok) {
      setConsumos(res.data);
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
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Cargando historial de consumo IA...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="text-base font-bold text-destructive">Error al cargar historial IA</h3>
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
          <h1 className="text-2xl font-bold tracking-tight">Historial de Consumo de IA</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Registro detallado de consultas tributarias, créditos consumidos y costos por empresa y proveedor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void cargar()} className="h-8 text-xs gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refrescar Historial
          </Button>
        </div>
      </div>

      <AiUsageTable consumos={consumos} />
    </div>
  );
}
