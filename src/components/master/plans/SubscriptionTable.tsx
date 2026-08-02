import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpDown,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  Edit,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ETIQUETA_ESTADO, type EstadoCuenta } from "@/lib/cuenta";
import { asignarPlanClienteMasterFn, cambiarEstadoCuentaFn } from "@/lib/cuenta.functions";
import type { PlanMaster, SuscripcionMaster } from "@/lib/cuenta.server";
import { cn } from "@/lib/utils";
import { formatCLP, formatFechaHora } from "@/utils/currency";

type FiltroEstadoSub = "todas" | "active" | "trial" | "suspended" | "cancelled" | "renovacion_proxima";

const CLASE_ESTADO: Record<EstadoCuenta, string> = {
  active: "border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  trial: "border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  payment_pending: "border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  suspended: "border-rose-500/30 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  cancelled: "border-secondary bg-secondary text-muted-foreground",
};

export function SubscriptionTable({
  suscripciones,
  planes,
  onRefrescar,
}: {
  suscripciones: SuscripcionMaster[];
  planes: PlanMaster[];
  onRefrescar: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoSub>("todas");
  const [filtroPlan, setFiltroPlan] = useState<string>("todos");

  // Reasignar Plan Modal
  const [subSeleccionada, setSubSeleccionada] = useState<SuscripcionMaster | null>(null);
  const [nuevoPlanId, setNuevoPlanId] = useState("");
  const [guardandoPlan, setGuardandoPlan] = useState(false);

  const cambiarPlanCliente = async () => {
    if (!subSeleccionada || !nuevoPlanId) return;
    setGuardandoPlan(true);

    const res = await asignarPlanClienteMasterFn({
      data: { companyId: subSeleccionada.companyId, planId: nuevoPlanId },
    });

    if (!res.ok) {
      toast.error(res.error);
      setGuardandoPlan(false);
      return;
    }

    toast.success("Plan actualizado para la empresa.");
    setGuardandoPlan(false);
    setSubSeleccionada(null);
    onRefrescar();
  };

  const cambiarEstado = async (companyId: string, estado: EstadoCuenta) => {
    const res = await cambiarEstadoCuentaFn({ data: { companyId, estado } });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Suscripción actualizada a ${estado}.`);
    onRefrescar();
  };

  // Filtrado
  const subsFiltradas = suscripciones.filter((s) => {
    const coincideBusqueda = `${s.companyName} ${s.companyRut}`
      .toLowerCase()
      .includes(busqueda.trim().toLowerCase());

    const coincidePlan = filtroPlan === "todos" ? true : s.planId === filtroPlan;

    let coincideEstado = true;
    if (filtroEstado === "renovacion_proxima") {
      if (!s.nextRenewalAt) coincideEstado = false;
      else {
        const dias = (new Date(s.nextRenewalAt).getTime() - Date.now()) / (1000 * 3600 * 24);
        coincideEstado = dias >= 0 && dias <= 7;
      }
    } else if (filtroEstado !== "todas") {
      coincideEstado = s.status === filtroEstado;
    }

    return coincideBusqueda && coincidePlan && coincideEstado;
  });

  return (
    <div className="space-y-4">
      {/* BARRA DE FILTROS */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Buscador */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar suscripción por Razón Social o RUT..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          {/* Filtro por Plan */}
          <div className="w-48">
            <Select value={filtroPlan} onValueChange={setFiltroPlan}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Filtrar por plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los planes</SelectItem>
                {planes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filtro por Estado */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t text-xs">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Estado:
          </span>
          {[
            { id: "todas", label: "Todas" },
            { id: "active", label: "Activas" },
            { id: "trial", label: "Prueba / Trial" },
            { id: "renovacion_proxima", label: "Renovación Próxima" },
            { id: "suspended", label: "Suspendidas" },
            { id: "cancelled", label: "Canceladas" },
          ].map((f) => (
            <Button
              key={f.id}
              variant={filtroEstado === f.id ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setFiltroEstado(f.id as FiltroEstadoSub)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* TABLA DE SUSCRIPCIONES */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y">
            <thead className="bg-muted/50 font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Empresa / RUT</th>
                <th className="p-3">Plan Actual</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Inicio</th>
                <th className="p-3">Próxima Renovación</th>
                <th className="p-3 text-right">Monto Mensual</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subsFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No se encontraron suscripciones con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                subsFiltradas.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    {/* Empresa */}
                    <td className="p-3">
                      <Link
                        to="/admin/clientes/$companyId"
                        params={{ companyId: s.companyId }}
                        className="font-bold text-foreground hover:text-primary transition-colors text-sm block"
                      >
                        {s.companyName}
                      </Link>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        RUT: {s.companyRut}
                      </span>
                    </td>

                    {/* Plan */}
                    <td className="p-3">
                      <span className="font-semibold text-foreground">{s.planName}</span>
                    </td>

                    {/* Estado */}
                    <td className="p-3">
                      <Badge variant="outline" className={cn("text-[10px] font-medium", CLASE_ESTADO[s.status])}>
                        {ETIQUETA_ESTADO[s.status] ?? s.status}
                      </Badge>
                    </td>

                    {/* Inicio */}
                    <td className="p-3 font-mono text-muted-foreground text-[11px]">
                      {new Date(s.startedAt).toLocaleDateString("es-CL")}
                    </td>

                    {/* Renovación */}
                    <td className="p-3 font-mono text-[11px]">
                      {s.nextRenewalAt
                        ? new Date(s.nextRenewalAt).toLocaleDateString("es-CL")
                        : "Sin fecha"}
                    </td>

                    {/* Monto Mensual */}
                    <td className="p-3 text-right font-mono font-bold text-foreground">
                      {s.priceClp ? formatCLP(s.priceClp) : "Gratis"}
                    </td>

                    {/* Acciones */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          onClick={() => {
                            setSubSeleccionada(s);
                            setNuevoPlanId(s.planId);
                          }}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Cambiar Plan
                        </Button>

                        {s.status === "active" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] text-destructive hover:bg-destructive/10"
                            onClick={() => void cambiarEstado(s.companyId, "suspended")}
                          >
                            Suspender
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] text-emerald-600 hover:bg-emerald-50"
                            onClick={() => void cambiarEstado(s.companyId, "active")}
                          >
                            Activar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DIALOGO DE CAMBIO DE PLAN */}
      {subSeleccionada && (
        <Dialog open={!!subSeleccionada} onOpenChange={() => setSubSeleccionada(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Reasignar Plan Comercial
              </DialogTitle>
              <DialogDescription className="text-xs">
                Selecciona el nuevo plan para la empresa{" "}
                <span className="font-bold text-foreground">{subSeleccionada.companyName}</span> (RUT:{" "}
                {subSeleccionada.companyRut}).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <label className="text-xs font-semibold block">Nuevo Plan Asignado</label>
              <Select value={nuevoPlanId} onValueChange={setNuevoPlanId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent>
                  {planes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.priceClp ? formatCLP(p.priceClp) : "Gratis"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSubSeleccionada(null)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={guardandoPlan}
                onClick={() => void cambiarPlanCliente()}
                className="h-8 text-xs bg-primary text-primary-foreground font-semibold"
              >
                {guardandoPlan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar Asignación"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
