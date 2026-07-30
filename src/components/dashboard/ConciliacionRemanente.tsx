import { useEffect, useState } from "react";
import { GitCompareArrows } from "lucide-react";

import {
  cloudTaxDataService,
  type ConciliacionRemanenteCloud,
} from "@/services/cloudTaxDataService";
import { formatCLP } from "@/utils/currency";

/**
 * Aviso de conciliación cuando el remanente que dejó el periodo anterior no
 * coincide con el remanente anterior declarado en el F29 del periodo actual.
 * Ningún valor se corrige automáticamente: se muestran ambos.
 */
export function ConciliacionRemanente({
  companyId,
  periodo,
}: {
  companyId: string | null;
  periodo: string;
}) {
  const [dato, setDato] = useState<ConciliacionRemanenteCloud | null>(null);

  useEffect(() => {
    let vigente = true;
    if (!companyId) {
      setDato(null);
      return;
    }
    cloudTaxDataService
      .getConciliacionRemanente(companyId, periodo)
      .then((r) => vigente && setDato(r))
      .catch(() => vigente && setDato(null));
    return () => {
      vigente = false;
    };
  }, [companyId, periodo]);

  if (!dato) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4">
      <GitCompareArrows className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-warning-foreground">
          Diferencia de remanente con el periodo anterior
        </p>
        <p className="text-sm text-warning-foreground/90">
          El periodo {dato.periodoAnterior} dejó un remanente de{" "}
          {formatCLP(dato.remanenteCalculadoPrevio)} y el Formulario 29 de este mes
          declara {formatCLP(dato.remanenteDeclarado)}. La diferencia es de{" "}
          {formatCLP(Math.abs(dato.diferencia))}.
        </p>
        <p className="text-xs text-warning-foreground/80">
          No modificamos ninguna de las dos cifras. Revisa esta diferencia con tu
          contador.
        </p>
      </div>
    </div>
  );
}
