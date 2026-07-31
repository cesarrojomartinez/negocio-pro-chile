import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";

import { useActualizacionMasiva } from "@/hooks/useActualizacionMasiva";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";
import { etiquetaPeriodo } from "@/lib/periodo";

/**
 * Aviso flotante del trabajo de actualización por periodos.
 * Sigue visible aunque la persona cambie de pantalla y solo desaparece
 * cuando se cierra con la equis.
 */
export function ProgresoActualizacion() {
  const {
    items,
    enCurso,
    terminado,
    visible,
    periodoActual,
    totales,
    cerrar,
    version,
    creditosUsados,
    creditosDisponibles,
  } = useActualizacionMasiva();
  const { refrescarDatos } = useTaxDashboard();
  const ultimaVersion = useRef(0);

  useEffect(() => {
    if (version === 0 || version === ultimaVersion.current) return;
    ultimaVersion.current = version;
    void refrescarDatos();
  }, [version, refrescarDatos]);

  if (!visible || items.length === 0) return null;

  const hechos = items.filter((i) => i.estado !== "pendiente" && i.estado !== "en_curso")
    .length;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 shadow-lg"
    >
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar aviso"
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>

      <div className="flex items-start gap-2 pr-6">
        {enCurso ? (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
        ) : totales.errores > 0 || totales.avisos > 0 ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
        )}
        <div>
          <p className="text-sm font-semibold text-foreground">
            {enCurso
              ? `Actualizando periodos (${hechos} de ${totales.total})`
              : "Listo: evaluación de periodos actualizados"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {enCurso && periodoActual
              ? `Trabajando en ${etiquetaPeriodo(periodoActual)}. Puedes seguir usando la aplicación.`
              : `${totales.listos} al día · ${totales.avisos} por revisar · ${totales.errores} con problema.`}
          </p>
        </div>
      </div>

      <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs">
        {items.map((i) => (
          <li key={i.periodo} className="flex items-center justify-between gap-2">
            <span className="text-foreground">{etiquetaPeriodo(i.periodo)}</span>
            <span
              className={
                i.estado === "listo"
                  ? "text-success"
                  : i.estado === "aviso"
                    ? "text-warning"
                    : i.estado === "error"
                      ? "text-destructive"
                      : "text-muted-foreground"
              }
            >
              {i.estado === "listo"
                ? "Actualizado"
                : i.estado === "aviso"
                  ? "Revisar"
                  : i.estado === "error"
                    ? "Con problema"
                    : i.estado === "en_curso"
                      ? "En curso"
                      : "En espera"}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
        Créditos usados en esta actualización:{" "}
        <span className="font-semibold text-foreground">
          {creditosUsados.toLocaleString("es-CL", { maximumFractionDigits: 2 })}
        </span>
        {creditosDisponibles != null && (
          <>
            {" · Créditos disponibles: "}
            <span className="font-semibold text-foreground">
              {creditosDisponibles.toLocaleString("es-CL", { maximumFractionDigits: 2 })}
            </span>
          </>
        )}
      </p>

      {terminado && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Estimación informativa: no reemplaza a tu contador.
        </p>
      )}
    </div>
  );
}
