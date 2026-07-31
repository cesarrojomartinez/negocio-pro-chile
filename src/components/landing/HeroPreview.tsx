import { BellRing, CheckCircle2, ShieldCheck } from "lucide-react";

/**
 * Vista referencial del panel: cifras ilustrativas, sin consultas al SII
 * ni al proveedor. Solo presentación para la landing pública.
 */
export function HeroPreview() {
  const barras = [
    { ventas: 70, compras: 42 },
    { ventas: 82, compras: 50 },
    { ventas: 58, compras: 38 },
    { ventas: 90, compras: 55 },
  ];

  return (
    <div
      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
      aria-label="Vista referencial del panel mensual"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <p className="truncate text-sm font-bold">Resumen mensual</p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground">
            Mayo
          </span>
          <BellRing className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Celda titulo="Ventas del mes" valor="$12.850.000" pie="+14% vs. abril" />
        <Celda titulo="Compras del mes" valor="$6.420.000" pie="+12% vs. abril" />
        <Celda titulo="IVA estimado" valor="$2.441.500" pie="Estimación informativa" />
        <Celda titulo="Reserva sugerida" valor="$2.650.000" pie="Para este impuesto" />
      </div>

      <div className="mt-3 flex items-start gap-3 rounded-xl bg-success/10 p-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Tu estado del mes</p>
          <p className="text-sm font-bold">Al día</p>
          <p className="text-xs text-muted-foreground">
            Sin pendientes según la información cargada.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 rounded-xl border border-border p-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Comparativo últimos meses</p>
          <p className="truncate text-sm font-semibold">Ventas y compras</p>
        </div>
        <div className="flex h-14 items-end gap-1.5" aria-hidden>
          {barras.map((b, i) => (
            <span key={i} className="flex h-full items-end gap-0.5">
              <span
                className="w-2.5 rounded-t bg-primary"
                style={{ height: `${b.ventas}%` }}
              />
              <span
                className="w-2.5 rounded-t bg-success"
                style={{ height: `${b.compras}%` }}
              />
            </span>
          ))}
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Cifras de ejemplo. Estimación informativa, no reemplaza a tu contador.
      </p>
    </div>
  );
}

function Celda({
  titulo,
  valor,
  pie,
}: {
  titulo: string;
  valor: string;
  pie: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border p-3">
      <p className="truncate text-[11px] text-muted-foreground">{titulo}</p>
      <p className="truncate text-base font-bold tabular-nums">{valor}</p>
      <p className="truncate text-[11px] text-muted-foreground">{pie}</p>
    </div>
  );
}
