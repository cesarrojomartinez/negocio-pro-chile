import { useState } from "react";
import { Pencil, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DataRow } from "@/components/shared/SectionCard";
import { MoneyDialog } from "@/components/shared/MoneyDialog";
import { formatCLP, formatPorcentaje } from "@/utils/currency";
import { evaluarMeta } from "@/utils/taxCalculations";
import type { MetaComercial } from "@/types/tax";
import { cn } from "@/lib/utils";

const TONO = {
  buenDesempeno: "bg-success-soft text-success",
  ritmoAdecuado: "bg-info-soft text-primary",
  necesitaImpulso: "bg-warning-soft text-warning-foreground",
} as const;

export function MetaCard({
  meta,
  onGuardarMeta,
  mostrarNotaVentas = true,
}: {
  meta: MetaComercial;
  onGuardarMeta: (v: number) => void;
  mostrarNotaVentas?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const evaluacion = evaluarMeta(meta);

  return (
    <section className="card-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="text-base font-semibold sm:text-lg">Meta mensual</h2>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            TONO[evaluacion.estado],
          )}
        >
          {evaluacion.titulo}
        </span>
      </div>

      <p className="num-xl mt-4 break-words">{formatCLP(meta.ventasAcumuladas)}</p>
      <p className="text-sm text-muted-foreground">
        de una meta de {formatCLP(meta.metaMensual)}
      </p>

      <div className="mt-4">
        <Progress
          value={Math.min(100, meta.porcentajeCumplimiento)}
          aria-label="Avance de la meta mensual"
        />
        <p className="mt-2 text-sm font-semibold">
          Cumplimiento: {formatPorcentaje(meta.porcentajeCumplimiento)}
        </p>
      </div>

      <div className="mt-4 rounded-2xl bg-secondary/60 p-4">
        <DataRow label="Meta mensual" value={formatCLP(meta.metaMensual)} />
        <DataRow label="Ventas acumuladas" value={formatCLP(meta.ventasAcumuladas)} />
        <DataRow
          label="Falta para la meta"
          value={formatCLP(meta.montoFaltante)}
          tone={meta.montoFaltante > 0 ? "warning" : "success"}
        />
        <DataRow label="Días restantes" value={`${meta.diasRestantes} días`} />
        <DataRow
          label="Promedio diario necesario"
          value={formatCLP(meta.promedioDiarioNecesario)}
        />
        <DataRow
          label="Proyección de cierre"
          value={formatCLP(meta.proyeccionCierre)}
          strong
          tone="primary"
        />
      </div>

      <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-sm">
        {evaluacion.mensaje}
      </p>

      {mostrarNotaVentas && (
        <p className="mt-2 text-xs text-muted-foreground">
          Vender más puede aumentar la reserva tributaria, pero no significa que
          vender más sea perjudicial. Revisa también tu margen y tus costos.
        </p>
      )}

      <Button
        variant="outline"
        className="mt-4 w-full sm:w-auto"
        onClick={() => setAbierto(true)}
      >
        <Pencil className="h-4 w-4" aria-hidden />
        Editar meta mensual
      </Button>

      <MoneyDialog
        open={abierto}
        onOpenChange={setAbierto}
        titulo="Editar meta mensual"
        descripcion="Define cuánto quieres vender este mes. El valor se guarda solo en esta demostración."
        etiqueta="Meta mensual"
        valor={meta.metaMensual}
        onGuardar={onGuardarMeta}
      />
    </section>
  );
}
