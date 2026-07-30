import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { SectionCard } from "@/components/shared/SectionCard";
import { formatCLP } from "@/utils/currency";
import { ETIQUETA_ESTADO_CALCULO } from "@/lib/taxContext";
import type { ContextoTributario } from "@/lib/taxContext";
import { cn } from "@/lib/utils";

const ESTILO_ESTADO: Record<ContextoTributario["calculation_status"], string> = {
  complete: "border-success/30 bg-success-soft text-success",
  estimated_complete: "border-primary/30 bg-info-soft text-primary",
  incomplete: "border-warning/40 bg-warning-soft text-warning-foreground",
  confirmed: "border-success/30 bg-success-soft text-success",
  closed: "border-success/30 bg-success-soft text-success",
};

const DESCRIPCION_ESTADO: Record<ContextoTributario["calculation_status"], string> = {
  complete:
    "Todos los componentes del periodo tienen un antecedente confirmado o proveniente del Registro de Compras y Ventas.",
  estimated_complete:
    "El cálculo usa toda la información disponible, con algunos componentes estimados.",
  incomplete:
    "Faltan antecedentes para completar el cálculo. La cifra puede cambiar cuando se confirmen.",
  confirmed: "Los antecedentes del Formulario 29 fueron confirmados por tu contador.",
  closed:
    "El periodo está cerrado y sus cifras corresponden al Formulario 29 confirmado.",
};

/**
 * Estado de completitud del periodo, componentes faltantes y comparación entre
 * la estimación y el Formulario 29 declarado.
 */
export function EstadoCalculo({ contexto }: { contexto: ContextoTributario }) {
  const estado = contexto.calculation_status;
  const incompleto = estado === "incomplete";
  const Icono = incompleto ? AlertTriangle : estado === "estimated_complete" ? Info : CheckCircle2;

  return (
    <SectionCard
      titulo="Estado del cálculo"
      descripcion="Qué información respalda esta estimación y qué antecedentes faltan."
    >
      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl border p-4",
          ESTILO_ESTADO[estado],
        )}
      >
        <Icono className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">{ETIQUETA_ESTADO_CALCULO[estado]}</p>
          <p className="text-sm">{DESCRIPCION_ESTADO[estado]}</p>
        </div>
      </div>

      {contexto.missing_components.length > 0 && (
        <ul className="mt-4 space-y-2">
          {contexto.missing_components.map((c) => (
            <li key={c.clave} className="rounded-xl bg-secondary/60 p-3">
              <p className="text-sm font-semibold">{c.etiqueta}</p>
              <p className="text-xs text-muted-foreground">{c.detalle}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded-2xl bg-secondary/60 p-4">
        <p className="text-sm font-semibold">Fórmula del IVA del periodo</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatCLP(contexto.vat_debit)} de IVA débito
          {contexto.other_vat_debits + contexto.special_debits > 0
            ? ` + ${formatCLP(contexto.other_vat_debits + contexto.special_debits)} de otros débitos`
            : ""}{" "}
          − {formatCLP(contexto.total_vat_credits)} de créditos totales (
          {formatCLP(contexto.current_period_vat_credit)} del periodo +{" "}
          {formatCLP(contexto.previous_vat_carryforward)} de remanente anterior
          {contexto.other_vat_credits + contexto.special_credits > 0
            ? ` + ${formatCLP(contexto.other_vat_credits + contexto.special_credits)} de otros créditos`
            : ""}
          ) ={" "}
          {contexto.gross_vat_position >= 0
            ? `${formatCLP(contexto.estimated_vat_payable)} por pagar.`
            : `${formatCLP(contexto.estimated_new_carryforward)} de nuevo remanente.`}
        </p>
      </div>

      {contexto.diferencias.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">
            Comparación con el Formulario 29 declarado
          </p>
          <ul className="mt-2 space-y-2">
            {contexto.diferencias.map((d) => (
              <li
                key={d.clave}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl bg-secondary/60 px-3 py-2.5"
              >
                <span className="text-sm">{d.etiqueta}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  estimado {formatCLP(d.estimado)} · declarado {formatCLP(d.declarado)}
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    d.diferencia === 0 ? "text-success" : "text-warning-foreground",
                  )}
                >
                  {d.diferencia === 0
                    ? "Sin diferencia"
                    : `${d.diferencia > 0 ? "+" : "−"}${formatCLP(Math.abs(d.diferencia))}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Estimación informativa. El resultado definitivo debe ser confirmado por tu
        contador.
      </p>
    </SectionCard>
  );
}
