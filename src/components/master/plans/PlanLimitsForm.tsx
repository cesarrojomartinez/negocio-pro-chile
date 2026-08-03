import React from "react";
import { Check, ShieldCheck, Sparkles, Users, Zap } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface PlanLimitsData {
  maxUsers: number;
  monthlyUpdatesIncluded: number;
  gatewayBudgetUnits: number;
  initialHistoryPeriods: number;
  trialDays: number;
  accountantAccess: boolean;
  features: {
    ivaAutomatico: boolean;
    auditoriaTributaria: boolean;
    motorEspejo: boolean;
    iaAnalisis: boolean;
    reportesAvanzados: boolean;
  };
}

export function PlanLimitsForm({
  data,
  onChange,
}: {
  data: PlanLimitsData;
  onChange: (data: PlanLimitsData) => void;
}) {
  const setNumber = (field: keyof Omit<PlanLimitsData, "features" | "accountantAccess">, val: number) => {
    onChange({ ...data, [field]: Math.max(0, val) });
  };

  const setFeature = (feat: keyof PlanLimitsData["features"], val: boolean) => {
    onChange({
      ...data,
      features: {
        ...data.features,
        [feat]: val,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* SECCIÓN 1: LÍMITES CUANTITATIVOS */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <Zap className="h-4 w-4 text-amber-500" />
          Límites de Uso y Capacidad
        </h3>
        <p className="text-xs text-muted-foreground">
          Define los umbrales máximos de operaciones y recursos asignados a las empresas con este plan.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1.5">
            <Label htmlFor="maxUsers" className="text-xs font-semibold">
              Usuarios Máximos
            </Label>
            <Input
              id="maxUsers"
              type="number"
              min={1}
              value={data.maxUsers}
              onChange={(e) => setNumber("maxUsers", parseInt(e.target.value) || 1)}
              className="h-9 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Miembros activos simultáneos</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="monthlyUpdates" className="text-xs font-semibold">
              Créditos IA Mensuales
            </Label>
            <Input
              id="monthlyUpdates"
              type="number"
              min={0}
              value={data.monthlyUpdatesIncluded}
              onChange={(e) => setNumber("monthlyUpdatesIncluded", parseInt(e.target.value) || 0)}
              className="h-9 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Cuota de créditos IA incluidos mensualmente</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gatewayUnits" className="text-xs font-semibold">
              Unidades Gateway SII
            </Label>
            <Input
              id="gatewayUnits"
              type="number"
              min={0}
              value={data.gatewayBudgetUnits}
              onChange={(e) => setNumber("gatewayBudgetUnits", parseInt(e.target.value) || 0)}
              className="h-9 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Presupuesto mensual de peticiones Gateway</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="historyPeriods" className="text-xs font-semibold">
              Meses de Historia Inicial
            </Label>
            <Input
              id="historyPeriods"
              type="number"
              min={1}
              max={60}
              value={data.initialHistoryPeriods}
              onChange={(e) => setNumber("initialHistoryPeriods", parseInt(e.target.value) || 1)}
              className="h-9 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Meses de carpetas tributarias precargadas</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trialDays" className="text-xs font-semibold">
              Días de Prueba Gratis (Trial)
            </Label>
            <Input
              id="trialDays"
              type="number"
              min={0}
              value={data.trialDays}
              onChange={(e) => setNumber("trialDays", parseInt(e.target.value) || 0)}
              className="h-9 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Período de gracia inicial sin cobro</p>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: FUNCIONALIDADES HABILITADAS */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Funcionalidades Habilitadas en el Motor
        </h3>
        <p className="text-xs text-muted-foreground">
          Habilita o restringe características premium para este nivel de suscripción.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* IVA Automático */}
          <div className="flex items-center justify-between p-3 rounded-xl border bg-secondary/30">
            <div className="space-y-0.5">
              <span className="font-bold block">IVA Automático</span>
              <span className="text-[11px] text-muted-foreground">
                Cálculo en vivo de IVA Débito y Crédito desde RCV
              </span>
            </div>
            <Switch
              checked={data.features.ivaAutomatico}
              onCheckedChange={(val) => setFeature("ivaAutomatico", val)}
            />
          </div>

          {/* Auditoría Tributaria */}
          <div className="flex items-center justify-between p-3 rounded-xl border bg-secondary/30">
            <div className="space-y-0.5">
              <span className="font-bold block">Auditoría Tributaria (Visor Trace)</span>
              <span className="text-[11px] text-muted-foreground">
                Visor de traza matemática de documentos considerados/excluidos
              </span>
            </div>
            <Switch
              checked={data.features.auditoriaTributaria}
              onCheckedChange={(val) => setFeature("auditoriaTributaria", val)}
            />
          </div>

          {/* Motor Espejo */}
          <div className="flex items-center justify-between p-3 rounded-xl border bg-secondary/30">
            <div className="space-y-0.5">
              <span className="font-bold block">Motor Tributario Espejo v1.0</span>
              <span className="text-[11px] text-muted-foreground">
                Auditoría en tiempo real en paralelo con el SII
              </span>
            </div>
            <Switch
              checked={data.features.motorEspejo}
              onCheckedChange={(val) => setFeature("motorEspejo", val)}
            />
          </div>

          {/* IA Análisis */}
          <div className="flex items-center justify-between p-3 rounded-xl border bg-secondary/30">
            <div className="space-y-0.5">
              <span className="font-bold block">IA Análisis & Asistente</span>
              <span className="text-[11px] text-muted-foreground">
                Detección inteligente de anomalías y sugerencias F29
              </span>
            </div>
            <Switch
              checked={data.features.iaAnalisis}
              onCheckedChange={(val) => setFeature("iaAnalisis", val)}
            />
          </div>

          {/* Reportes Avanzados */}
          <div className="flex items-center justify-between p-3 rounded-xl border bg-secondary/30">
            <div className="space-y-0.5">
              <span className="font-bold block">Reportes Avanzados & Exportación</span>
              <span className="text-[11px] text-muted-foreground">
                Descarga de conciliación en PDF y libros contables Excel
              </span>
            </div>
            <Switch
              checked={data.features.reportesAvanzados}
              onCheckedChange={(val) => setFeature("reportesAvanzados", val)}
            />
          </div>

          {/* Acceso Contador */}
          <div className="flex items-center justify-between p-3 rounded-xl border bg-secondary/30">
            <div className="space-y-0.5">
              <span className="font-bold block">Acceso Multiusuario / Contador</span>
              <span className="text-[11px] text-muted-foreground">
                Permite invitar contadores externos a la plataforma
              </span>
            </div>
            <Switch
              checked={data.accountantAccess}
              onCheckedChange={(val) => onChange({ ...data, accountantAccess: val })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
