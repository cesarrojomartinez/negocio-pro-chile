import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Database,
  FileCheck,
  FileText,
  Plus,
  HelpCircle,
  History,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Package,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  StickyNote,
  User,
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
  actualizarTicketSoporteMasterFn,
  cambiarEstadoCuentaFn,
  crearNotaAdminMasterFn,
  obtenerFichaCliente360MasterFn,
  registrarPagoManualMasterFn,
} from "@/lib/cuenta.functions";
import type { FichaCliente360Master } from "@/lib/cuenta.server";
import { cn } from "@/lib/utils";
import { formatCLP, formatFechaHora, formatNumero } from "@/utils/currency";

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
  const [ficha, setFicha] = useState<FichaCliente360Master | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de formularios interactivos
  const [nuevaNota, setNuevaNota] = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);

  const [mostrandoFormPago, setMostrandoFormPago] = useState(false);
  const [pagoMonto, setPagoMonto] = useState<string>("");
  const [pagoReferencia, setPagoReferencia] = useState("");
  const [pagoNotas, setPagoNotas] = useState("");
  const [pagoEstado, setPagoEstado] = useState("aprobado");
  const [guardandoPago, setGuardandoPago] = useState(false);

  const [actualizandoTicketId, setActualizandoTicketId] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    const res = await obtenerFichaCliente360MasterFn({ data: { companyId } });
    if (res.ok) {
      setFicha(res.data);
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

  const guardarNota = async () => {
    if (!nuevaNota.trim()) {
      toast.error("Ingresa el contenido de la nota.");
      return;
    }
    setGuardandoNota(true);
    const res = await crearNotaAdminMasterFn({
      data: { companyId, cuerpo: nuevaNota },
    });
    setGuardandoNota(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Nota de administración agregada.");
    setNuevaNota("");
    await cargar();
  };

  const guardarPago = async () => {
    const monto = parseInt(pagoMonto, 10);
    if (isNaN(monto) || monto <= 0) {
      toast.error("Ingresa un monto válido mayor a 0.");
      return;
    }
    setGuardandoPago(true);
    const res = await registrarPagoManualMasterFn({
      data: {
        companyId,
        montoClp: monto,
        estado: pagoEstado,
        referencia: pagoReferencia,
        notas: pagoNotas,
      },
    });
    setGuardandoPago(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Pago registrado con éxito.");
    setPagoMonto("");
    setPagoReferencia("");
    setPagoNotas("");
    setMostrandoFormPago(false);
    await cargar();
  };

  const actualizarTicket = async (ticketId: string, nuevoEstado: string) => {
    setActualizandoTicketId(ticketId);
    const res = await actualizarTicketSoporteMasterFn({
      data: { ticketId, companyId, estado: nuevoEstado },
    });
    setActualizandoTicketId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Ticket actualizado a ${nuevoEstado}.`);
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

  if (error || !ficha) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="text-base font-bold text-destructive">Error al cargar la ficha 360° del cliente</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/clientes">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Volver a Directorio de Clientes
          </Link>
        </Button>
      </div>
    );
  }

  const {
    empresa,
    suscripcion,
    contacto,
    kpis,
    usuarios,
    tributario,
    consumoIa,
    pagos,
    soporte,
    notas,
    auditoria,
  } = ficha;

  return (
    <div className="space-y-6">
      {/* Botón Volver y Breadcrumb */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" asChild>
          <Link to="/admin/clientes">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a Clientes
          </Link>
        </Button>
        <span className="text-xs text-muted-foreground font-mono">
          Customer 360° ID: {empresa.id}
        </span>
      </div>

      {/* HEADER DE FICHA CLIENTE 360° */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-xl border">
              <Building2 className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">{empresa.razonSocial}</h1>
                {empresa.nombreFantasia && (
                  <span className="text-xs text-muted-foreground font-medium">({empresa.nombreFantasia})</span>
                )}
                {empresa.esDemo && (
                  <Badge variant="outline" className="text-xs bg-secondary">
                    Demo
                  </Badge>
                )}
                <Badge variant="outline" className={cn("text-xs font-semibold px-2.5 py-0.5", CLASE_ESTADO[suscripcion.estado])}>
                  {ETIQUETA_ESTADO[suscripcion.estado] ?? suscripcion.estado}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono flex items-center gap-3">
                <span>RUT: <strong>{empresa.rut}</strong></span>
                <span>·</span>
                <span>Alta: {new Date(empresa.alta).toLocaleDateString("es-CL")}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3 text-primary" />
                  Contacto: <strong>{contacto.nombre ?? "Sin contacto registrado"}</strong> ({contacto.email ?? "Sin email"})
                </span>
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

        {/* BARRA DE KPIS RÁPIDOS CLIENTE 360° */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 border-t pt-4">
          <div className="rounded-xl border bg-muted/20 p-3">
            <span className="block text-[11px] text-muted-foreground font-medium">Documentos Totales</span>
            <span className="text-lg font-bold text-foreground font-mono">{formatNumero(kpis.totalDocumentos)}</span>
          </div>
          <div className="rounded-xl border bg-muted/20 p-3">
            <span className="block text-[11px] text-muted-foreground font-medium">Consultas Mes</span>
            <span className="text-lg font-bold text-foreground font-mono">{formatNumero(kpis.consultasMes)}</span>
          </div>
          <div className="rounded-xl border bg-muted/20 p-3">
            <span className="block text-[11px] text-muted-foreground font-medium">Errores Recientes</span>
            <span className={cn("text-lg font-bold font-mono", kpis.erroresRecientes > 0 ? "text-rose-600" : "text-emerald-600")}>
              {kpis.erroresRecientes}
            </span>
          </div>
          <div className="rounded-xl border bg-muted/20 p-3">
            <span className="block text-[11px] text-muted-foreground font-medium">Períodos Activos</span>
            <span className="text-lg font-bold text-emerald-600 font-mono">{kpis.periodosActivos}</span>
          </div>
          <div className="rounded-xl border bg-muted/20 p-3">
            <span className="block text-[11px] text-muted-foreground font-medium font-mono">Créditos IA Asignados</span>
            <span className="text-lg font-bold text-primary font-mono">{formatNumero(kpis.creditosIaAsignados)}</span>
          </div>
          <div className="rounded-xl border bg-muted/20 p-3">
            <span className="block text-[11px] text-muted-foreground font-medium">Créditos IA Disponibles</span>
            <span className="text-lg font-bold text-emerald-600 font-mono">{formatNumero(kpis.creditosIaDisponibles)}</span>
          </div>
          <div className="rounded-xl border bg-muted/20 p-3">
            <span className="block text-[11px] text-muted-foreground font-medium">Créditos IA Usados</span>
            <span className="text-lg font-bold text-amber-600 font-mono">{formatNumero(kpis.creditosIaUsados)}</span>
          </div>
        </div>
      </div>

      {/* PESTAÑAS CUSTOMER 360° (8 TABS PROFESIONALES) */}
      <Tabs defaultValue="resumen" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="resumen" className="text-xs font-semibold">Resumen</TabsTrigger>
          <TabsTrigger value="usuarios" className="text-xs font-semibold">Usuarios ({usuarios.miembros.length})</TabsTrigger>
          <TabsTrigger value="tributario" className="text-xs font-semibold">Tributario</TabsTrigger>
          <TabsTrigger value="consumo" className="text-xs font-semibold">Consumo e IA</TabsTrigger>
          <TabsTrigger value="pagos" className="text-xs font-semibold">Pagos ({pagos.length})</TabsTrigger>
          <TabsTrigger value="soporte" className="text-xs font-semibold">Soporte ({soporte.length})</TabsTrigger>
          <TabsTrigger value="notas" className="text-xs font-semibold">Notas ({notas.length})</TabsTrigger>
          <TabsTrigger value="auditoria" className="text-xs font-semibold">Auditoría ({auditoria.length})</TabsTrigger>
        </TabsList>

        {/* 1. RESUMEN 360° */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Ficha Organización */}
            <div className="rounded-2xl border bg-card p-5 space-y-3 md:col-span-1">
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Building2 className="h-4 w-4 text-primary" /> Organización
              </h3>
              <div className="space-y-2 text-xs divide-y">
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">Razón Social:</span>
                  <span className="font-semibold text-right">{empresa.razonSocial}</span>
                </div>
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground font-mono">RUT:</span>
                  <span className="font-mono font-medium">{empresa.rut}</span>
                </div>
                {empresa.giro && (
                  <div className="py-1 flex justify-between">
                    <span className="text-muted-foreground">Giro:</span>
                    <span className="font-medium text-right">{empresa.giro}</span>
                  </div>
                )}
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">Ubicación:</span>
                  <span className="font-medium">{[empresa.ciudad, empresa.region].filter(Boolean).join(", ") || "No especificada"}</span>
                </div>
                {empresa.direccion && (
                  <div className="py-1 flex justify-between">
                    <span className="text-muted-foreground">Dirección:</span>
                    <span className="font-medium text-right">{empresa.direccion}</span>
                  </div>
                )}
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">Tipo de Cuenta:</span>
                  <span>{empresa.esDemo ? "Demostración" : "Producción Real"}</span>
                </div>
              </div>
            </div>

            {/* Ficha Suscripción Comercial */}
            <div className="rounded-2xl border bg-card p-5 space-y-3 md:col-span-1">
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <CreditCard className="h-4 w-4 text-emerald-600" /> Suscripción Comercial
              </h3>
              <div className="space-y-2 text-xs divide-y">
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">Plan Contratado:</span>
                  <span className="font-bold text-primary">{suscripcion.planNombre}</span>
                </div>
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">Precio CLP:</span>
                  <span className="font-semibold font-mono">
                    {suscripcion.planPrecioClp ? formatCLP(suscripcion.planPrecioClp) : "Gratuito / Custom"}
                  </span>
                </div>
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">Estado Cuenta:</span>
                  <Badge variant="outline" className={cn("text-[10px]", CLASE_ESTADO[suscripcion.estado])}>
                    {suscripcion.estado}
                  </Badge>
                </div>
                {suscripcion.iniciada && (
                  <div className="py-1 flex justify-between">
                    <span className="text-muted-foreground">Fecha Inicio:</span>
                    <span className="font-mono">{new Date(suscripcion.iniciada).toLocaleDateString("es-CL")}</span>
                  </div>
                )}
                {suscripcion.proximaRenovacion && (
                  <div className="py-1 flex justify-between">
                    <span className="text-muted-foreground">Próxima Renovación:</span>
                    <span className="font-mono font-medium">{new Date(suscripcion.proximaRenovacion).toLocaleDateString("es-CL")}</span>
                  </div>
                )}
                {suscripcion.metodoPago && (
                  <div className="py-1 flex justify-between">
                    <span className="text-muted-foreground">Método de Pago:</span>
                    <span className="font-medium">{suscripcion.metodoPago}</span>
                  </div>
                )}
                {suscripcion.motivoSuspension && (
                  <div className="py-1 flex justify-between text-destructive">
                    <span>Motivo Suspensión:</span>
                    <span className="font-medium text-right">{suscripcion.motivoSuspension}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contacto Principal & Salud General */}
            <div className="rounded-2xl border bg-card p-5 space-y-3 md:col-span-1">
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <UserCheck className="h-4 w-4 text-primary" /> Contacto Principal & Conexión
              </h3>
              <div className="space-y-2 text-xs divide-y">
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">Titular / Owner:</span>
                  <span className="font-bold">{contacto.nombre ?? "Sin titular asignado"}</span>
                </div>
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">Email Contacto:</span>
                  <span className="font-mono font-medium">{contacto.email ?? "N/A"}</span>
                </div>
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">Conexión Gateway SII:</span>
                  <span className={cn("font-bold", tributario.conexionSii === "connected" ? "text-emerald-600" : "text-amber-600")}>
                    {tributario.conexionSii === "connected" ? "Conectado" : "Pendiente"}
                  </span>
                </div>
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">Última Sync:</span>
                  <span className="font-mono">{formatFechaHora(empresa.ultimaSync)}</span>
                </div>
                <div className="py-1 flex justify-between">
                  <span className="text-muted-foreground">Saldo Créditos IA:</span>
                  <span className="font-bold text-primary font-mono">{formatNumero(consumoIa.creditosDisponibles)} / {formatNumero(consumoIa.creditosAsignados)}</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 2. USUARIOS & PERMISOS */}
        <TabsContent value="usuarios" className="space-y-4">
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Miembros Activos de la Empresa ({usuarios.miembros.length})
              </h3>
            </div>
            <table className="w-full text-left text-xs divide-y">
              <thead className="bg-muted/50 font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Rol</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Fecha Ingreso</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {usuarios.miembros.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/20">
                    <td className="p-3 font-semibold">{m.nombre ?? "Usuario Registrado"}</td>
                    <td className="p-3 font-mono text-muted-foreground">{m.email ?? "Email no visible"}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        {m.rol}
                      </Badge>
                    </td>
                    <td className="p-3 text-emerald-600 font-medium">{m.estado}</td>
                    <td className="p-3 font-mono text-muted-foreground">
                      {new Date(m.ingreso).toLocaleDateString("es-CL")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Invitaciones Pendientes */}
          {usuarios.invitaciones.length > 0 && (
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-amber-500" /> Invitaciones Pendientes ({usuarios.invitaciones.length})
                </h3>
              </div>
              <table className="w-full text-left text-xs divide-y">
                <thead className="bg-muted/50 font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-3">Correo Destinatario</th>
                    <th className="p-3">Rol Asignado</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Fecha Envío</th>
                    <th className="p-3">Vencimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {usuarios.invitaciones.map((i) => (
                    <tr key={i.id}>
                      <td className="p-3 font-mono font-medium">{i.email}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">{i.rol}</Badge>
                      </td>
                      <td className="p-3 text-amber-600 font-medium">{i.estado}</td>
                      <td className="p-3 font-mono text-muted-foreground">{new Date(i.creada).toLocaleDateString("es-CL")}</td>
                      <td className="p-3 font-mono text-muted-foreground">{new Date(i.vence).toLocaleDateString("es-CL")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* 3. TRIBUTARIO Y MOTOR SII */}
        <TabsContent value="tributario" className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-primary" /> Períodos Tributarios Procesados ({tributario.periodosProcesados})
              </h3>
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40">
                Gateway SII: {tributario.conexionSii === "connected" ? "Conectado" : "Pendiente"}
              </Badge>
            </div>

            <div className="divide-y border rounded-xl overflow-hidden">
              <div className="bg-muted/50 p-3 grid grid-cols-4 font-semibold text-xs text-muted-foreground">
                <span>Período</span>
                <span>Estado Registro</span>
                <span>Fuente de Datos</span>
                <span className="text-right">Última Actualización</span>
              </div>
              {tributario.periodos.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground text-center">
                  No hay períodos tributarios registrados aún.
                </div>
              ) : (
                tributario.periodos.map((p) => (
                  <div key={p.periodo} className="p-3 grid grid-cols-4 items-center text-xs hover:bg-muted/20">
                    <span className="font-bold font-mono text-foreground">{p.periodo}</span>
                    <div>
                      <Badge variant="outline" className="text-[10px]">
                        {p.estado}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground font-mono">{p.fuente}</span>
                    <span className="text-right font-mono text-muted-foreground">{formatFechaHora(p.actualizado)}</span>
                  </div>
                ))
              )}
            </div>

            {/* Historial de Sincronizaciones SII */}
            <div className="space-y-2 pt-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-primary" /> Historial de Ejecuciones Gateway SII
              </h4>
              <div className="divide-y border rounded-xl overflow-hidden">
                <div className="bg-muted/50 p-3 grid grid-cols-4 font-semibold text-xs text-muted-foreground">
                  <span>Trigger / Origen</span>
                  <span>Estado Run</span>
                  <span>Duración</span>
                  <span className="text-right">Fecha Ejecución</span>
                </div>
                {tributario.historialSync.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground text-center">
                    No hay sincronizaciones registradas.
                  </div>
                ) : (
                  tributario.historialSync.map((s) => (
                    <div key={s.id} className="p-3 grid grid-cols-4 items-center text-xs">
                      <span className="font-medium font-mono">{s.tipo}</span>
                      <div>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", s.estado === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}
                        >
                          {s.estado}
                        </Badge>
                      </div>
                      <span className="font-mono text-muted-foreground">{s.duracionMs ? `${s.duracionMs} ms` : "N/A"}</span>
                      <span className="text-right font-mono text-muted-foreground">{formatFechaHora(s.fecha)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 4. CONSUMO Y CRÉDITOS IA */}
        <TabsContent value="consumo" className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> Billetera de Créditos IA & Consumo de APIs
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-muted/20 p-3">
                <span className="block text-xs text-muted-foreground">Asignados Mes</span>
                <span className="text-xl font-bold font-mono text-primary">{formatNumero(consumoIa.creditosAsignados)}</span>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <span className="block text-xs text-muted-foreground">Disponibles</span>
                <span className="text-xl font-bold font-mono text-emerald-600">{formatNumero(consumoIa.creditosDisponibles)}</span>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <span className="block text-xs text-muted-foreground">Consumidos</span>
                <span className="text-xl font-bold font-mono text-amber-600">{formatNumero(consumoIa.creditosUsados)}</span>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <span className="block text-xs text-muted-foreground">Costo Estimado Proveedor</span>
                <span className="text-xl font-bold font-mono text-foreground">{formatCLP(consumoIa.costoEstimadoClp)}</span>
              </div>
            </div>

            {/* Consumo por Categoría */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Desglose de Consumo API por Categoría
              </h4>
              <div className="divide-y border rounded-xl overflow-hidden text-xs">
                <div className="bg-muted/50 p-3 grid grid-cols-6 font-semibold text-muted-foreground">
                  <span>Categoría</span>
                  <span>Consultas</span>
                  <span>Cache Hits</span>
                  <span>Errores</span>
                  <span>Unidades Costo</span>
                  <span className="text-right">Mes</span>
                </div>
                {consumoIa.porCategoria.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground text-center">
                    Sin registros de uso de APIs en esta cuenta.
                  </div>
                ) : (
                  consumoIa.porCategoria.map((c, idx) => (
                    <div key={`${c.categoria}-${idx}`} className="p-3 grid grid-cols-6 items-center">
                      <span className="font-semibold text-foreground">{c.categoria}</span>
                      <span className="font-mono">{c.consultas}</span>
                      <span className="font-mono text-emerald-600">{c.cacheHits}</span>
                      <span className={cn("font-mono", c.errores > 0 ? "text-rose-600" : "text-muted-foreground")}>{c.errores}</span>
                      <span className="font-mono font-medium">{c.unidades}</span>
                      <span className="text-right font-mono text-muted-foreground">{c.mes}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 5. HISTORIAL DE PAGOS */}
        <TabsContent value="pagos" className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-600" /> Eventos de Facturación y Pagos ({pagos.length})
              </h3>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1"
                onClick={() => setMostrandoFormPago(!mostrandoFormPago)}
              >
                <Plus className="h-3.5 w-3.5" />
                Registrar Pago Manual
              </Button>
            </div>

            {/* Formulario Registrar Pago Manual */}
            {mostrandoFormPago && (
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3 text-xs">
                <h4 className="font-bold text-foreground">Registrar Nuevo Pago o Abono Manual</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-muted-foreground mb-1">Monto CLP *</label>
                    <input
                      type="number"
                      placeholder="Ej: 29900"
                      value={pagoMonto}
                      onChange={(e) => setPagoMonto(e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">Estado</label>
                    <select
                      value={pagoEstado}
                      onChange={(e) => setPagoEstado(e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
                    >
                      <option value="aprobado">Aprobado</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="vencido">Vencido</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">Referencia / Comprobante</label>
                    <input
                      type="text"
                      placeholder="Ej: TR-982314"
                      value={pagoReferencia}
                      onChange={(e) => setPagoReferencia(e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-1.5 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">Notas / Detalle</label>
                    <input
                      type="text"
                      placeholder="Ej: Pago por transferencia directa"
                      value={pagoNotas}
                      onChange={(e) => setPagoNotas(e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setMostrandoFormPago(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => void guardarPago()}
                    disabled={guardandoPago}
                  >
                    {guardandoPago && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Guardar Pago
                  </Button>
                </div>
              </div>
            )}

            {pagos.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No hay historial de pagos o cobros registrado para este cliente.
              </p>
            ) : (
              <div className="divide-y border rounded-xl overflow-hidden text-xs">
                <div className="bg-muted/50 p-3 grid grid-cols-5 font-semibold text-muted-foreground">
                  <span>Tipo Evento</span>
                  <span>Monto CLP</span>
                  <span>Estado</span>
                  <span>Referencia</span>
                  <span className="text-right">Fecha</span>
                </div>
                {pagos.map((p) => (
                  <div key={p.id} className="p-3 grid grid-cols-5 items-center">
                    <span className="font-medium font-mono">{p.tipo}</span>
                    <span className="font-bold font-mono">{p.montoClp ? formatCLP(p.montoClp) : "N/A"}</span>
                    <div>
                      <Badge variant="outline" className="text-[10px]">
                        {p.estado}
                      </Badge>
                    </div>
                    <span className="font-mono text-muted-foreground">{p.referencia ?? "-"}</span>
                    <span className="text-right font-mono text-muted-foreground">{formatFechaHora(p.fecha)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* 6. TICKETS DE SOPORTE */}
        <TabsContent value="soporte" className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Tickets de Soporte del Cliente ({soporte.length})
            </h3>
            {soporte.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Este cliente no ha enviado tickets de soporte.
              </p>
            ) : (
              <div className="divide-y border rounded-xl overflow-hidden text-xs">
                <div className="bg-muted/50 p-3 grid grid-cols-7 font-semibold text-muted-foreground">
                  <span>Categoría</span>
                  <span className="col-span-2">Mensaje</span>
                  <span>Usuario</span>
                  <span>Prioridad</span>
                  <span>Estado Ticket</span>
                  <span className="text-right">Acción Admin</span>
                </div>
                {soporte.map((t) => (
                  <div key={t.id} className="p-3 grid grid-cols-7 items-center gap-2">
                    <Badge variant="outline" className="text-[10px] justify-start w-fit">{t.categoria}</Badge>
                    <span className="col-span-2 truncate font-medium text-foreground">{t.mensaje}</span>
                    <span className="truncate text-muted-foreground font-mono">{t.usuarioEmail ?? t.usuarioNombre ?? "Usuario"}</span>
                    <span className="font-mono text-muted-foreground">{t.prioridad}</span>
                    <div>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", t.estado === "open" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}
                      >
                        {t.estado}
                      </Badge>
                    </div>
                    <div className="text-right">
                      {t.estado === "open" || t.estado === "in_progress" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                          onClick={() => void actualizarTicket(t.id, "resolved")}
                          disabled={actualizandoTicketId === t.id}
                        >
                          {actualizandoTicketId === t.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          )}
                          Resolver
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-mono">Resuelto</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* 7. NOTAS INTERNAS ADMIN */}
        <TabsContent value="notas" className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-500" /> Notas Internas de Administración ({notas.length})
            </h3>

            {/* Formulario Agregar Nota */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-2 text-xs">
              <label className="font-bold text-foreground block">Agregar Nueva Nota Interna</label>
              <textarea
                rows={3}
                placeholder="Escribe anotaciones comerciales, acuerdos de soporte o compromisos con el cliente..."
                value={nuevaNota}
                onChange={(e) => setNuevaNota(e.target.value)}
                className="w-full rounded-md border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => void guardarNota()}
                  disabled={guardandoNota || !nuevaNota.trim()}
                >
                  {guardandoNota && <Loader2 className="h-3 w-3 animate-spin" />}
                  Guardar Nota
                </Button>
              </div>
            </div>

            {notas.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No hay notas administrativas agregadas para este cliente.
              </p>
            ) : (
              <div className="space-y-3">
                {notas.map((n) => (
                  <div key={n.id} className="rounded-xl border bg-card p-4 space-y-1 text-xs shadow-xs">
                    <div className="flex items-center justify-between text-muted-foreground font-mono">
                      <span>Autor: {n.autorEmail ?? n.autorNombre ?? "Administrador"}</span>
                      <span>{formatFechaHora(n.fecha)}</span>
                    </div>
                    <p className="text-foreground font-medium whitespace-pre-line">{n.cuerpo}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* 8. BITÁCORA DE AUDITORÍA */}
        <TabsContent value="auditoria" className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Bitácora de Auditoría y Eventos ({auditoria.length})
            </h3>
            {auditoria.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No hay eventos de auditoría registrados para este cliente.
              </p>
            ) : (
              <div className="divide-y border rounded-xl overflow-hidden text-xs">
                <div className="bg-muted/50 p-3 grid grid-cols-3 font-semibold text-muted-foreground">
                  <span>Acción / Evento</span>
                  <span>Usuario</span>
                  <span className="text-right">Fecha y Hora</span>
                </div>
                {auditoria.map((a) => (
                  <div key={a.id} className="p-3 grid grid-cols-3 items-center hover:bg-muted/20">
                    <span className="font-semibold text-foreground font-mono">{a.accion}</span>
                    <span className="text-muted-foreground font-mono">{a.usuarioEmail ?? "Sistema / Admin"}</span>
                    <span className="text-right font-mono text-muted-foreground">{formatFechaHora(a.fecha)}</span>
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
