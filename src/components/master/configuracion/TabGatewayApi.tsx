import { Server, Activity, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ConfiguracionGatewayApi } from "@/lib/configuracion";

export function TabGatewayApi({ datos }: { datos: ConfiguracionGatewayApi }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Server className="h-4 w-4 text-emerald-500" /> Monitoreo y Telemetría del Gateway SII
              </CardTitle>
              <CardDescription className="text-xs">
                Visualización técnica del Gateway de conexión con el SII (Sin almacenamiento de credenciales ni secretos).
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold">
              <ShieldCheck className="h-3 w-3 mr-1" /> {datos.estado.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block">Proveedor Actual</span>
              <span className="text-sm font-bold block mt-1">{datos.proveedorActual}</span>
            </div>
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block">Versión de Motor Gateway</span>
              <span className="text-sm font-bold block mt-1">{datos.versionGateway}</span>
            </div>
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block">Costo Estimado por Llamada</span>
              <span className="text-sm font-bold block mt-1">${datos.costoPorLlamadaClp.toFixed(3)} CLP</span>
            </div>
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block">Costo Promedio Mensual</span>
              <span className="text-sm font-bold block mt-1">${datos.costoPromedioMensualClp.toLocaleString("es-CL")} CLP</span>
            </div>
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block">Consumo Diario</span>
              <span className="text-sm font-bold block mt-1">{datos.consumoDiarioLlamadas.toLocaleString("es-CL")} solicitudes</span>
            </div>
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block">Consumo Mensual Acumulado</span>
              <span className="text-sm font-bold block mt-1">{datos.consumoMensualLlamadas.toLocaleString("es-CL")} solicitudes</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border bg-muted/40 text-xs text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <Activity className="h-4 w-4 text-primary" /> Gateway Operativo con Cero Fallas Catastróficas
            </span>
            <span>Última verificación: {datos.ultimaActualizacion}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
