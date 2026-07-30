import { SectionCard } from "@/components/shared/SectionCard";
import { VariationPill } from "@/components/shared/VariationPill";
import { EmptyState } from "@/components/shared/States";
import { formatCLP, formatFecha, formatNumero } from "@/utils/currency";
import { evaluarReserva } from "@/utils/taxCalculations";
import type { ComparacionMensual, ResumenMensual } from "@/types/tax";
import { PERIODOS } from "@/data/mockTaxData";

function etiquetaPeriodo(id: string | null) {
  return PERIODOS.find((p) => p.id === id)?.etiqueta ?? "Periodo anterior";
}

function Fila({
  label,
  actual,
  anterior,
  variacion,
  interpretarComoPositivo = true,
}: {
  label: string;
  actual: string;
  anterior: string;
  variacion?: number | null;
  interpretarComoPositivo?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="num-md mt-1 break-words text-lg">{actual}</p>
      <p className="mt-1 text-xs text-muted-foreground">Mes anterior: {anterior}</p>
      {variacion !== undefined && (
        <div className="mt-2">
          <VariationPill
            variacion={variacion}
            interpretarComoPositivo={interpretarComoPositivo}
          />
        </div>
      )}
    </div>
  );
}

export function ComparacionCard({
  comparacion,
  resumen,
}: {
  comparacion: ComparacionMensual;
  resumen: ResumenMensual;
}) {
  if (!comparacion.periodoAnterior) {
    return (
      <SectionCard titulo="Comparación con el mes anterior">
        <EmptyState
          titulo="Sin comparación anterior"
          mensaje="Todavía no tenemos un periodo previo cargado en la demostración para comparar."
        />
      </SectionCard>
    );
  }

  const { estado } = evaluarReserva(
    resumen.reservaRecomendada,
    resumen.dineroReservado,
  );

  const mensajes: string[] = [];
  if (comparacion.variacionVentas !== null) {
    if (comparacion.variacionVentas > 0.5)
      mensajes.push(
        `Vendiste ${Math.abs(comparacion.variacionVentas).toLocaleString("es-CL", { maximumFractionDigits: 1 })}% más que el mes pasado.`,
      );
    else if (comparacion.variacionVentas < -0.5)
      mensajes.push(
        `Vendiste ${Math.abs(comparacion.variacionVentas).toLocaleString("es-CL", { maximumFractionDigits: 1 })}% menos que el mes pasado.`,
      );
    else mensajes.push("Tus ventas se mantienen similares al mes pasado.");
  }
  if (
    comparacion.variacionCompras !== null &&
    comparacion.variacionVentas !== null &&
    comparacion.variacionCompras > comparacion.variacionVentas
  ) {
    mensajes.push("Tus compras aumentaron más rápido que tus ventas.");
  }
  if (comparacion.ticketPromedio > comparacion.ticketPromedioAnterior) {
    mensajes.push("Tu ticket promedio mejoró.");
  }
  if (resumen.ivaCredito < (comparacion.ivaAnterior || 0)) {
    mensajes.push("Este mes tienes menos crédito fiscal disponible.");
  }
  mensajes.push(
    estado === "verde"
      ? "Tu reserva tributaria está cubierta."
      : "Tu reserva todavía no cubre la estimación.",
  );

  return (
    <SectionCard
      titulo="Comparación con el mes anterior"
      descripcion={`${etiquetaPeriodo(comparacion.periodoActual)} frente a ${etiquetaPeriodo(comparacion.periodoAnterior)}.`}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Fila
          label="Ventas"
          actual={formatCLP(comparacion.ventasActuales)}
          anterior={formatCLP(comparacion.ventasAnteriores)}
          variacion={comparacion.variacionVentas}
        />
        <Fila
          label="Compras"
          actual={formatCLP(comparacion.comprasActuales)}
          anterior={formatCLP(comparacion.comprasAnteriores)}
          variacion={comparacion.variacionCompras}
          interpretarComoPositivo={false}
        />
        <Fila
          label="IVA estimado"
          actual={formatCLP(comparacion.ivaActual)}
          anterior={formatCLP(comparacion.ivaAnterior)}
          variacion={comparacion.variacionIva}
          interpretarComoPositivo={false}
        />
        <Fila
          label="Ticket promedio"
          actual={formatCLP(comparacion.ticketPromedio)}
          anterior={formatCLP(comparacion.ticketPromedioAnterior)}
        />
        <Fila
          label="Documentos emitidos"
          actual={`${formatNumero(comparacion.cantidadFacturas)} facturas · ${formatNumero(comparacion.cantidadBoletas)} boletas`}
          anterior="Resumen del periodo"
        />
        <Fila
          label="Mejor día y mejor semana"
          actual={
            comparacion.mejorDia
              ? `${formatFecha(comparacion.mejorDia.fecha)} · ${formatCLP(comparacion.mejorDia.monto)}`
              : "Sin ventas registradas"
          }
          anterior={
            comparacion.mejorSemana
              ? `${comparacion.mejorSemana.etiqueta}: ${formatCLP(comparacion.mejorSemana.monto)}`
              : "Sin información"
          }
        />
      </div>

      <ul className="mt-4 space-y-2">
        {mensajes.map((m) => (
          <li
            key={m}
            className="rounded-xl bg-secondary px-3 py-2 text-sm text-foreground"
          >
            {m}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
