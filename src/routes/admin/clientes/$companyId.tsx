import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  FileCheck,
  FileText,
  History,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ETIQUETA_ESTADO, type EstadoCuenta } from "@/lib/cuenta";
import {
  cambiarEstadoCuentaFn,
  obtenerDetalleClienteMasterFn,
} from "@/lib/cuenta.functions";
import type { DetalleClienteMaster } from "@/lib/cuenta.server";
import { cn } from "@/lib/utils";
import { formatFechaHora } from "@/utils/currency";

export const Route = createFileRoute("/admin/clientes/$companyId")({
  component: FichaCliente360Page,
});

const CLASE_ESTADO: Record<EstadoCuenta, string> = {
  active: "border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  trial: "border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  payment_pending: "border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  suspended: "border-rose-500/30 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  cancelled: "border-secondary bg-secondary text-muted-foreground",
};

function FichaCliente360Page() {
  const { companyId } = Route.useParams();
  const [detalle, setDetalle] = useState<DetalleClienteMaster | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    const res = await obtenerDetalleClienteMasterFn({ data: { companyId } });
    if (res.ok) {
      setDetalle(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setCargando(false);
  };

  useEffect(() => {
    void cargar();
  }, [companyId]);

  const cambiarEstado = async (estado: EstadoCuenta) => {
    const res = await cambiarEstadoCuentaFn({ data: { companyId, estado } });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Estado actualizado a ${estado}.`);
    await cargar();
  };

  if (cargando) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Cargando Ficha Cliente 360°...
        </p>
      </div>
    );
  }

  if (error || !detalle) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="text-base font-bold text-destructive">Error al cargar la ficha del cliente</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/clientes">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Volver al directorio
          </Link>
        </Button>
      </div>
    );
  }

  const { empresa, suscripcion, miembros, invitaciones, tributario, consumo, auditoria } = detalle;

  return (
    <div className="space-y-6">
      {/* Botón Volver */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" asChild>
          <Link to="/admin/clientes">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a Clientes
          </Link>
        </Button>
      </div>

      {/* HEADER DE FICHA CLIENTE 360° */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-lg border">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">{empresa.razonSocial}</h1>
                {empresa.esDemo && (
                  <Badge variant="outline" className="text-xs bg-secondary">
                    Demo
                  </Badge>
                )}
                <Badge variant="outline" className={cn("text-xs font-medium", CLASE_ESTADO[suscripcion.estado])}>
                  {ETIQUETA_ESTADO[suscripcion.estado] ?? suscripcion.estado}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                RUT: {empresa.rut} · ID: {empresa.id}
              </p>
            </div>
          </div>

          {/* Acciones Rápidas de Cuenta */}
          <div className="flex items-center gap-2">
            {suscripcion.estado === "active" ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => void cambiarEstado("suspended")}
              >
                <Lock className="h-3.5 w-3.5 mr-1" />
                Suspender Cuenta
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => void cambiarEstado("active")}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Activar Cuenta
              </Button>
            )}
          </div>
        </div>

        {/* Resumen Superior */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t pt-4 text-xs">
          <div>
            <span className="block text-muted-foreground text-[11px]">Plan Contratado</span>
            <span className="font-bold text-foreground">{suscripcion.plan}</span>
          </div>
          <div>
            <span className="block text-muted-foreground text-[11px]">Fecha de Alta</span>
            <span className="font-mono text-foreground">
              {new Date(empresa.alta).toLocaleDateString("es-CL")}
            </span>
          </div>
          <div>
            <span className="block text-muted-foreground text-[11px]">Conexión SII</span>
            <span className="font-semibold text-emerald-600">
              {empresa.conexionSii === "connected" ? "Conectado" : "Pendiente"}
            </span>
          </div>
          <div>
            <span className="block text-muted-foreground text-[11px]">Última Sync SII</span>
            <span className="font-mono text-foreground">
              {empresa.ultimaActualizacion
                ? formatFechaHora(empresa.ultimaActualizacion)
                : "Sin registro"}
            </span>
          </div>
        </div>
      </div>

      {/* PESTAÑAS 360° */}
      <Tabs defaultValue="resumen" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-5 bg-muted/60 p-1">
          <TabsTrigger value="resumen" className="text-xs">Resumen</TabsTrigger>
          <TabsTrigger value="usuarios" className="text-xs">Usuarios ({miembros.length})</TabsTrigger>
          <TabsTrigger value="tributario" className="text-xs">Tributario</TabsTrigger>
          <TabsTrigger value="consumo" className="text-xs">Consumo</TabsTrigger>
          <TabsTrigger value="auditoria" className="text-xs">Auditoría</TabsTrigger>
        </TabsList>

        {/* 1. RESUMEN */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Información de la Organización
              </h3>
              <div className="space-y-2 text-xs divide-y">
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">Razón Social:</span>
                  <span className="font-semibold">{empresa.razonSocial}</span>
                </div>
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">RUT Empresa:</span>
                  <span className="font-mono font-medium">{empresa.rut}</span>
                </div>
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">Estado de Prueba:</span>
                  <span>{empresa.esDemo ? "Modo Demostración" : "Cuenta Real"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-600" /> Estado de Suscripción
              </h3>
              <div className="space-y-2 text-xs divide-y">
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">Plan Comercial:</span>
                  <span className="font-bold text-primary">{suscripcion.plan}</span>
                </div>
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">Estado de Cobro:</span>
                  <Badge variant="outline" className={cn("text-[10px]", CLASE_ESTADO[suscripcion.estado])}>
                    {suscripcion.estado}
                  </Badge>
                </div>
                {suscripcion.motivoSuspension && (
                  <div className="py-1 flex justify-between text-destructive">
                    <span>Motivo Suspensión:</span>
                    <span className="font-medium">{suscripcion.motivoSuspension}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 2. USUARIOS */}
        <TabsContent value="usuarios" className="space-y-4">
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Miembros de la Empresa ({miembros.length})
              </h3>
            </div>
            <table className="w-full text-left text-xs divide-y">
              <thead className="bg-muted/50 font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Rol</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Fecha Ingreso</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {miembros.map((m) => (
                  <tr key={m.id}>
                    <td className="p-3 font-semibold">{m.nombre ?? "Usuario Registrado"}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px]">
                        {m.rol}
                      </Badge>
                    </td>
                    <td className="p-3 text-emerald-600 font-medium">{m.estado}</td>
                    <td className="p-3 font-mono text-muted-foreground">
                      {new Date(m.creado).toLocaleDateString("es-CL")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* 3. TRIBUTARIO */}
        <TabsContent value="tributario" className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary" /> Estado Tributario y Sincronización SII
            </h3>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-xl bg-secondary p-3">
                <span className="block text-muted-foreground">Períodos Procesados</span>
                <span className="text-lg font-bold">{tributario.periodosProcesados}</span>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <span className="block text-muted-foreground">Conexión Gateway SII</span>
                <span className="text-lg font-bold text-emerald-600">
                  {tributario.conexionSii === "connected" ? "Activa" : "Pendiente"}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Períodos Guardados
              </h4>
              <div className="divide-y border rounded-xl overflow-hidden">
                {tributario.periodos.map((p) => (
                  <div key={p.periodo} className="p-3 flex items-center justify-between text-xs">
                    <span className="font-bold font-mono">{p.periodo}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {p.estado}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 4. CONSUMO */}
        <TabsContent value="consumo" className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> Consumo y Telemetría SII
            </h3>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl bg-secondary p-3">
                <span className="block text-muted-foreground">Documentos Totales</span>
                <span className="text-lg font-bold">{consumo.totalDocumentos}</span>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <span className="block text-muted-foreground">Consultas Realizadas</span>
                <span className="text-lg font-bold">{consumo.consultasMes}</span>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <span className="block text-muted-foreground">Errores Sync</span>
                <span className={cn("text-lg font-bold", consumo.erroresRecientes > 0 ? "text-rose-600" : "text-emerald-600")}>
                  {consumo.erroresRecientes}
                </span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 5. AUDITORÍA */}
        <TabsContent value="auditoria" className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Historial de Auditoría de la Cuenta
            </h3>
            {auditoria.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No hay eventos registrados en la auditoría para este cliente.
              </p>
            ) : (
              <div className="space-y-2 divide-y">
                {auditoria.map((a) => (
                  <div key={a.id} className="pt-2 text-xs flex justify-between">
                    <div>
                      <span className="font-semibold block">{a.accion}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {formatFechaHora(a.fecha)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
