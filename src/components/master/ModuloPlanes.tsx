import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/shared/SectionCard";
import {
  CargandoMaster,
  ErrorMaster,
  useRecursoMaster,
} from "@/components/master/MasterUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { planesMasterFn, guardarPlanMasterFn } from "@/lib/master.functions";
import type { EntradaPlanMaster, PlanMaster } from "@/lib/master.server";
import { formatCLP } from "@/utils/currency";

export function ModuloPlanes() {
  const { datos, error, cargando, recargar } = useRecursoMaster<PlanMaster[]>(() =>
    planesMasterFn(),
  );

  if (cargando) return <CargandoMaster texto="Cargando planes…" />;
  if (error || !datos) return <ErrorMaster mensaje={error ?? "Sin información."} />;

  return (
    <div className="space-y-5">
      <SectionCard
        titulo="Planes y límites"
        descripcion="Lo que guardes aquí se aplica de inmediato al registro, a las suscripciones y a la página pública."
      >
        <p className="text-sm text-muted-foreground">
          {datos.length} planes configurados. Cambiar un límite no modifica cálculos
          tributarios ni consume créditos.
        </p>
      </SectionCard>

      {datos.map((plan) => (
        <EditorPlan key={plan.id} plan={plan} onGuardado={recargar} />
      ))}
    </div>
  );
}

function EditorPlan({ plan, onGuardado }: { plan: PlanMaster; onGuardado: () => Promise<void> }) {
  const [f, setF] = useState<EntradaPlanMaster>({
    id: plan.id,
    nombre: plan.nombre,
    descripcion: plan.descripcion ?? "",
    precioClp: plan.precioClp,
    periodicidad: plan.periodicidad,
    diasPrueba: plan.diasPrueba,
    maxEmpresas: plan.maxEmpresas,
    maxUsuarios: plan.maxUsuarios,
    actualizacionesIncluidas: plan.actualizacionesIncluidas,
    periodosHistoricosIniciales: plan.periodosHistoricosIniciales,
    accesoContador: plan.accesoContador,
    soporte: plan.soporte,
    presupuestoGateway: plan.presupuestoGateway,
    caracteristicas: plan.caracteristicas,
    visibleEnLanding: plan.visibleEnLanding,
    destacado: plan.destacado,
    activo: plan.activo,
    orden: plan.orden,
  });
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    const r = await guardarPlanMasterFn({ data: f });
    setGuardando(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Plan actualizado.");
    await onGuardado();
  };

  return (
    <SectionCard
      titulo={`${plan.nombre} (${plan.codigo})`}
      descripcion={`${plan.empresasSuscritas} empresas suscritas · ${plan.precioClp ? formatCLP(plan.precioClp) : "Gratis"}`}
      acciones={
        <Button size="sm" disabled={guardando} onClick={() => void guardar()}>
          Guardar cambios
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre visible">
          <Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        </Campo>
        <Campo label="Precio mensual en pesos (vacío = gratis)">
          <Input
            inputMode="numeric"
            value={f.precioClp ?? ""}
            onChange={(e) =>
              setF({
                ...f,
                precioClp: e.target.value.trim() === "" ? null : Number(e.target.value.replace(/\D/g, "")),
              })
            }
          />
        </Campo>
        <Campo label="Descripción" className="sm:col-span-2">
          <Textarea
            rows={2}
            value={f.descripcion}
            onChange={(e) => setF({ ...f, descripcion: e.target.value })}
          />
        </Campo>
        <Campo label="Días de prueba">
          <Input
            inputMode="numeric"
            value={f.diasPrueba}
            onChange={(e) => setF({ ...f, diasPrueba: Number(e.target.value) || 0 })}
          />
        </Campo>
        <Campo label="Periodicidad de cobro">
          <Input
            value={f.periodicidad}
            onChange={(e) => setF({ ...f, periodicidad: e.target.value })}
          />
        </Campo>
        <Campo label="Máximo de empresas">
          <Input
            inputMode="numeric"
            value={f.maxEmpresas}
            onChange={(e) => setF({ ...f, maxEmpresas: Number(e.target.value) || 1 })}
          />
        </Campo>
        <Campo label="Máximo de usuarios">
          <Input
            inputMode="numeric"
            value={f.maxUsuarios}
            onChange={(e) => setF({ ...f, maxUsuarios: Number(e.target.value) || 1 })}
          />
        </Campo>
        <Campo label="Actualizaciones incluidas al mes">
          <Input
            inputMode="numeric"
            value={f.actualizacionesIncluidas}
            onChange={(e) =>
              setF({ ...f, actualizacionesIncluidas: Number(e.target.value) || 0 })
            }
          />
        </Campo>
        <Campo label="Periodos históricos iniciales">
          <Input
            inputMode="numeric"
            value={f.periodosHistoricosIniciales}
            onChange={(e) =>
              setF({ ...f, periodosHistoricosIniciales: Number(e.target.value) || 0 })
            }
          />
        </Campo>
        <Campo label="Presupuesto de créditos API">
          <Input
            inputMode="numeric"
            value={f.presupuestoGateway}
            onChange={(e) => setF({ ...f, presupuestoGateway: Number(e.target.value) || 0 })}
          />
        </Campo>
        <Campo label="Nivel de soporte">
          <Input value={f.soporte} onChange={(e) => setF({ ...f, soporte: e.target.value })} />
        </Campo>
        <Campo label="Beneficios visibles (uno por línea)" className="sm:col-span-2">
          <Textarea
            rows={4}
            value={f.caracteristicas.join("\n")}
            onChange={(e) => setF({ ...f, caracteristicas: e.target.value.split("\n") })}
          />
        </Campo>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Interruptor
          label="Acceso para contador"
          valor={f.accesoContador}
          onChange={(v) => setF({ ...f, accesoContador: v })}
        />
        <Interruptor
          label="Visible en la página pública"
          valor={f.visibleEnLanding}
          onChange={(v) => setF({ ...f, visibleEnLanding: v })}
        />
        <Interruptor
          label="Destacar como recomendado"
          valor={f.destacado}
          onChange={(v) => setF({ ...f, destacado: v })}
        />
        <Interruptor
          label="Plan activo"
          valor={f.activo}
          onChange={(v) => setF({ ...f, activo: v })}
        />
      </div>
    </SectionCard>
  );
}

function Campo({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Interruptor({
  label,
  valor,
  onChange,
}: {
  label: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2 text-sm">
      {label}
      <Switch checked={valor} onCheckedChange={onChange} />
    </label>
  );
}
