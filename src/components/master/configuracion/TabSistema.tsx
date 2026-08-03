import { Activity, Database, Server, Cpu, Globe, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ConfiguracionSistema } from "@/lib/configuracion";

export function TabSistema({ datos }: { datos: ConfiguracionSistema }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Salud del Sistema & Estado de Infraestructura
              </CardTitle>
              <CardDescription className="text-xs">
                Métricas técnicas globales, estado de componentes y estadísticas de consumo de infraestructura.
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold">
              <CheckCircle2 className="h-3 w-3 mr-1" /> OPERATIVO
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block flex items-center gap-1">
                <Database className="h-3.5 w-3.5 text-blue-500" /> Base de Datos
              </span>
              <span className="text-sm font-bold block mt-1 uppercase text-emerald-600 dark:text-emerald-400">
                {datos.estadoBD}
              </span>
            </div>
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block flex items-center gap-1">
                <Server className="h-3.5 w-3.5 text-emerald-500" /> Gateway SII
              </span>
              <span className="text-sm font-bold block mt-1 uppercase text-emerald-600 dark:text-emerald-400">
                {datos.estadoGateway}
              </span>
            </div>
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5 text-purple-500" /> IA Gateway
              </span>
              <span className="text-sm font-bold block mt-1 uppercase text-emerald-600 dark:text-emerald-400">
                {datos.estadoIA}
              </span>
            </div>
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block flex items-center gap-1">
                <Globe className="h-3.5 w-3.5 text-amber-500" /> Landing Page
              </span>
              <span className="text-sm font-bold block mt-1 uppercase text-emerald-600 dark:text-emerald-400">
                {datos.estadoLanding}
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 pt-2 border-t text-xs">
            <div>
              <span className="font-semibold block text-muted-foreground">Versión de Plataforma</span>
              <span className="font-mono text-sm block mt-0.5">{datos.versionPlataforma}</span>
            </div>
            <div>
              <span className="font-semibold block text-muted-foreground">Fecha Último Despliegue</span>
              <span className="text-sm block mt-0.5">{datos.ultimoDeploy}</span>
            </div>
            <div>
              <span className="font-semibold block text-muted-foreground">Usuarios Conectados Simultáneos</span>
              <span className="text-sm font-bold block mt-0.5 text-primary">{datos.usuariosConectadosAhora} activos</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 pt-2 border-t text-xs text-muted-foreground">
            <div>
              <span className="font-semibold">Uso Estimado de Disco BD:</span> {datos.usoDiscoMb} MB
            </div>
            <div>
              <span className="font-semibold">Uso Almacenamiento Archivos:</span> {datos.usoAlmacenamientoMb} MB
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
