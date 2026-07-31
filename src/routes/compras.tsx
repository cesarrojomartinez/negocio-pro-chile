import { createFileRoute, Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/shared/AppShell";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { DocumentList } from "@/components/shared/DocumentList";
import { ComparacionCard } from "@/components/dashboard/ComparacionCard";
import { EmptyState, LoadingBlock, LoadingCards } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";
import { formatCLP, formatNumero } from "@/utils/currency";

export const Route = createFileRoute("/compras")({
  head: () => ({
    meta: [
      { title: "Compras del mes | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Revisa tus compras registradas, el IVA crédito considerado y los documentos pendientes del periodo.",
      },
      { property: "og:title", content: "Compras del mes | Mi Negocio al Día" },
      {
        property: "og:description",
        content: "Compras, crédito de IVA y proveedores principales del periodo.",
      },
    ],
  }),
  component: Compras,
});

function Compras() {
  const { data, cargando } = useTaxDashboard();

  return (
    <AppShell>
      <div className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Compras</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Documentos de compra considerados en tu estimación de IVA.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/ventas">Ir a ventas</Link>
          </Button>
        </header>

        {cargando || !data ? (
          <>
            <LoadingCards />
            <LoadingBlock alto="h-80" />
          </>
        ) : data.documentosCompra.length === 0 &&
          data.compras.comprasTotales === 0 &&
          data.compras.ivaCredito === 0 &&
          data.compras.documentosRegistrados === 0 ? (
          <EmptyState
            titulo="Sin compras registradas"
            mensaje="Todavía no hay documentos de compra registrados en este periodo."
          />
        ) : (
          <>
            {data.compras.documentosPendientes > 0 && (
              <div
                role="status"
                className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4"
              >
                <TriangleAlert
                  className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground"
                  aria-hidden
                />
                <p className="text-sm text-warning-foreground">
                  Tienes {data.compras.documentosPendientes} compras pendientes que
                  podrían modificar tu IVA estimado cuando cambien de estado.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                titulo="Compras totales"
                monto={formatCLP(data.compras.comprasTotales)}
                descripcion="Compras consideradas durante el periodo."
                variacion={data.comparacion.variacionCompras}
                interpretarComoPositivo={false}
                destacado
              />
              <StatCard
                titulo="Compras netas"
                monto={formatCLP(data.compras.comprasNetas)}
                descripcion="Monto sin IVA de tus compras registradas."
              />
              <StatCard
                titulo="IVA crédito considerado"
                monto={formatCLP(data.compras.ivaCredito)}
                descripcion="Crédito que reduce tu IVA estimado del mes."
              />
              <StatCard
                titulo="Documentos registrados"
                monto={formatNumero(data.compras.documentosRegistrados)}
                descripcion="Compras incluidas en el cálculo."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                titulo="Pendientes"
                monto={formatNumero(data.compras.documentosPendientes)}
                descripcion="Aún no se consideran en el cálculo."
              />
              <StatCard
                titulo="Reclamadas"
                monto={formatNumero(data.compras.documentosReclamados)}
                descripcion="Documentos rechazados ante el proveedor."
              />
              <StatCard
                titulo="Marcadas como no incluir"
                monto={formatNumero(data.compras.documentosNoIncluir)}
                descripcion="Excluidas del crédito de IVA."
              />
            </div>

            <SectionCard
              titulo="Proveedores principales"
              descripcion="Compras registradas de mayor monto en el periodo."
            >
              {data.compras.proveedoresPrincipales.length === 0 ? (
                <EmptyState
                  titulo="Sin proveedores registrados"
                  mensaje="No hay compras registradas en este periodo."
                />
              ) : (
                <ul className="space-y-2">
                  {data.compras.proveedoresPrincipales.map((p) => (
                    <li
                      key={p.nombre}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{p.nombre}</span>
                        <span className="block text-xs text-muted-foreground">
                          {p.documentos} documentos
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCLP(p.monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              titulo="Documentos de compra"
              descripcion="En esta etapa no es posible cambiar el estado de las compras."
            >
              {data.documentosCompra.length === 0 ? (
                <EmptyState
                  titulo="Sin detalle documento por documento"
                  mensaje="Los totales de compras provienen del resumen oficial del RCV del periodo."
                />
              ) : (
                <DocumentList
                  documentos={data.documentosCompra}
                  tipos={["factura", "notaCredito"]}
                  estados={["registrada", "pendiente", "reclamada", "noIncluir"]}
                  etiquetaContraparte="Proveedor"
                  vacio={{
                    titulo: "Sin documentos con estos filtros",
                    mensaje: "Ajusta los filtros para ver otras compras del periodo.",
                  }}
                />
              )}
            </SectionCard>


            <ComparacionCard comparacion={data.comparacion} resumen={data.resumen} />
          </>
        )}
      </div>
    </AppShell>
  );
}
