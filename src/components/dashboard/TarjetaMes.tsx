import { useState } from "react";
import { Pencil, PiggyBank } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MoneyDialog } from "@/components/shared/MoneyDialog";
import { DataRow } from "@/components/shared/SectionCard";
import { formatCLP } from "@/utils/currency";
import { evaluarReserva } from "@/utils/taxCalculations";
import { resolverEstadoMensual, type TonoEstado } from "@/lib/estadoMensual";
import type { ContextoTributario } from "@/lib/taxContext";
import type { FuentePeriodo, ResumenMensual } from "@/types/tax";
import { cn } from "@/lib/utils";

const FONDO: Record<TonoEstado, string> = {
  primary: "border-primary/30 bg-info-soft",
  success: "border-success/30 bg-success-soft",
  warning: "border-warning/40 bg-warning-soft",
  neutral: "border-border bg-secondary/50",
};

const TEXTO: Record<TonoEstado, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning-foreground",
  neutral: "text-muted-foreground",
};

/**
 * Tarjeta principal del mes: un solo estado, un solo monto destacado y una
 * acción recomendada. Toda la lógica de estado vive en `estadoMensual.ts`.
 */
export function TarjetaMes({
  resumen,
  contexto,
  fuentePeriodo,
  onGuardarReservado,
}: {
  resumen: ResumenMensual;
  contexto?: ContextoTributario;
  fuentePeriodo?: FuentePeriodo;
  onGuardarReservado: (valor: number) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const estado = resolverEstadoMensual({ resumen, contexto, fuentePeriodo });
  const { faltante, cobertura } = evaluarReserva(
    resumen.reservaRecomendada,
    resumen.dineroReservado,
  );

  const declarado = contexto?.declared_tax_total ?? null;
  const declaradoPor = (clave: "vat" | "ppm" | "withholdings") =>
    contexto?.diferencias.find((d) => d.clave === clave)?.declarado ?? null;
  const remanente = Math.max(0, resumen.nuevoRemanente ?? 0);
  const mostrarReserva =
    estado.estado === "reserva_recomendada" ||
    estado.estado === "estimacion_incompleta" ||
    estado.estado === "declaracion_pendiente";

  return (
    <section className={cn("card-surface border p-5 sm:p-6", FONDO[estado.tono])}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="text-base font-semibold sm:text-lg">{estado.titulo}</h2>
        </div>
        <span
          className={cn(
            "rounded-full bg-card px-3 py-1 text-xs font-semibold",
            TEXTO[estado.tono],
          )}
        >
          {estado.etiquetaMonto}
        </span>
      </div>

      <p className="num-xl mt-4 break-words sm:text-[2.75rem]">
        {formatCLP(estado.monto)}
      </p>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{estado.mensaje}</p>

      {estado.faltantes.length > 0 && (
        <ul className="mt-3 space-y-1">
          {estado.faltantes.map((detalle) => (
            <li key={detalle} className="text-xs text-muted-foreground">
              • {detalle}
            </li>
          ))}
        </ul>
      )}

      {mostrarReserva && (
        <div className="mt-4">
          <Progress value={cobertura} aria-label="Cobertura de la reserva" />
          <p className="mt-2 text-xs text-muted-foreground">
            Tu reserva cubre {Math.round(cobertura)}% de la estimación actual.
          </p>
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-card p-4">
        {declarado != null ? (
          <>
            {declaradoPor("vat") != null && (
              <DataRow
                label="IVA declarado"
                value={formatCLP(declaradoPor("vat") as number)}
              />
            )}
            {declaradoPor("ppm") != null && (
              <DataRow
                label="PPM declarado"
                value={formatCLP(declaradoPor("ppm") as number)}
              />
            )}
            {declaradoPor("withholdings") != null && (
              <DataRow
                label="Retenciones declaradas"
                value={formatCLP(declaradoPor("withholdings") as number)}
              />
            )}
            {remanente > 0 && (
              <DataRow
                label="Remanente de IVA a tu favor"
                value={formatCLP(remanente)}
                tone="success"
              />
            )}
            <DataRow
              label="Total del Formulario 29"
              value={formatCLP(declarado)}
              strong
            />
          </>
        ) : (
          <>
            <DataRow
              label="Impuestos estimados"
              value={formatCLP(resumen.totalTributarioEstimado)}
            />
            {remanente > 0 && (
              <DataRow
                label="Remanente de IVA a tu favor"
                value={formatCLP(remanente)}
                tone="success"
              />
            )}
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
          </>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-border/60 bg-card/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Qué conviene hacer
        </p>
        <p className="mt-1 text-sm">{estado.accion}</p>
      </div>

      {declarado == null && (
        <Button
          variant="outline"
          className="mt-4 w-full sm:w-auto"
          onClick={() => setAbierto(true)}
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Editar “Ya tengo reservado”
        </Button>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        {estado.origen} Información referencial: no reemplaza a tu contador.
      </p>

      <MoneyDialog
        open={abierto}
        onOpenChange={setAbierto}
        titulo="Dinero que ya tienes reservado"
        descripcion="Registra cuánto dinero mantienes separado hoy para tus impuestos."
        etiqueta="Monto reservado"
        valor={resumen.dineroReservado}
        onGuardar={onGuardarReservado}
      />
    </section>
  );
}
