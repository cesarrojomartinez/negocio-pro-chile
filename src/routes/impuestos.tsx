import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/shared/AppShell";
import { SectionCard } from "@/components/shared/SectionCard";
import { ResumenTributario } from "@/components/dashboard/ResumenTributario";
import { ComparacionCard } from "@/components/dashboard/ComparacionCard";
import { LoadingBlock } from "@/components/shared/States";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";
import { cn } from "@/lib/utils";

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

const CONFIABILIDAD = {
  alta: {
    titulo: "Confiabilidad alta",
    texto: "Los antecedentes demostrativos se encuentran actualizados.",
    clase: "border-success/30 bg-success-soft text-success",
  },
  media: {
    titulo: "Confiabilidad media",
    texto: "Existen compras pendientes o información parcialmente actualizada.",
    clase: "border-warning/40 bg-warning-soft text-warning-foreground",
  },
  baja: {
    titulo: "Confiabilidad baja",
    texto: "Faltan antecedentes importantes para realizar una estimación confiable.",
    clase: "border-destructive/30 bg-danger-soft text-destructive",
  },
  desconocida: {
    titulo: "Sin información suficiente",
    texto: "Todavía no hay datos suficientes en este periodo para estimar.",
    clase: "border-border bg-secondary/60 text-muted-foreground",
  },
} as const;

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
  const { data, cargando, margenPorcentaje, setMargenPorcentaje } = useTaxDashboard();

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
            <div
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-4",
                CONFIABILIDAD[data.confiabilidad].clase,
              )}
            >
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">
                  {CONFIABILIDAD[data.confiabilidad].titulo}
                </p>
                <p className="text-sm">{CONFIABILIDAD[data.confiabilidad].texto}</p>
                {data.razonesConfiabilidad.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                    {data.razonesConfiabilidad.map((razon) => (
                      <li key={razon}>{razon}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <ResumenTributario
              resumen={data.resumen}
              margenPorcentaje={margenPorcentaje}
              onCambiarMargen={setMargenPorcentaje}
            />

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

            <ComparacionCard comparacion={data.comparacion} resumen={data.resumen} />

            <p className="text-xs text-muted-foreground">
              Estimación informativa. No corresponde a una declaración oficial del
              SII.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
