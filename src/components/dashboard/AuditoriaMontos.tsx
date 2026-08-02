import { useState } from "react";
import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { VatDebitAuditModal } from "@/components/tax/VatDebitAuditModal";
import { formatCLP } from "@/utils/currency";
import { calculateVatDebit, calculateVatCredit } from "@/utils/taxCalculations";
import { ETIQUETA_FUENTE_CONCEPTO } from "@/lib/taxContext";
import type { ConceptSource } from "@/types/engine";
import type { DashboardData } from "@/types/tax";

const CLASE_FUENTE: Record<ConceptSource, string> = {
  rcv: "border-primary/30 bg-primary/10 text-primary",
  f29_confirmed: "border-success/30 bg-success-soft text-success",
  accountant_confirmed: "border-success/30 bg-success-soft text-success",
  previous_confirmed_period: "border-success/30 bg-success-soft text-success",
  company_tax_profile: "border-border bg-secondary text-muted-foreground",
  calculated: "border-border bg-secondary text-muted-foreground",
  estimated: "border-warning/40 bg-warning-soft text-warning-foreground",
  unknown: "border-warning/40 bg-warning-soft text-warning-foreground",
  mock: "border-border bg-secondary text-muted-foreground",
};

interface Linea {
  concepto: string;
  monto: string;
  formula: string;
  fuente: ConceptSource;
}

function Etiqueta({ fuente }: { fuente: ConceptSource }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${CLASE_FUENTE[fuente]}`}
    >
      {ETIQUETA_FUENTE_CONCEPTO[fuente]}
    </span>
  );
}

/**
 * Desglose de cada cifra con la procedencia del componente correspondiente.
 * La procedencia se toma del contexto tributario: cada concepto puede tener
 * un origen distinto dentro del mismo periodo.
 */
export function AuditoriaMontos({ data }: { data: DashboardData }) {
  const [modalAuditOpen, setModalAuditOpen] = useState(false);
  const [modalAuditCreditoOpen, setModalAuditCreditoOpen] = useState(false);
  const { resumen, ventas, compras, contexto } = data;
  const s = contexto.sources;
  const esDemo = data.fuentePeriodo === "mock";

  const traceIvaDebito =
    resumen.calculationTrace ??
    calculateVatDebit(data.documentosVenta).calculationTrace;

  const traceIvaCredito =
    resumen.calculationTraceCredito ??
    calculateVatCredit(data.documentosCompra).calculationTrace;

  const tasaPpmTexto =
    contexto.ppm_rate != null
      ? `${(contexto.ppm_rate * 100).toLocaleString("es-CL", {
          maximumFractionDigits: 2,
        })}%`
      : "sin tasa registrada";

  const otrosDebitos = contexto.other_vat_debits + contexto.special_debits;
  const otrosCreditos = contexto.other_vat_credits + contexto.special_credits;

  const lineas: Linea[] = [
    {
      concepto: "Ventas netas del periodo",
      monto: formatCLP(ventas.ventasNetas),
      formula: `${ventas.cantidadDocumentosInformados} documentos informados (${ventas.cantidadFacturas} facturas, ${ventas.cantidadBoletas} boletas, ${ventas.cantidadNotasCredito} notas de crédito que restan).`,
      fuente: s.sales_source,
    },
    {
      concepto: "IVA débito por ventas",
      monto: formatCLP(contexto.vat_debit),
      formula: resumen.ivaDebitoInferido
        ? "Suma del IVA informado en cada documento; en algunos se infirió desde el neto."
        : "Suma del IVA informado en cada documento de venta, restando las notas de crédito.",
      fuente: s.vat_debit_source,
    },
    {
      concepto: "IVA crédito por compras",
      monto: formatCLP(contexto.current_period_vat_credit),
      formula: `${compras.documentosRegistrados} documentos con derecho a crédito; ${compras.documentosPendientes} pendientes (${formatCLP(resumen.ivaCreditoPotencial)} potenciales) quedan fuera.`,
      fuente: s.vat_credit_source,
    },
    {
      concepto: "Remanente anterior",
      monto: formatCLP(contexto.previous_vat_carryforward),
      formula: contexto.carryforward_known
        ? "Remanente confirmado según los antecedentes del periodo anterior."
        : "No hay remanente confirmado: se calcula con cero y podría cambiar.",
      fuente: s.carryforward_source,
    },
    ...(otrosDebitos > 0
      ? [
          {
            concepto: "Otros débitos y ajustes especiales",
            monto: formatCLP(otrosDebitos),
            formula: "Débitos de IVA distintos de los documentos del RCV.",
            fuente: s.special_adjustments_source,
          },
        ]
      : []),
    ...(otrosCreditos > 0
      ? [
          {
            concepto: "Otros créditos y ajustes especiales",
            monto: formatCLP(otrosCreditos),
            formula: "Créditos de IVA distintos de los documentos del RCV.",
            fuente: s.special_adjustments_source,
          },
        ]
      : []),
    {
      concepto: "IVA estimado por pagar",
      monto: formatCLP(contexto.estimated_vat_payable),
      formula: `${formatCLP(contexto.vat_debit + otrosDebitos)} de débitos − ${formatCLP(contexto.total_vat_credits)} de créditos totales.`,
      fuente: "calculated",
    },
    {
      concepto: "PPM estimado",
      monto: formatCLP(contexto.estimated_ppm),
      formula: `Base ${formatCLP(contexto.ppm_tax_base)} (${ETIQUETA_FUENTE_CONCEPTO[s.ppm_base_source].toLowerCase()}) × tasa ${tasaPpmTexto}.`,
      fuente: s.ppm_rate_source,
    },
    {
      concepto: "Retenciones estimadas",
      monto: formatCLP(contexto.withholdings),
      formula: "Retenciones registradas para el periodo.",
      fuente: s.withholdings_source,
    },
    {
      concepto: "Total tributario estimado",
      monto: formatCLP(contexto.estimated_tax_total),
      formula: `${formatCLP(contexto.estimated_vat_payable)} + ${formatCLP(contexto.estimated_ppm)} + ${formatCLP(contexto.withholdings)}.`,
      fuente: s.total_source,
    },
    {
      concepto: "Reserva recomendada",
      monto: formatCLP(resumen.reservaRecomendada),
      formula: `Total tributario + margen preventivo de ${resumen.margenPorcentaje}% (${formatCLP(resumen.margenPreventivo)}).`,
      fuente: "calculated",
    },
  ];

  return (
    <>
      <SectionCard
        titulo="Auditoría de los montos"
        descripcion="Desglose de cada cifra y el origen de la información utilizada."
      >
        <ul className="space-y-3">
          {lineas.map((l) => (
            <li key={l.concepto} className="rounded-xl bg-secondary/60 p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-semibold">{l.concepto}</p>
                <p className="shrink-0 text-sm font-bold tabular-nums">{l.monto}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{l.formula}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Etiqueta fuente={l.fuente} />
                {l.concepto === "IVA débito por ventas" && (
                  <Button
                    size="sm"
                    onClick={() => setModalAuditOpen(true)}
                    className="h-7 text-xs px-3 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
                  >
                    Ver auditoría
                  </Button>
                )}
                {l.concepto === "IVA crédito por compras" && (
                  <Button
                    size="sm"
                    onClick={() => setModalAuditCreditoOpen(true)}
                    className="h-7 text-xs px-3 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
                  >
                    Ver auditoría
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-muted-foreground">
          {esDemo
            ? "Datos simulados para pruebas. No corresponden a información obtenida del SII."
            : "Estimación informativa. El resultado definitivo debe ser confirmado por tu contador."}
        </p>
      </SectionCard>

      <VatDebitAuditModal
        open={modalAuditOpen}
        onOpenChange={setModalAuditOpen}
        calculationTrace={traceIvaDebito}
        periodo={resumen.periodo}
      />

      <VatDebitAuditModal
        open={modalAuditCreditoOpen}
        onOpenChange={setModalAuditCreditoOpen}
        calculationTrace={traceIvaCredito}
        periodo={resumen.periodo}
        titulo="Auditoría de IVA Crédito por Compras"
      />
    </>
  );
}
