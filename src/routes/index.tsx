import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

import { AppShell } from "@/components/shared/AppShell";
import { ScenarioSwitcher } from "@/components/shared/ScenarioSwitcher";
import { ErrorState, LoadingBlock, LoadingCards } from "@/components/shared/States";
import { TarjetaMes } from "@/components/dashboard/TarjetaMes";
import { IndicadoresGrid } from "@/components/dashboard/IndicadoresGrid";
import { ResumenTributario } from "@/components/dashboard/ResumenTributario";

import { MetaCard } from "@/components/goals/MetaCard";
import { ProyeccionCard } from "@/components/projections/ProyeccionCard";
import { SimuladorVentas } from "@/components/projections/SimuladorVentas";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { EMPRESA_DEMO, PERIODOS } from "@/data/mockTaxData";
import { etiquetaPeriodo } from "@/lib/periodo";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mi Negocio al Día | Panel del mes" },
      {
        name: "description",
        content:
          "Revisa tus ventas, tu IVA estimado y la reserva recomendada del mes en un panel simple para microempresarios chilenos.",
      },
      { property: "og:title", content: "Mi Negocio al Día | Panel del mes" },
      {
        property: "og:description",
        content:
          "Controla tus ventas, anticipa tus impuestos y toma mejores decisiones durante el mes.",
      },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const {
    data,
    cargando,
    error,
    margenPorcentaje,
    tasaPpmPersonalizada,
    setTasaPpmPersonalizada,
    setMargenPorcentaje,
    setDineroReservado,
    setMetaMensual,
    periodoId,
    actualizar,
  } = useTaxDashboard();
  const { perfil } = useAuth();
  const { modo, empresaActiva } = useCompany();

  const etiquetaPeriodoActual =
    PERIODOS.find((p) => p.id === periodoId)?.etiqueta ?? etiquetaPeriodo(periodoId);


  const nombreSaludo =
    modo === "cloud"
      ? (perfil?.first_name ?? perfil?.display_name ?? "").trim()
      : "Camila";
  const nombreEmpresa =
    modo === "cloud"
      ? (empresaActiva?.nombreFantasia ?? empresaActiva?.razonSocial ?? "tu empresa")
      : EMPRESA_DEMO.razonSocial;

  return (
    <AppShell>
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {nombreSaludo ? `Hola, ${nombreSaludo}` : "Hola"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Así va {nombreEmpresa} en {etiquetaPeriodoActual}.
          </p>
        </header>


        {error && <ErrorState mensaje={error} onReintentar={() => void actualizar()} />}

        {cargando || !data ? (
          <>
            <LoadingBlock alto="h-72" />
            <LoadingCards />
            <LoadingBlock alto="h-80" />
          </>
        ) : (
          <>
            <TarjetaMes
              resumen={data.resumen}
              contexto={data.contexto}
              fuentePeriodo={data.fuentePeriodo}
              onGuardarReservado={setDineroReservado}
            />

            <IndicadoresGrid
              resumen={data.resumen}
              ventas={data.ventas}
              comparacion={data.comparacion}
            />

            <div className="grid gap-5 xl:grid-cols-2">
              <ResumenTributario
                resumen={data.resumen}
                margenPorcentaje={margenPorcentaje}
                onCambiarMargen={setMargenPorcentaje}
                tasaPpmPersonalizada={tasaPpmPersonalizada}
                onCambiarTasaPpm={setTasaPpmPersonalizada}
                fuentePeriodo={data.fuentePeriodo}
                conciliacion={data.conciliacionF29}
              />
              <div className="space-y-5">
                <MetaCard meta={data.meta} onGuardarMeta={setMetaMensual} />
                <ProyeccionCard proyeccion={data.proyeccion} />
              </div>
            </div>

            <SimuladorVentas
              tasaPpm={
                data.resumen.ventasTotales > 0
                  ? data.resumen.ppmEstimado / (data.resumen.ventasTotales / 1.19)
                  : 0.006
              }
              margenPorcentaje={margenPorcentaje}
            />

            

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link to="/ventas">Ver ventas</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/compras">Ver compras</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/impuestos">Ver detalle tributario</Link>
              </Button>
            </div>

            {modo !== "cloud" && <ScenarioSwitcher />}
          </>
        )}
      </div>
    </AppShell>
  );
}
