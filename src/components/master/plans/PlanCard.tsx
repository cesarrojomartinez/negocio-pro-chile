import React from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Edit,
  Eye,
  EyeOff,
  Power,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlanMaster } from "@/lib/cuenta.server";
import { cn } from "@/lib/utils";
import { formatCLP } from "@/utils/currency";

export function PlanCard({
  plan,
  onToggleEstado,
}: {
  plan: PlanMaster;
  onToggleEstado: (planId: string, currentActive: boolean) => void;
}) {
  const tieneFeature = (clave: string) => {
    return plan.publicFeatures.includes(clave) || plan.publicFeatures.includes(`✓ ${clave}`);
  };

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md relative overflow-hidden",
        !plan.isActive && "opacity-70 bg-muted/20 border-dashed",
        plan.isFeatured && "border-primary/50 ring-1 ring-primary/20",
      )}
    >
      {/* Cintas y Badges Destacados */}
      {plan.isFeatured && (
        <div className="absolute top-0 right-0 rounded-bl-xl bg-primary px-3 py-0.5 text-[10px] font-bold text-primary-foreground">
          Más Popular
        </div>
      )}

      <div>
        {/* Cabecera del Plan */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-semibold",
                  plan.isActive
                    ? "border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-rose-500/30 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
                )}
              >
                {plan.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              Código: {plan.code}
            </p>
          </div>
        </div>

        {/* Descripción */}
        {plan.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
            {plan.description}
          </p>
        )}

        {/* Precio Mensual */}
        <div className="mb-4 rounded-xl bg-secondary/50 p-3">
          <span className="text-xs text-muted-foreground block font-medium">Precio Mensual</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-black text-foreground tabular-nums">
              {plan.priceClp !== null && plan.priceClp > 0
                ? formatCLP(plan.priceClp)
                : "Gratis"}
            </span>
            {plan.priceClp !== null && plan.priceClp > 0 && (
              <span className="text-xs text-muted-foreground">/ mes</span>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
            <span>Suscripciones activas:</span>
            <span className="font-bold text-foreground tabular-nums">{plan.companyCount} empresas</span>
          </div>
        </div>

        {/* Resumen de Límites */}
        <div className="space-y-2 mb-4 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Límites del Plan
          </span>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-foreground">
              <Users className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{plan.maxUsers} usuarios máx</span>
            </div>
            <div className="flex items-center gap-1.5 text-foreground">
              <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>{plan.monthlyUpdatesIncluded} DTEs/mes</span>
            </div>
            <div className="flex items-center gap-1.5 text-foreground">
              <Clock className="h-3.5 w-3.5 text-info shrink-0" />
              <span>{plan.trialDays} días prueba</span>
            </div>
            <div className="flex items-center gap-1.5 text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>{plan.initialHistoryPeriods} mes. historia</span>
            </div>
          </div>
        </div>

        {/* Funcionalidades Clave */}
        <div className="space-y-1.5 border-t pt-3 mb-4 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Características Habilitadas
          </span>

          <div className="space-y-1 text-[11px]">
            {[
              { id: "iva_automatico", label: "IVA Automático en Vivo" },
              { id: "auditoria_tributaria", label: "Visor Auditoría Trace" },
              { id: "motor_espejo", label: "Motor Tributario Espejo" },
              { id: "ia_analisis", label: "IA Análisis F29" },
              { id: "reportes_avanzados", label: "Reportes Avanzados" },
            ].map((f) => {
              const activo = tieneFeature(f.id) || plan.publicFeatures.length === 0;
              return (
                <div key={f.id} className="flex items-center gap-1.5">
                  {activo ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  )}
                  <span className={cn(activo ? "text-foreground" : "text-muted-foreground/60 line-through")}>
                    {f.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Botones de Acción */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t">
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
          <Link to="/admin/planes/$planId" params={{ planId: plan.id }}>
            <Edit className="h-3.5 w-3.5" />
            Editar
          </Link>
        </Button>

        <Button
          variant={plan.isActive ? "ghost" : "outline"}
          size="sm"
          className={cn(
            "h-8 text-xs gap-1.5",
            plan.isActive
              ? "text-destructive hover:bg-destructive/10"
              : "text-emerald-600 hover:bg-emerald-50 border-emerald-500/30",
          )}
          onClick={() => onToggleEstado(plan.id, plan.isActive)}
        >
          <Power className="h-3.5 w-3.5" />
          {plan.isActive ? "Desactivar" : "Activar"}
        </Button>
      </div>
    </div>
  );
}
