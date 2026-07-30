import { useState } from "react";
import { PiggyBank, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MoneyDialog } from "@/components/shared/MoneyDialog";
import { DataRow } from "@/components/shared/SectionCard";
import { formatCLP } from "@/utils/currency";
import { evaluarReserva, MENSAJE_SEMAFORO } from "@/utils/taxCalculations";
import type { ResumenMensual } from "@/types/tax";
import { cn } from "@/lib/utils";

const ESTILOS = {
  verde: "border-success/30 bg-success-soft",
  ambar: "border-warning/40 bg-warning-soft",
  rojo: "border-destructive/30 bg-danger-soft",
} as const;

const TEXTO_ESTADO = {
  verde: "text-success",
  ambar: "text-warning-foreground",
  rojo: "text-destructive",
} as const;

export function ReservaCard({
  resumen,
  onGuardarReservado,
}: {
  resumen: ResumenMensual;
  onGuardarReservado: (valor: number) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const { estado, faltante, cobertura } = evaluarReserva(
    resumen.reservaRecomendada,
    resumen.dineroReservado,
  );

  return (
    <section className={cn("card-surface border p-5 sm:p-6", ESTILOS[estado])}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="text-base font-semibold sm:text-lg">Reserva recomendada</h2>
        </div>
        <span
          className={cn(
            "rounded-full bg-card px-3 py-1 text-xs font-semibold",
            TEXTO_ESTADO[estado],
          )}
        >
          {MENSAJE_SEMAFORO[estado]}
        </span>
      </div>

      <p className="num-xl mt-4 break-words sm:text-[2.75rem]">
        {formatCLP(resumen.reservaRecomendada)}
      </p>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Procura mantener este monto separado para cubrir tus impuestos estimados del
        mes.
      </p>

      <div className="mt-4">
        <Progress value={cobertura} aria-label="Cobertura de la reserva" />
        <p className="mt-2 text-xs text-muted-foreground">
          Tu reserva cubre {Math.round(cobertura)}% de la estimación actual.
        </p>
      </div>

      <div className="mt-4 rounded-2xl bg-card p-4">
        <DataRow
          label="Impuestos estimados"
          value={formatCLP(resumen.totalTributarioEstimado)}
        />
        <DataRow
          label="Margen preventivo"
          value={formatCLP(resumen.margenPreventivo)}
        />
        <DataRow
          label="Reserva recomendada"
          value={formatCLP(resumen.reservaRecomendada)}
          strong
        />
        <DataRow
          label="Ya tienes reservado"
          value={formatCLP(resumen.dineroReservado)}
          tone="primary"
        />
        <DataRow
          label={faltante > 0 ? "Te faltan por reservar" : "Diferencia pendiente"}
          value={formatCLP(faltante)}
          tone={faltante > 0 ? "danger" : "success"}
          strong
        />
      </div>

      <Button
        variant="outline"
        className="mt-4 w-full sm:w-auto"
        onClick={() => setAbierto(true)}
      >
        <Pencil className="h-4 w-4" aria-hidden />
        Editar “Ya tengo reservado”
      </Button>

      <p className="mt-3 text-xs text-muted-foreground">
        Estimación informativa. No corresponde a una declaración oficial del SII.
      </p>

      <MoneyDialog
        open={abierto}
        onOpenChange={setAbierto}
        titulo="Dinero que ya tienes reservado"
        descripcion="Registra cuánto dinero mantienes separado hoy para tus impuestos. Solo se guarda en esta demostración."
        etiqueta="Monto reservado"
        valor={resumen.dineroReservado}
        onGuardar={onGuardarReservado}
      />
    </section>
  );
}
