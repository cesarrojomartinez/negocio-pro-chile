import { cn } from "@/lib/utils";
import { formatVariacion } from "@/utils/currency";

interface Props {
  variacion: number | null;
  /** Cuando es false, un alza no se interpreta como algo positivo. */
  interpretarComoPositivo?: boolean;
  className?: string;
}

export function VariationPill({
  variacion,
  interpretarComoPositivo = true,
  className,
}: Props) {
  const texto = formatVariacion(variacion);
  const neutro =
    variacion === null || Math.abs(variacion) < 0.05 || !interpretarComoPositivo;
  const positivo = variacion !== null && variacion > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        neutro
          ? "bg-muted text-muted-foreground"
          : positivo
            ? "bg-success-soft text-success"
            : "bg-danger-soft text-destructive",
        className,
      )}
    >
      {texto}
      <span className="sr-only"> respecto del mes anterior</span>
    </span>
  );
}
