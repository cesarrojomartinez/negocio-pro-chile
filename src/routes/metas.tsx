import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shared/AppShell";
import { SectionCard } from "@/components/shared/SectionCard";
import { MetaCard } from "@/components/goals/MetaCard";
import { ProyeccionCard } from "@/components/projections/ProyeccionCard";
import { SimuladorVentas } from "@/components/projections/SimuladorVentas";
import { MargenSelector } from "@/components/dashboard/MargenSelector";
import { LoadingBlock } from "@/components/shared/States";
import { Progress } from "@/components/ui/progress";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";
import { HISTORIAL_METAS } from "@/data/mockTaxData";
import { formatCLP, formatFecha, formatPorcentaje } from "@/utils/currency";

export const Route = createFileRoute("/metas")({
  head: () => ({
    meta: [
      { title: "Meta de ventas | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Sigue tu meta mensual de ventas, tu proyección de cierre y el promedio diario necesario para lograrla.",
      },
      { property: "og:title", content: "Meta de ventas | Mi Negocio al Día" },
      {
        property: "og:description",
        content: "Cumplimiento, proyección de cierre e historial de metas.",
      },
    ],
  }),
  component: Metas,
});

function Metas() {
  const { data, cargando, margenPorcentaje, setMargenPorcentaje, setMetaMensual } =
    useTaxDashboard();

  return (
    <AppShell>
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Metas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define tu meta mensual y revisa cómo vas respecto del ritmo necesario.
          </p>
        </header>

        {cargando || !data ? (
          <>
            <LoadingBlock alto="h-96" />
            <LoadingBlock alto="h-64" />
          </>
        ) : (
          <>
            <div className="grid gap-5 xl:grid-cols-2">
              <MetaCard meta={data.meta} onGuardarMeta={setMetaMensual} />
              <div className="space-y-5">
                <ProyeccionCard proyeccion={data.proyeccion} />
                <SectionCard titulo="Margen preventivo">
                  <MargenSelector
                    valor={margenPorcentaje}
                    onCambiar={setMargenPorcentaje}
                  />
                </SectionCard>
              </div>
            </div>

            <SectionCard
              titulo="Mejores momentos del mes"
              descripcion="Días y semanas con mayor venta registrada."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">Mejor día</p>
                  <p className="num-md mt-1 text-lg">
                    {data.comparacion.mejorDia
                      ? formatCLP(data.comparacion.mejorDia.monto)
                      : "Sin ventas"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.comparacion.mejorDia
                      ? formatFecha(data.comparacion.mejorDia.fecha)
                      : "Aún no hay ventas registradas."}
                  </p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">Mejor semana</p>
                  <p className="num-md mt-1 text-lg">
                    {data.comparacion.mejorSemana
                      ? formatCLP(data.comparacion.mejorSemana.monto)
                      : "Sin ventas"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.comparacion.mejorSemana?.etiqueta ??
                      "Aún no hay ventas registradas."}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              titulo="Historial de metas"
              descripcion="Comparación con meses anteriores (datos demostrativos)."
            >
              <ul className="space-y-3">
                {HISTORIAL_METAS.map((h) => {
                  const pct = Math.round((h.logrado / h.meta) * 1000) / 10;
                  return (
                    <li key={h.periodo} className="rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold">{h.periodo}</p>
                        <p className="text-sm tabular-nums">
                          {formatCLP(h.logrado)} de {formatCLP(h.meta)}
                        </p>
                      </div>
                      <Progress
                        value={Math.min(100, pct)}
                        className="mt-2"
                        aria-label={`Cumplimiento de ${h.periodo}`}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cumplimiento: {formatPorcentaje(pct)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>

            <SimuladorVentas
              tasaPpm={
                data.resumen.ventasTotales > 0
                  ? data.resumen.ppmEstimado / (data.resumen.ventasTotales / 1.19)
                  : 0.006
              }
              margenPorcentaje={margenPorcentaje}
            />

            <p className="text-xs text-muted-foreground">
              En esta demostración no es posible editar ventas, compras ni
              información tributaria.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
