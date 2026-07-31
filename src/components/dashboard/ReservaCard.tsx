import { useState } from "react";
import { PiggyBank, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MoneyDialog } from "@/components/shared/MoneyDialog";
import { DataRow } from "@/components/shared/SectionCard";
import { formatCLP } from "@/utils/currency";
import { evaluarReserva, MENSAJE_SEMAFORO } from "@/utils/taxCalculations";
import type { ResumenMensual } from "@/types/tax";
import type { ContextoTributario } from "@/lib/taxContext";
import { cn } from "@/lib/utils";

const ESTILOS = {
  verde: "border-success/30 bg-success-soft",
  ambar: "border-warning/40 bg-warning-soft",
  rojo: "border-destructive/30 bg-danger-soft",
  neutral: "border-border bg-secondary/50",
} as const;

const TEXTO_ESTADO = {
  verde: "text-success",
  ambar: "text-warning-foreground",
  rojo: "text-destructive",
  neutral: "text-muted-foreground",
} as const;

export function ReservaCard({
  resumen,
  contexto,
  onGuardarReservado,
}: {
  resumen: ResumenMensual;
  /** Contexto tributario del periodo, para advertir cálculos incompletos. */
  contexto?: ContextoTributario;
  onGuardarReservado: (valor: number) => void;
}) {
  const incompleto = contexto?.calculation_status === "incomplete";
  const [abierto, setAbierto] = useState(false);
  const { estado, faltante, cobertura } = evaluarReserva(
    resumen.reservaRecomendada,
    resumen.dineroReservado,
  );
  // Cuando no hay impuestos que reservar pero sí quedó IVA a favor, la tarjeta
  // debe explicarlo en vez de mostrar solamente $0.
  const remanente = resumen.nuevoRemanente ?? 0;
  const aFavor =
    !incompleto && resumen.reservaRecomendada <= 0 && remanente > 0;

  // Si el periodo ya tiene F29 presentado, lo relevante es cuánto se pagó,
  // no cuánto conviene reservar (eso aplica al mes en curso, sin F29 aún).
  const declarado = contexto?.declared_tax_total ?? null;
  const yaDeclarado = declarado != null;
  const declaradoPor = (clave: "vat" | "ppm" | "withholdings") =>
    contexto?.diferencias.find((d) => d.clave === clave)?.declarado ?? null;

  if (yaDeclarado) {
    const pagado = declarado as number;
    return (
      <section
        className={cn(
          "card-surface border p-5 sm:p-6",
          pagado > 0 ? ESTILOS.neutral : ESTILOS.verde,
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="text-base font-semibold sm:text-lg">
              {pagado > 0 ? "Impuesto pagado del mes" : "Este mes no pagaste impuestos"}
            </h2>
          </div>
          <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
            Según el Formulario 29 del periodo
          </span>
        </div>

        <p className="num-xl mt-4 break-words sm:text-[2.75rem]">
          {formatCLP(pagado)}
        </p>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {pagado > 0
            ? "Corresponde al total a pagar declarado en el Formulario 29 de este periodo."
            : "El Formulario 29 de este periodo quedó en $0 a pagar."}
        </p>

        <div className="mt-4 rounded-2xl bg-card p-4">
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
            label="Total pagado (F29)"
            value={formatCLP(pagado)}
            strong
          />
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          La reserva recomendada aplica al mes en curso, mientras aún no
          presentas el Formulario 29. No reemplaza a tu contador.
        </p>
      </section>
    );
  }

  return (
    <section className={cn("card-surface border p-5 sm:p-6", ESTILOS[estado])}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="text-base font-semibold sm:text-lg">
            {incompleto ? "Reserva mínima conocida" : "Reserva recomendada"}
          </h2>
        </div>
        <span
          className={cn(
            "rounded-full bg-card px-3 py-1 text-xs font-semibold",
            TEXTO_ESTADO[estado],
          )}
        >
          {aFavor
            ? `Este mes no pagas IVA: te queda ${formatCLP(remanente)} a favor.`
            : MENSAJE_SEMAFORO[estado]}
        </span>
      </div>

      <p className="num-xl mt-4 break-words sm:text-[2.75rem]">
        {aFavor ? formatCLP(remanente) : formatCLP(resumen.reservaRecomendada)}
      </p>
      {aFavor && (
        <p className="mt-1 text-sm font-semibold text-success">
          Remanente de IVA a tu favor
        </p>
      )}
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        {incompleto
          ? "Faltan antecedentes por confirmar, así que este monto es el mínimo conocido y podría aumentar."
          : aFavor
            ? "No necesitas reservar dinero este mes. Este monto es crédito de IVA que se descuenta de tus impuestos del próximo periodo."
            : "Procura mantener este monto separado para cubrir tus impuestos estimados del mes."}
      </p>


      {incompleto && contexto && (
        <ul className="mt-3 space-y-1">
          {contexto.missing_components.map((c) => (
            <li key={c.clave} className="text-xs text-muted-foreground">
              • {c.detalle}
            </li>
          ))}
        </ul>
      )}

      {!aFavor && (
        <div className="mt-4">
          <Progress value={cobertura} aria-label="Cobertura de la reserva" />
          <p className="mt-2 text-xs text-muted-foreground">
            Tu reserva cubre {Math.round(cobertura)}% de la estimación actual.
          </p>
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-card p-4">
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
