/**
 * Piezas reutilizables del Panel Master.
 *
 * Solo presentación: no consulta al SII, no calcula impuestos y no expone
 * credenciales. Todas las tablas se apilan en móvil (nunca scroll horizontal).
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Download, Loader2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { aCsv } from "@/lib/master";

export type Tono = "default" | "success" | "warning" | "danger" | "primary";

const CLASE_TONO: Record<Tono, string> = {
  default: "bg-secondary text-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-foreground",
  danger: "bg-destructive/10 text-destructive",
  primary: "bg-info-soft text-primary",
};

export function MetricaMaster({
  label,
  valor,
  hint,
  tono = "default",
}: {
  label: string;
  valor: string | number;
  hint?: string;
  tono?: Tono;
}) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-lg font-bold tabular-nums",
          tono === "danger" && "text-destructive",
          tono === "success" && "text-success",
          tono === "warning" && "text-warning-foreground",
          tono === "primary" && "text-primary",
        )}
      >
        {valor}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EtiquetaEstado({ texto, tono = "default" }: { texto: string; tono?: Tono }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        CLASE_TONO[tono],
      )}
    >
      {texto}
    </span>
  );
}

export interface FilaMaster {
  clave: string;
  celdas: ReactNode[];
}

/** Tabla en escritorio, tarjetas apiladas en móvil. */
export function TablaMaster({
  cabeceras,
  filas,
  vacio = "No hay información para mostrar.",
}: {
  cabeceras: string[];
  filas: FilaMaster[];
  vacio?: string;
}) {
  if (filas.length === 0)
    return <p className="text-sm text-muted-foreground">{vacio}</p>;

  return (
    <>
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              {cabeceras.map((c) => (
                <th key={c} className="py-2 pr-3 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave} className="border-b border-border/70 last:border-0">
                {f.celdas.map((celda, i) => (
                  <td key={i} className="py-2.5 pr-3 align-top">
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {filas.map((f) => (
          <li key={f.clave} className="rounded-xl border border-border p-3">
            {f.celdas.map((celda, i) => (
              <div
                key={i}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border/60 py-1.5 last:border-0"
              >
                <span className="text-xs text-muted-foreground">{cabeceras[i]}</span>
                <span className="text-sm">{celda}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Mini gráfico de barras sin dependencias externas. */
export function SerieBarras({
  datos,
  formato = (v) => String(v),
}: {
  datos: { etiqueta: string; valor: number }[];
  formato?: (valor: number) => string;
}) {
  const maximo = Math.max(1, ...datos.map((d) => d.valor));
  return (
    <ul className="space-y-2">
      {datos.map((d) => (
        <li key={d.etiqueta} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-xs text-muted-foreground">{d.etiqueta}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${Math.round((d.valor / maximo) * 100)}%` }}
            />
          </span>
          <span className="w-28 shrink-0 text-right text-xs font-semibold tabular-nums">
            {formato(d.valor)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function BotonCsv({
  nombre,
  cabeceras,
  filas,
}: {
  nombre: string;
  cabeceras: string[];
  filas: (string | number | null)[][];
}) {
  const descargar = () => {
    const csv = aCsv(cabeceras, filas);
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nombre}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button variant="outline" size="sm" onClick={descargar}>
      <Download className="h-4 w-4" aria-hidden />
      Exportar CSV
    </Button>
  );
}

export function CargandoMaster({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {texto}
    </p>
  );
}

export function ErrorMaster({ mensaje }: { mensaje: string }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {mensaje}
    </p>
  );
}

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

/** Carga un recurso del panel y expone estado, error y recarga. */
export function useRecursoMaster<T>(cargador: () => Promise<Resultado<T>>) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await cargador();
      if (r.ok) {
        setDatos(r.data);
        setError(null);
      } else setError(r.error);
    } catch {
      setError("No pudimos cargar esta sección. Intenta nuevamente.");
    } finally {
      setCargando(false);
    }
    // El cargador se recrea en cada render de la página; se controla por módulo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { datos, error, cargando, recargar };
}
