import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/shared/AppShell";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { DocumentList } from "@/components/shared/DocumentList";
import { VentasChart } from "@/components/sales/VentasChart";

import { EmptyState, LoadingBlock, LoadingCards } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";
import { formatCLP, formatNumero } from "@/utils/currency";

export const Route = createFileRoute("/ventas")({
  head: () => ({
    meta: [
      { title: "Ventas del mes | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Revisa tus facturas, boletas, notas de crédito y ticket promedio del periodo.",
      },
      { property: "og:title", content: "Ventas del mes | Mi Negocio al Día" },
      {
        property: "og:description",
        content: "Detalle de facturas, boletas y notas de crédito del periodo.",
      },
    ],
  }),
  component: Ventas,
});

function Ventas() {
  const { data, cargando } = useTaxDashboard();

  return (
    <AppShell>
      <div className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Ventas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Documentos de venta registrados en el periodo seleccionado.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/compras">Ir a compras</Link>
          </Button>
        </header>

        {cargando || !data ? (
          <>
            <LoadingCards />
            <LoadingBlock alto="h-80" />
          </>
        ) : data.ventas.cantidadDocumentos === 0 ? (
          <EmptyState
            titulo="Sin ventas registradas"
            mensaje="Todavía no hay documentos de venta registrados en este periodo."
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                titulo="Ventas totales"
                monto={formatCLP(data.ventas.ventasTotales)}
                descripcion="Total registrado durante el mes."
                variacion={data.comparacion.variacionVentas}
                destacado
              />
              <StatCard
                titulo="Facturado"
                monto={formatCLP(data.ventas.ventasFacturas)}
                descripcion="Ventas respaldadas mediante facturas."
                contexto={`${formatNumero(data.ventas.cantidadFacturas)} facturas emitidas.`}
              />
              <StatCard
                titulo="Boletas"
                monto={formatCLP(data.ventas.ventasBoletas)}
                descripcion="Boletas y resúmenes de venta registrados."
                contexto={`${formatNumero(data.ventas.cantidadBoletas)} resúmenes diarios.`}
              />
              <StatCard
                titulo="Notas de crédito"
                monto={formatCLP(data.ventas.notasCredito)}
                descripcion="Descuentos y anulaciones del periodo."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                titulo="Ventas exentas"
                monto={formatCLP(data.ventas.ventasExentas)}
                descripcion="Montos sin IVA incluidos en tus documentos."
              />
              <StatCard
                titulo="Cantidad de documentos"
                monto={formatNumero(data.ventas.cantidadDocumentos)}
                descripcion="Facturas y boletas del periodo."
              />
              <StatCard
                titulo="Ticket promedio"
                monto={formatCLP(data.ventas.ticketPromedio)}
                descripcion="Promedio por documento emitido."
              />
            </div>

            <SectionCard
              titulo="Ventas por día"
              descripcion="Evolución diaria de facturas y boletas del periodo."
            >
              <VentasChart serie={data.ventas.serieDiaria} />
            </SectionCard>

            <SectionCard
              titulo="Documentos de venta"
              descripcion="Listado informativo. No es posible modificar los documentos."
            >
              <DocumentList
                documentos={data.documentosVenta}
                tipos={["factura", "boleta", "notaCredito"]}
                estados={["emitido", "anulado"]}
                etiquetaContraparte="Cliente"
                vacio={{
                  titulo: "Sin documentos con estos filtros",
                  mensaje: "Ajusta los filtros para ver otros documentos del periodo.",
                }}
              />
            </SectionCard>

            
          </>
        )}
      </div>
    </AppShell>
  );
}
