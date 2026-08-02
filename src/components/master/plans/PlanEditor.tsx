import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, CreditCard, DollarSign, Layers, Loader2, Save, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { actualizarPlanMasterFn, crearPlanMasterFn } from "@/lib/cuenta.functions";
import type { EntradaPlanMaster, PlanMaster } from "@/lib/cuenta.server";
import { PlanLimitsForm, type PlanLimitsData } from "./PlanLimitsForm";

export function PlanEditor({
  planExistente,
}: {
  planExistente?: PlanMaster;
}) {
  const navigate = useNavigate();
  const [guardando, setGuardando] = useState(false);

  // Form State
  const [code, setCode] = useState(planExistente?.code ?? "");
  const [name, setName] = useState(planExistente?.name ?? "");
  const [description, setDescription] = useState(planExistente?.description ?? "");
  const [priceClp, setPriceClp] = useState<number>(planExistente?.priceClp ?? 29900);
  const [billingPeriod, setBillingPeriod] = useState(planExistente?.billingPeriod ?? "monthly");
  const [supportLevel, setSupportLevel] = useState(planExistente?.supportLevel ?? "standard");
  const [isActive, setIsActive] = useState(planExistente?.isActive ?? true);
  const [isPublic, setIsPublic] = useState(planExistente?.isPublic ?? true);
  const [isFeatured, setIsFeatured] = useState(planExistente?.isFeatured ?? false);
  const [sortOrder, setSortOrder] = useState<number>(planExistente?.sortOrder ?? 10);

  // Limits State
  const [limits, setLimits] = useState<PlanLimitsData>({
    maxUsers: planExistente?.maxUsers ?? 2,
    monthlyUpdatesIncluded: planExistente?.monthlyUpdatesIncluded ?? 10,
    gatewayBudgetUnits: planExistente?.gatewayBudgetUnits ?? 100,
    initialHistoryPeriods: planExistente?.initialHistoryPeriods ?? 12,
    trialDays: planExistente?.trialDays ?? 14,
    accountantAccess: planExistente?.accountantAccess ?? true,
    features: {
      ivaAutomatico: planExistente ? planExistente.publicFeatures.includes("iva_automatico") : true,
      auditoriaTributaria: planExistente ? planExistente.publicFeatures.includes("auditoria_tributaria") : true,
      motorEspejo: planExistente ? planExistente.publicFeatures.includes("motor_espejo") : true,
      iaAnalisis: planExistente ? planExistente.publicFeatures.includes("ia_analisis") : false,
      reportesAvanzados: planExistente ? planExistente.publicFeatures.includes("reportes_avanzados") : true,
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error("El código y el nombre del plan son obligatorios.");
      return;
    }

    setGuardando(true);

    const publicFeaturesList: string[] = [];
    if (limits.features.ivaAutomatico) publicFeaturesList.push("iva_automatico");
    if (limits.features.auditoriaTributaria) publicFeaturesList.push("auditoria_tributaria");
    if (limits.features.motorEspejo) publicFeaturesList.push("motor_espejo");
    if (limits.features.iaAnalisis) publicFeaturesList.push("ia_analisis");
    if (limits.features.reportesAvanzados) publicFeaturesList.push("reportes_avanzados");

    const payload: EntradaPlanMaster = {
      code,
      name,
      description,
      priceClp: Number(priceClp),
      billingPeriod,
      supportLevel,
      isActive,
      isPublic,
      isFeatured,
      sortOrder: Number(sortOrder),
      trialDays: limits.trialDays,
      maxUsers: limits.maxUsers,
      monthlyUpdatesIncluded: limits.monthlyUpdatesIncluded,
      gatewayBudgetUnits: limits.gatewayBudgetUnits,
      initialHistoryPeriods: limits.initialHistoryPeriods,
      accountantAccess: limits.accountantAccess,
      publicFeatures: publicFeaturesList,
    };

    if (planExistente) {
      const res = await actualizarPlanMasterFn({
        data: { planId: planExistente.id, datos: payload },
      });
      if (!res.ok) {
        toast.error(res.error);
        setGuardando(false);
        return;
      }
      toast.success("Plan actualizado con éxito.");
    } else {
      const res = await crearPlanMasterFn({ data: payload });
      if (!res.ok) {
        toast.error(res.error);
        setGuardando(false);
        return;
      }
      toast.success("Plan creado con éxito.");
    }

    setGuardando(false);
    void navigate({ to: "/admin/planes" as any });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Topbar Actions */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" asChild>
          <Link to="/admin/planes">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a Planes
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={guardando}
            className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
          >
            {guardando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {planExistente ? "Guardar Cambios" : "Crear Plan"}
          </Button>
        </div>
      </div>

      {/* BLOQUE 1: ANTECEDENTES GENERALES Y PRECIO */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" /> Antecedentes Generales del Plan
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1.5">
            <Label htmlFor="code" className="text-xs font-semibold">
              Código Único *
            </Label>
            <Input
              id="code"
              placeholder="ej: basico, pro, enterprise"
              value={code}
              disabled={!!planExistente}
              onChange={(e) => setCode(e.target.value)}
              className="h-9 text-xs font-mono"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold">
              Nombre Comercial del Plan *
            </Label>
            <Input
              id="name"
              placeholder="ej: Plan Pyme Profesional"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="priceClp" className="text-xs font-semibold">
              Precio Mensual en CLP (Neto)
            </Label>
            <Input
              id="priceClp"
              type="number"
              min={0}
              placeholder="29900"
              value={priceClp}
              onChange={(e) => setPriceClp(parseInt(e.target.value) || 0)}
              className="h-9 text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="billingPeriod" className="text-xs font-semibold">
              Período de Facturación
            </Label>
            <Select value={billingPeriod} onValueChange={setBillingPeriod}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensual</SelectItem>
                <SelectItem value="annual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="supportLevel" className="text-xs font-semibold">
              Nivel de Soporte
            </Label>
            <Select value={supportLevel} onValueChange={setSupportLevel}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Estándar (Soporte Email)</SelectItem>
                <SelectItem value="priority">Prioritario (Chat y Email)</SelectItem>
                <SelectItem value="dedicated">Dedicado 24/7</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sortOrder" className="text-xs font-semibold">
              Orden de Visualización
            </Label>
            <Input
              id="sortOrder"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 10)}
              className="h-9 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <Label htmlFor="description" className="text-xs font-semibold">
            Descripción Pública del Plan
          </Label>
          <Textarea
            id="description"
            placeholder="Descripción orientada al cliente sobre el alcance de este plan..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-xs min-h-[70px]"
          />
        </div>

        {/* Toggles de Visibilidad y Estado */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl border bg-secondary/30">
            <span className="font-semibold">Plan Activo</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl border bg-secondary/30">
            <span className="font-semibold">Visible Públicamente</span>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl border bg-secondary/30">
            <span className="font-semibold">Destacar en Landing</span>
            <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
          </div>
        </div>
      </div>

      {/* BLOQUE 2: FORMULARIO DE LÍMITES */}
      <PlanLimitsForm data={limits} onChange={setLimits} />
    </form>
  );
}
