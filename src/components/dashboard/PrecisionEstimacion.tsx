import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Target } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/shared/SectionCard";
import {
  obtenerPrecisionEstimacionFn,
  recalcularHistorialFn,
} from "@/lib/f29Precision.functions";
import type { ResumenPrecision } from "@/lib/f29Precision";
import { formatCLP } from "@/utils/currency";

function signo(valor: number): string {
  return valor > 0 ? "+" : "";
}

function etiquetaPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split("-");
  const meses = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const indice = Number(mes) - 1;
  return meses[indice] ? `${meses[indice]} ${anio}` : periodo;
}

/**
 * Precisión histórica: cuánto se desvió la estimación de la app respecto del
 * Formulario 29 que finalmente se declaró. Solo informa, no corrige nada.
 */
export function PrecisionEstimacion({ companyId }: { companyId: string | null }) {
  const [datos, setDatos] = useState<ResumenPrecision | null>(null);
  const [recalculando, setRecalculando] = useState(false);

  const cargar = useCallback(async () => {
    if (!companyId) {
      setDatos(null);
      return;
    }
    try {
      const r = await obtenerPrecisionEstimacionFn({ data: { companyId } });
      setDatos(r.ok ? r.data : null);
    } catch {
      setDatos(null);
    }
  }, [companyId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function recalcular() {
    if (!companyId || recalculando) return;
    setRecalculando(true);
    try {
      const r = await recalcularHistorialFn({ data: { companyId } });
      if (r.ok) {
        toast.success(
          `Historial recalculado: ${r.data.recalculados.length} meses actualizados.`,
        );
      } else {
        toast.error("No pudimos recalcular el historial.");
      }
      await cargar();
    } catch {
      toast.error("No pudimos recalcular el historial.");
    } finally {
      setRecalculando(false);
    }
  }

  if (!datos || datos.filas.length === 0) return null;

  const hayReconstruidas = datos.filas.some((f) => f.origen === "reconstruida");

  return (
    <SectionCard
      titulo="Precisión de la estimación"
      descripcion="Comparación entre lo que estimó esta app y el Formulario 29 finalmente declarado."
    >
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          onClick={recalcular}
          disabled={recalculando}
        >
          <RefreshCw
            className={`size-4 ${recalculando ? "animate-spin" : ""}`}
            aria-hidden
          />
          {recalculando
            ? "Recalculando historial…"
            : "Recalcular con el motor actual"}
        </Button>

        <div className="flex items-start gap-3 rounded-xl bg-secondary p-3.5">
          <Target className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="space-y-0.5">
            {datos.suficiente && datos.promedioAbsoluto != null ? (
              <>
                <p className="text-sm font-semibold">
                  En los últimos {datos.muestras} meses la estimación se desvió en
                  promedio {datos.promedioAbsoluto}%
                </p>
                <p className="text-sm text-muted-foreground">
                  El mejor mes se desvió {datos.mejor}% y el peor {datos.peor}%.
                  {datos.promedioConSigno != null && datos.promedioConSigno < 0
                    ? " En promedio la app estima por debajo del F29, así que conviene reservar un poco más."
                    : " En promedio la app estima por sobre el F29, lo que deja margen a favor."}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">
                  Aún no hay historial suficiente
                </p>
                <p className="text-sm text-muted-foreground">
                  Se necesitan al menos 3 meses con Formulario 29 declarado para
                  entregar un porcentaje de precisión confiable. Por ahora hay{" "}
                  {datos.muestras}.
                </p>
              </>
            )}
          </div>
        </div>

        <ul className="space-y-2">
          {datos.filas.map((fila) => (
            <li
              key={fila.periodo}
              className="rounded-xl border border-border p-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold capitalize">
                  {etiquetaPeriodo(fila.periodo)}
                </span>
                <span
                  className={
                    fila.porcentaje == null
                      ? "text-muted-foreground"
                      : Math.abs(fila.porcentaje) <= 5
                        ? "font-semibold text-success"
                        : "font-semibold text-warning-foreground"
                  }
                >
                  {fila.porcentaje == null
                    ? "Sin porcentaje"
                    : `${signo(fila.porcentaje)}${fila.porcentaje}%`}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">
                Estimado {formatCLP(fila.estimado)} · F29 {formatCLP(fila.oficial)} ·
                diferencia {signo(fila.diferencia)}
                {formatCLP(fila.diferencia)}
              </p>
              {fila.origen === "reconstruida" ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Valor reconstruido desde los componentes guardados; es una
                  aproximación.
                </p>
              ) : null}
            </li>
          ))}
        </ul>

        {hayReconstruidas ? (
          <p className="text-xs text-muted-foreground">
            Los meses marcados como reconstruidos se calcularon antes de que la app
            comenzara a guardar la estimación previa al F29. Las próximas mediciones
            serán exactas.
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
