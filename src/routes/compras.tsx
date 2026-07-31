import { createFileRoute, Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/shared/AppShell";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { DocumentList } from "@/components/shared/DocumentList";

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
                titulo="IVA no recuperable"
                monto={formatCLP(data.compras.ivaNoRecuperable)}
                descripcion="IVA de compras que no reduce tu impuesto del mes."
              />
              <StatCard
                titulo="Compras exentas / sin IVA"
                monto={formatCLP(data.compras.ivaNoRecuperableDetalle.comprasSinIva)}
                descripcion="Monto exento informado en tus compras del periodo."
              />
            </div>

            <SectionCard
              titulo="Cómo se componen las compras totales"
              descripcion="Estimación informativa. No reemplaza a tu contador."
            >
              <ul className="space-y-2">
                {[
                  {
                    etiqueta: "Compras netas (base afecta)",
                    monto: data.compras.comprasNetas,
                    detalle: "Monto sin IVA de los documentos considerados.",
                  },
                  {
                    etiqueta: "Más IVA crédito considerado",
                    monto: data.compras.ivaCredito,
                    detalle: "IVA de esas mismas compras, ya descontadas las notas de crédito.",
                  },
                  {
                    etiqueta: "Más compras exentas / sin IVA",
                    monto: data.compras.ivaNoRecuperableDetalle.comprasSinIva,
                    detalle: "Montos exentos o no afectos que igual son compra del mes.",
                  },
                  {
                    etiqueta: "Más otros montos del documento",
                    monto: otrosMontosCompras,
                    detalle:
                      "Impuestos específicos, adicionales o partidas informadas en el total del documento que no son neto, IVA ni exento.",
                  },
                  {
                    etiqueta: "Compras totales",
                    monto: data.compras.comprasTotales,
                    detalle: "Valor bruto de las compras consideradas en el periodo.",
                  },
                ].map((fila) => (
                  <li
                    key={fila.etiqueta}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{fila.etiqueta}</span>
                      <span className="block text-xs text-muted-foreground">
                        {fila.detalle}
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCLP(fila.monto)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Si las compras exentas aparecen en $0 es porque tus documentos del mes no
                informan montos exentos. Las{" "}
                {formatNumero(data.compras.documentosPendientes)} compras pendientes tampoco
                están incluidas: solo se suman cuando cambian de estado a registrada o
                aceptada.
              </p>
            </SectionCard>



            <SectionCard
              titulo="Cómo se calcula el IVA crédito considerado"
              descripcion="Estimación informativa. No reemplaza a tu contador."
            >
              <ul className="space-y-2">
                {[
                  {
                    etiqueta: "IVA de compras registradas y aceptadas",
                    monto:
                      data.compras.ivaCredito +
                      data.compras.ivaNoRecuperableDetalle.notasCreditoProveedores,
                    detalle: "Suma del IVA de los documentos que sí dan crédito.",
                  },
                  {
                    etiqueta: "Menos IVA de notas de crédito de proveedores",
                    monto: -data.compras.ivaNoRecuperableDetalle.notasCreditoProveedores,
                    detalle: "Devoluciones y descuentos que rebajan el crédito.",
                  },
                  {
                    etiqueta: "IVA crédito considerado",
                    monto: data.compras.ivaCredito,
                    detalle: "Resultado que se resta a tu IVA débito del mes.",
                  },
                ].map((fila) => (
                  <li
                    key={fila.etiqueta}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{fila.etiqueta}</span>
                      <span className="block text-xs text-muted-foreground">
                        {fila.detalle}
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCLP(fila.monto)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Fórmula: IVA de compras registradas y aceptadas − IVA de notas de crédito
                de proveedores. Quedan fuera las compras pendientes
                ({formatCLP(data.compras.ivaCreditoPotencial)}), las reclamadas y las
                marcadas como no incluir.
              </p>
            </SectionCard>

            <SectionCard
              titulo="Nota sobre el IVA no recuperable"
              descripcion="Estimación informativa. No reemplaza a tu contador."
            >
              <ul className="space-y-2">
                {[
                  {
                    etiqueta: "Notas de crédito de proveedores",
                    monto: data.compras.ivaNoRecuperableDetalle.notasCreditoProveedores,
                    detalle: "Rebajan el crédito de IVA ya considerado.",
                  },
                  {
                    etiqueta: "Compras reclamadas",
                    monto: data.compras.ivaNoRecuperableDetalle.reclamadas,
                    detalle: "Documentos rechazados ante el proveedor.",
                  },
                  {
                    etiqueta: "Marcadas como no incluir",
                    monto: data.compras.ivaNoRecuperableDetalle.noIncluidas,
                    detalle: "Gastos sin derecho a crédito fiscal.",
                  },
                  {
                    etiqueta: "Compras sin IVA (exentas o no afectas)",
                    monto: data.compras.ivaNoRecuperableDetalle.comprasSinIva,
                    detalle: "Monto exento; no genera crédito porque no tiene IVA.",
                  },
                ].map((fila) => (
                  <li
                    key={fila.etiqueta}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{fila.etiqueta}</span>
                      <span className="block text-xs text-muted-foreground">
                        {fila.detalle}
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCLP(fila.monto)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Las compras exentas se muestran aparte porque no llevan IVA, por lo que
                no forman parte del total de IVA no recuperable.
              </p>
            </SectionCard>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                titulo="Documentos registrados"
                monto={formatNumero(data.compras.documentosRegistrados)}
                descripcion="Compras incluidas en el cálculo."
              />
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


            
          </>
        )}
      </div>
    </AppShell>
  );
}
