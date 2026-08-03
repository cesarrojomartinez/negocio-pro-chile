import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Loader2,
  Megaphone,
  MessageSquare,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ETIQUETA_AUDIENCIA,
  ETIQUETA_TIPO_COMUNICADO,
  type AudienciaComunicado,
  type Comunicado,
  type PrioridadComunicado,
  type TipoComunicado,
} from "@/lib/master";
import {
  comunicacionMasterFn,
  eliminarComunicadoFn,
  guardarComunicadoFn,
} from "@/lib/master.functions";
import type { EntradaComunicado } from "@/lib/master.server";
import { cn } from "@/lib/utils";
import { formatFecha, formatFechaHora, formatNumero, formatPorcentaje } from "@/utils/currency";

export const Route = createFileRoute("/admin/comunicacion/")({
  component: ComunicacionMasterDashboardPage,
});

const CLASE_TIPO: Record<TipoComunicado, string> = {
  banner: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
  popup: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300",
  aviso: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  informativo: "bg-secondary text-secondary-foreground border-border",
  mantenimiento: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
};

const CLASE_PRIORIDAD: Record<PrioridadComunicado, string> = {
  baja: "bg-secondary text-muted-foreground",
  normal: "bg-blue-50 text-blue-700 border-blue-200",
  alta: "bg-amber-50 text-amber-700 border-amber-200 font-semibold",
};

function ComunicacionMasterDashboardPage() {
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [planes, setPlanes] = useState<{ codigo: string; nombre: string }[]>([]);
  const [empresas, setEmpresas] = useState<{ id: string; nombre: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros de búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  // Formulario / Modal Editor
  const [editando, setEditando] = useState<Comunicado | null>(null);
  const [mostrandoEditor, setMostrandoEditor] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Campos de formulario
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipo, setTipo] = useState<TipoComunicado>("banner");
  const [prioridad, setPrioridad] = useState<PrioridadComunicado>("normal");
  const [audiencia, setAudiencia] = useState<AudienciaComunicado>("todos");
  const [planAudiencia, setPlanAudiencia] = useState<string>("");
  const [empresaAudiencia, setEmpresaAudiencia] = useState<string>("");
  const [inicia, setInicia] = useState<string>(new Date().toISOString().slice(0, 16));
  const [termina, setTermina] = useState<string>("");
  const [visible, setVisible] = useState(true);
  const [textoBoton, setTextoBoton] = useState("");
  const [enlaceBoton, setEnlaceBoton] = useState("");

  const cargarDatos = async () => {
    setCargando(true);
    const res = await comunicacionMasterFn();
    if (res.ok) {
      setComunicados(res.data.comunicados);
      setPlanes(res.data.planes);
      setEmpresas(res.data.empresas);
      setError(null);
    } else {
      setError(res.error);
    }
    setCargando(false);
  };

  useEffect(() => {
    void cargarDatos();
  }, []);

  const abrirNuevoFormulario = () => {
    setEditando(null);
    setTitulo("");
    setMensaje("");
    setTipo("banner");
    setPrioridad("normal");
    setAudiencia("todos");
    setPlanAudiencia("");
    setEmpresaAudiencia("");
    setInicia(new Date().toISOString().slice(0, 16));
    setTermina("");
    setVisible(true);
    setTextoBoton("");
    setEnlaceBoton("");
    setMostrandoEditor(true);
  };

  const abrirEdicion = (c: Comunicado) => {
    setEditando(c);
    setTitulo(c.titulo);
    setMensaje(c.mensaje);
    setTipo(c.tipo);
    setPrioridad(c.prioridad);
    setAudiencia(c.audiencia);
    setPlanAudiencia(c.planAudiencia ?? "");
    setEmpresaAudiencia(c.empresaAudiencia ?? "");
    setInicia(c.inicia ? c.inicia.slice(0, 16) : new Date().toISOString().slice(0, 16));
    setTermina(c.termina ? c.termina.slice(0, 16) : "");
    setVisible(c.visible);
    setTextoBoton(c.textoBoton ?? "");
    setEnlaceBoton(c.enlaceBoton ?? "");
    setMostrandoEditor(true);
  };

  const guardar = async () => {
    if (!titulo.trim() || !mensaje.trim()) {
      toast.error("El título y el cuerpo del mensaje son obligatorios.");
      return;
    }
    if (audiencia === "plan" && !planAudiencia) {
      toast.error("Selecciona el plan destinatario.");
      return;
    }
    if (audiencia === "empresa" && !empresaAudiencia) {
      toast.error("Selecciona la empresa destinataria.");
      return;
    }

    const payload: EntradaComunicado = {
      id: editando ? editando.id : null,
      titulo: titulo.trim(),
      mensaje: mensaje.trim(),
      tipo,
      prioridad,
      audiencia,
      planAudiencia: audiencia === "plan" ? planAudiencia : null,
      empresaAudiencia: audiencia === "empresa" ? empresaAudiencia : null,
      inicia: new Date(inicia).toISOString(),
      termina: termina ? new Date(termina).toISOString() : null,
      visible,
      textoBoton: textoBoton.trim() || null,
      enlaceBoton: enlaceBoton.trim() || null,
    };

    setGuardando(true);
    const res = await guardarComunicadoFn({ data: payload });
    setGuardando(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success(editando ? "Anuncio actualizado correctamente." : "Nuevo anuncio creado y publicado.");
    setMostrandoEditor(false);
    await cargarDatos();
  };

  const toggleVisibilidad = async (c: Comunicado) => {
    const payload: EntradaComunicado = {
      id: c.id,
      titulo: c.titulo,
      mensaje: c.mensaje,
      tipo: c.tipo,
      prioridad: c.prioridad,
      audiencia: c.audiencia,
      planAudiencia: c.planAudiencia,
      empresaAudiencia: c.empresaAudiencia,
      inicia: c.inicia,
      termina: c.termina,
      visible: !c.visible,
      textoBoton: c.textoBoton,
      enlaceBoton: c.enlaceBoton,
    };

    const res = await guardarComunicadoFn({ data: payload });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success(c.visible ? "Anuncio desactivado." : "Anuncio activado.");
    await cargarDatos();
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este anuncio definitivamente?")) return;
    const res = await eliminarComunicadoFn({ data: { id } });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Anuncio eliminado.");
    await cargarDatos();
  };

  if (cargando) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Cargando Centro de Comunicación...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h3 className="text-base font-bold text-destructive">Error al cargar comunicación administrativa</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void cargarDatos()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reintentar
        </Button>
      </div>
    );
  }

  const ahoraIso = new Date().toISOString();

  // Métricas del Dashboard
  const activos = comunicados.filter(
    (c) => c.visible && c.inicia <= ahoraIso && (!c.termina || c.termina >= ahoraIso),
  );
  const programados = comunicados.filter((c) => c.visible && c.inicia > ahoraIso);
  const finalizados = comunicados.filter((c) => c.termina && c.termina < ahoraIso);
  const borradores = comunicados.filter((c) => !c.visible);

  const totalVistos = comunicados.reduce((a, b) => a + (b.vistos || 0), 0);
  const totalCerrados = comunicados.reduce((a, b) => a + (b.cerrados || 0), 0);
  const tasaLecturaGlobal =
    totalVistos + totalCerrados > 0
      ? Math.round((totalVistos / (totalVistos + totalCerrados)) * 100)
      : 100;

  // Filtrado de comunicados en la tabla
  const comunicadosFiltrados = comunicados.filter((c) => {
    const coincideBusqueda =
      c.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.mensaje.toLowerCase().includes(busqueda.toLowerCase());

    const coincideTipo = filtroTipo === "todos" || c.tipo === filtroTipo;

    let coincideEstado = true;
    if (filtroEstado === "activos") {
      coincideEstado = c.visible && c.inicia <= ahoraIso && (!c.termina || c.termina >= ahoraIso);
    } else if (filtroEstado === "programados") {
      coincideEstado = c.visible && c.inicia > ahoraIso;
    } else if (filtroEstado === "finalizados") {
      coincideEstado = !!(c.termina && c.termina < ahoraIso);
    } else if (filtroEstado === "borradores") {
      coincideEstado = !c.visible;
    }

    return coincideBusqueda && coincideTipo && coincideEstado;
  });

  return (
    <div className="space-y-6">
      {/* Header del Centro de Comunicación */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <MessageSquare className="h-6 w-6 text-primary" /> Centro de Comunicación Administrativa
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Gestión centralizada de comunicados, banners, popups emergentes y mantenimientos para clientes.
          </p>
        </div>
        <Button size="sm" className="h-9 text-xs gap-1.5 shadow-sm" onClick={abrirNuevoFormulario}>
          <Plus className="h-4 w-4" />
          Crear Nuevo Anuncio
        </Button>
      </div>

      {/* DASHBOARD DE MÉTRICAS & ESTADO */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-2xl border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Anuncios Activos</span>
            <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 font-mono">{activos.length}</div>
          <span className="text-[10px] text-muted-foreground">Visibles en plataforma</span>
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Programados</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600 font-mono">{programados.length}</div>
          <span className="text-[10px] text-muted-foreground">Publicación futura</span>
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Finalizados</span>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">{finalizados.length}</div>
          <span className="text-[10px] text-muted-foreground">Expirados</span>
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Borradores / Inactivos</span>
            <EyeOff className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 font-mono">{borradores.length}</div>
          <span className="text-[10px] text-muted-foreground">Sin publicar</span>
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Tasa de Lectura</span>
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary font-mono">{tasaLecturaGlobal}%</div>
          <span className="text-[10px] text-muted-foreground font-mono">{formatNumero(totalVistos)} lecturas totales</span>
        </div>
      </div>

      {/* PESTAÑAS: GESTIÓN DE ANUNCIOS & ESTADÍSTICAS */}
      <Tabs defaultValue="lista" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:w-80 bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="lista" className="text-xs font-semibold">Lista de Anuncios ({comunicados.length})</TabsTrigger>
          <TabsTrigger value="estadisticas" className="text-xs font-semibold">Estadísticas de Impacto</TabsTrigger>
        </TabsList>

        {/* PESTAÑA 1: LISTA & FILTROS DE ANUNCIOS */}
        <TabsContent value="lista" className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 space-y-4 shadow-sm">
            {/* Barra de Filtros y Búsqueda */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por título o contenido de mensaje..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full rounded-xl border bg-background pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="rounded-xl border bg-background px-2.5 py-1.5 text-xs font-medium"
                >
                  <option value="todos">Todos los tipos</option>
                  <option value="banner">Banners superiores</option>
                  <option value="popup">Popups emergentes</option>
                  <option value="aviso">Avisos normales</option>
                  <option value="mantenimiento">Mantenimientos</option>
                </select>

                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="rounded-xl border bg-background px-2.5 py-1.5 text-xs font-medium"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="activos">Solo activos</option>
                  <option value="programados">Programados</option>
                  <option value="finalizados">Finalizados</option>
                  <option value="borradores">Borradores</option>
                </select>
              </div>
            </div>

            {/* TABLA DE ANUNCIOS */}
            <div className="divide-y border rounded-xl overflow-hidden text-xs">
              <div className="bg-muted/50 p-3 grid grid-cols-12 font-semibold text-muted-foreground items-center">
                <span className="col-span-3">Título / Mensaje</span>
                <span className="col-span-2">Tipo Anuncio</span>
                <span className="col-span-2">Audiencia Target</span>
                <span className="col-span-2">Vigencia / Fechas</span>
                <span className="col-span-1 text-center font-mono">Lecturas</span>
                <span className="col-span-2 text-right">Acciones</span>
              </div>

              {comunicadosFiltrados.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Megaphone className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground font-medium">
                    No se encontraron comunicados con los filtros aplicados.
                  </p>
                </div>
              ) : (
                comunicadosFiltrados.map((c) => {
                  const estaActivo = c.visible && c.inicia <= ahoraIso && (!c.termina || c.termina >= ahoraIso);
                  const estaProgramado = c.visible && c.inicia > ahoraIso;
                  const estaFinalizado = !!(c.termina && c.termina < ahoraIso);

                  return (
                    <div key={c.id} className="p-3 grid grid-cols-12 items-center gap-2 hover:bg-muted/20 transition-colors">
                      {/* Título & Mensaje */}
                      <div className="col-span-3 min-w-0">
                        <span className="font-bold text-foreground block truncate">{c.titulo}</span>
                        <span className="text-[11px] text-muted-foreground truncate block">{c.mensaje}</span>
                      </div>

                      {/* Tipo Anuncio */}
                      <div className="col-span-2 flex items-center gap-1.5">
                        <Badge variant="outline" className={cn("text-[10px] font-semibold", CLASE_TIPO[c.tipo])}>
                          {ETIQUETA_TIPO_COMUNICADO[c.tipo] ?? c.tipo}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[9px]", CLASE_PRIORIDAD[c.prioridad])}>
                          {c.prioridad}
                        </Badge>
                      </div>

                      {/* Audiencia */}
                      <div className="col-span-2 text-muted-foreground">
                        <span className="font-medium text-foreground block">{ETIQUETA_AUDIENCIA[c.audiencia] ?? c.audiencia}</span>
                        {c.audiencia === "plan" && c.planAudiencia && (
                          <span className="text-[10px] font-mono text-primary">Plan: {c.planAudiencia}</span>
                        )}
                        {c.audiencia === "empresa" && c.empresaAudiencia && (
                          <span className="text-[10px] font-mono text-primary">ID: {c.empresaAudiencia}</span>
                        )}
                      </div>

                      {/* Vigencia */}
                      <div className="col-span-2 font-mono text-[11px] text-muted-foreground space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>Inicia: {new Date(c.inicia).toLocaleDateString("es-CL")}</span>
                        </div>
                        {c.termina ? (
                          <span className="block text-[10px]">Expira: {new Date(c.termina).toLocaleDateString("es-CL")}</span>
                        ) : (
                          <span className="block text-[10px] text-emerald-600">Sin expiración</span>
                        )}
                      </div>

                      {/* Lecturas / Métricas */}
                      <div className="col-span-1 text-center font-mono text-xs font-bold text-foreground">
                        {formatNumero(c.vistos)}
                      </div>

                      {/* Acciones */}
                      <div className="col-span-2 flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className={cn("h-7 px-2 text-[11px]", c.visible ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50")}
                          onClick={() => void toggleVisibilidad(c)}
                          title={c.visible ? "Desactivar Anuncio" : "Activar / Publicar Anuncio"}
                        >
                          {c.visible ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                          {c.visible ? "Ocultar" : "Publicar"}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => abrirEdicion(c)}
                          title="Editar Anuncio"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => void eliminar(c.id)}
                          title="Eliminar Anuncio"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>

        {/* PESTAÑA 2: ESTADÍSTICAS DE IMPACTO */}
        <TabsContent value="estadisticas" className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Rendimiento & Estadísticas de Interacción
            </h3>

            <div className="divide-y border rounded-xl overflow-hidden text-xs">
              <div className="bg-muted/50 p-3 grid grid-cols-6 font-semibold text-muted-foreground">
                <span className="col-span-2">Título de Anuncio</span>
                <span>Tipo</span>
                <span className="text-center font-mono">Impresiones / Leídos</span>
                <span className="text-center font-mono">Descartados / Cerrados</span>
                <span className="text-right font-mono">Tasa Efectividad</span>
              </div>
              {comunicados.map((c) => {
                const total = (c.vistos || 0) + (c.cerrados || 0);
                const pct = total > 0 ? Math.round(((c.vistos || 0) / total) * 100) : 100;
                return (
                  <div key={c.id} className="p-3 grid grid-cols-6 items-center">
                    <span className="col-span-2 font-semibold text-foreground truncate">{c.titulo}</span>
                    <div>
                      <Badge variant="outline" className={cn("text-[10px]", CLASE_TIPO[c.tipo])}>
                        {c.tipo}
                      </Badge>
                    </div>
                    <span className="text-center font-mono font-bold text-emerald-600">{formatNumero(c.vistos)}</span>
                    <span className="text-center font-mono text-muted-foreground">{formatNumero(c.cerrados)}</span>
                    <span className="text-right font-mono font-bold text-primary">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL / EDITOR DE ANUNCIOS */}
      {mostrandoEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                {editando ? "Editar Anuncio Administrativo" : "Crear Nuevo Anuncio Administrativo"}
              </h3>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setMostrandoEditor(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Título & Mensaje */}
              <div className="space-y-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Título del Anuncio *</label>
                  <input
                    type="text"
                    placeholder="Ej: Mantenimiento Programado del Motor SII"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Cuerpo del Mensaje *</label>
                  <textarea
                    rows={4}
                    placeholder="Detalla la información importante para tus clientes..."
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    className="w-full rounded-xl border bg-background p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Tipo & Prioridad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Tipo de Comunicado</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as TipoComunicado)}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs"
                  >
                    <option value="banner">Banner superior (destacado)</option>
                    <option value="popup">Popup emergente (modal)</option>
                    <option value="aviso">Aviso normal en dashboard</option>
                    <option value="mantenimiento">Alerta de mantenimiento</option>
                    <option value="informativo">Informativo general</option>
                  </select>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Prioridad</label>
                  <select
                    value={prioridad}
                    onChange={(e) => setPrioridad(e.target.value as PrioridadComunicado)}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs"
                  >
                    <option value="normal">Normal</option>
                    <option value="alta">Alta (destacada)</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
              </div>

              {/* Audiencia & Segmentación */}
              <div className="space-y-2 border-t pt-3">
                <label className="block text-muted-foreground font-semibold">Audiencia / Destinatarios</label>
                <select
                  value={audiencia}
                  onChange={(e) => setAudiencia(e.target.value as AudienciaComunicado)}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-xs"
                >
                  <option value="todos">Todos los clientes</option>
                  <option value="prueba">Solo clientes en prueba (Demo / Trial)</option>
                  <option value="activos">Solo clientes activos</option>
                  <option value="suspendidos">Clientes suspendidos / pago pendiente</option>
                  <option value="plan">Filtrar por plan específico</option>
                  <option value="empresa">Filtrar por una empresa específica</option>
                </select>

                {audiencia === "plan" && (
                  <div className="pt-1">
                    <label className="block text-muted-foreground mb-1">Selecciona el Plan Destino</label>
                    <select
                      value={planAudiencia}
                      onChange={(e) => setPlanAudiencia(e.target.value)}
                      className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-mono"
                    >
                      <option value="">-- Seleccionar Plan --</option>
                      {planes.map((p) => (
                        <option key={p.codigo} value={p.codigo}>
                          {p.nombre} ({p.codigo})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {audiencia === "empresa" && (
                  <div className="pt-1">
                    <label className="block text-muted-foreground mb-1">Selecciona la Empresa Destino</label>
                    <select
                      value={empresaAudiencia}
                      onChange={(e) => setEmpresaAudiencia(e.target.value)}
                      className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-mono"
                    >
                      <option value="">-- Seleccionar Empresa --</option>
                      {empresas.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre} ({e.id.slice(0, 8)}...)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Fechas de Publicación */}
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Fecha de Inicio *</label>
                  <input
                    type="datetime-local"
                    value={inicia}
                    onChange={(e) => setInicia(e.target.value)}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Fecha de Término (Opcional)</label>
                  <input
                    type="datetime-local"
                    value={termina}
                    onChange={(e) => setTermina(e.target.value)}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Botón CTA Opcional */}
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Texto del Botón CTA (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: Ver Detalles"
                    value={textoBoton}
                    onChange={(e) => setTextoBoton(e.target.value)}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-semibold">Enlace URL del Botón (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: /demo/f29"
                    value={enlaceBoton}
                    onChange={(e) => setEnlaceBoton(e.target.value)}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Visibilidad inmediatamente */}
              <div className="flex items-center gap-2 border-t pt-3">
                <input
                  type="checkbox"
                  id="visible-check"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                  className="rounded border"
                />
                <label htmlFor="visible-check" className="font-semibold text-foreground cursor-pointer">
                  Publicar inmediatamente (si está desmarcado, se guarda como borrador inactivo)
                </label>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button variant="ghost" size="sm" onClick={() => setMostrandoEditor(false)}>
                Cancelar
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => void guardar()} disabled={guardando}>
                {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Send className="h-3.5 w-3.5" />
                {editando ? "Guardar Cambios" : "Publicar Anuncio"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
