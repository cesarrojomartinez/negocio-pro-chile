import { FlaskConical } from "lucide-react";
import { AVISO_DATOS_SIMULADOS } from "@/integrations/sii/contracts";
import { cn } from "@/lib/utils";

/**
 * Etiqueta obligatoria en toda pantalla que muestre información proveniente
 * del proveedor simulado.
 */
export function SimulatedDataNotice({
  className,
  compacto = false,
}: {
  className?: string;
  compacto?: boolean;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs font-medium text-warning-foreground",
        className,
      )}
      role="note"
    >
      <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {AVISO_DATOS_SIMULADOS}
        {!compacto && " Esta información no reemplaza a tu contador."}
      </span>
    </p>
  );
}
