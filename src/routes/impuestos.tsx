import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/shared/AppShell";
import { SectionCard } from "@/components/shared/SectionCard";
import { ResumenTributario } from "@/components/dashboard/ResumenTributario";
import { AuditoriaMontos } from "@/components/dashboard/AuditoriaMontos";
import { EstadoCalculo } from "@/components/dashboard/EstadoCalculo";
import { ConciliacionRemanente } from "@/components/dashboard/ConciliacionRemanente";
import { PrecisionEstimacion } from "@/components/dashboard/PrecisionEstimacion";

import { F29OficialPanel } from "@/components/sii/F29OficialPanel";


import { LoadingBlock } from "@/components/shared/States";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";


export const Route = createFileRoute("/impuestos")({
  head: () => ({
    meta: [
      { title: "Estimación tributaria | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "IVA débito, crédito, remanente, PPM y retenciones estimadas del mes, con nivel de confiabilidad de la información.",
      },
      { property: "og:title", content: "Estimación tributaria | Mi Negocio al Día" },
      {
        property: "og:description",
        content:
          "Estimación informativa de IVA, PPM y retenciones. No reemplaza a tu contador.",
      },
    ],
  }),
  component: Impuestos,
});

const FACTORES = [
  "Compras pendientes.",
  "Notas de crédito.",
  "Remanentes.",
  "Retenciones especiales.",
  "Cambios de tasa de PPM.",
  "Operaciones tributarias especiales.",
  "Ajustes del contador.",
];

function Impuestos() {
  const {
    data,
    cargando,
    margenPorcentaje,
    tasaPpmPersonalizada,
    setTasaPpmPersonalizada,
    setMargenPorcentaje,
    modo,
    companyId,
    periodoId,
    refrescarDatos,
  } = useTaxDashboard();



  return (
    <AppShell>
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Impuestos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estimación al día de hoy. Revisa este resultado con tu contador.
          </p>
        </header>

        {cargando || !data ? (
          <>
            <LoadingBlock alto="h-96" />
            <LoadingBlock alto="h-64" />
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success-soft p-4 text-success">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">Información orientativa</p>
                <p className="text-sm">
                  Ante cualquier duda, consulta a tu contador.
                </p>
              </div>
            </div>

            <EstadoCalculo contexto={data.contexto} />
            <ConciliacionRemanente companyId={companyId} periodo={periodoId} />
            <F29OficialPanel
              companyId={companyId}
              periodo={periodoId}
              onCambio={refrescarDatos}
            />




            <ResumenTributario
              resumen={data.resumen}
              margenPorcentaje={margenPorcentaje}
              onCambiarMargen={setMargenPorcentaje}
              tasaPpmPersonalizada={tasaPpmPersonalizada}
              onCambiarTasaPpm={setTasaPpmPersonalizada}
              fuentePeriodo={data.fuentePeriodo}
              conciliacion={data.conciliacionF29}
            />

            <AuditoriaMontos data={data} />


            <SectionCard
              titulo="Qué puede modificar este cálculo"
              descripcion="Factores que suelen cambiar el resultado antes del cierre del periodo."
            >
              <ul className="grid gap-2 sm:grid-cols-2">
                {FACTORES.map((f) => (
                  <li
                    key={f}
                    className="rounded-xl bg-secondary px-3 py-2.5 text-sm"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            </SectionCard>

            

            <p className="text-xs text-muted-foreground">
              Estimación informativa. El resultado definitivo debe ser confirmado
              por tu contador.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
