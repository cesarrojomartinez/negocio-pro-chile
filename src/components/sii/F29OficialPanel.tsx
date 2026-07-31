import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";

import { DataRow, SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { f29PdfService } from "@/services/f29PdfService";
import { cloudTaxDataService } from "@/services/cloudTaxDataService";
import type { AntecedenteF29 } from "@/lib/f29Antecedent";

import type { ExtraccionF29 } from "@/lib/f29PdfExtraction.server";
import { formatCLP } from "@/utils/currency";

const CAMPOS_VISIBLES: { clave: string; etiqueta: string; tipo: "money" | "rate" }[] = [
  { clave: "declared_vat_debit", etiqueta: "IVA débito", tipo: "money" },
  { clave: "declared_vat_credit", etiqueta: "IVA crédito", tipo: "money" },
  { clave: "declared_previous_carryforward", etiqueta: "Remanente anterior", tipo: "money" },
  { clave: "declared_vat_payable", etiqueta: "IVA determinado", tipo: "money" },
  { clave: "declared_new_carryforward", etiqueta: "Nuevo remanente", tipo: "money" },
  { clave: "declared_ppm_base", etiqueta: "Base para el PPM", tipo: "money" },
  { clave: "declared_ppm_rate", etiqueta: "Tasa de PPM", tipo: "rate" },
  { clave: "declared_ppm", etiqueta: "PPM", tipo: "money" },
  { clave: "declared_withholdings", etiqueta: "Retenciones", tipo: "money" },
  { clave: "declared_other_taxes", etiqueta: "Otros impuestos", tipo: "money" },
  { clave: "declared_total_payable", etiqueta: "Total declarado", tipo: "money" },
];

function valorFormateado(valor: unknown, tipo: "money" | "rate"): string | null {
  if (valor == null || typeof valor !== "number" || !Number.isFinite(valor)) return null;
  if (tipo === "rate") return `${(valor * 100).toFixed(2).replace(".", ",")}%`;
  return formatCLP(valor);
}

/**
 * Resultado del Formulario 29 oficial del periodo.
 *
 * No pide claves ni ejecuta consultas: el formulario se descarga y se lee solo
 * cuando la persona actualiza el periodo. Aquí únicamente se muestra el
 * resultado y se ofrece ver el documento guardado.
 */
export function F29OficialPanel({
  companyId,
  periodo,
}: {
  companyId: string | null;
  periodo: string;
  onCambio?: () => void;
}) {
  const [extraccion, setExtraccion] = useState<ExtraccionF29 | null>(null);
  const [antecedente, setAntecedente] = useState<{
    antecedente: AntecedenteF29;
    folio: string | null;
  } | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    if (!companyId) return;
    setCargando(true);
    try {
      setExtraccion(await f29PdfService.obtener(companyId, periodo));
    } catch {
      setExtraccion(null);
    }
    try {
      setAntecedente(await cloudTaxDataService.getAntecedenteF29(companyId, periodo));
    } catch {
      setAntecedente(null);
    } finally {
      setCargando(false);
    }
  }, [companyId, periodo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);


  if (!companyId) return null;

  async function verPdf() {
    if (!companyId) return;
    try {
      const url = await f29PdfService.urlFirmada(companyId, periodo);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No pudimos abrir el formulario.",
      );
    }
  }

  const leidoPdf = extraccion && extraccion.estadoExtraccion !== "failed";
  // Cuando no hay lectura del PDF, se usan las cifras del F29 ya guardado
  // (confirmado por el contador) para no decir que el periodo no tiene F29.
  const campos: { clave: string; etiqueta: string; texto: string }[] = [];
  const a = antecedente?.antecedente;
  if (leidoPdf && extraccion) {
    for (const campo of CAMPOS_VISIBLES) {
      const texto = valorFormateado(
        (extraccion.campos as unknown as Record<string, unknown>)[campo.clave],
        campo.tipo,
      );
      if (texto) campos.push({ ...campo, texto });
    }
  } else if (a) {
    const desde: [string, string, number | null, "money" | "rate"][] = [
      ["debito", "IVA débito", a.ivaDebitoDeclarado, "money"],
      ["credito", "IVA crédito", a.ivaCreditoDeclarado, "money"],
      ["remAnterior", "Remanente anterior", a.remanenteAnterior, "money"],
      ["iva", "IVA determinado", a.ivaDeclarado, "money"],
      ["remNuevo", "Nuevo remanente", a.nuevoRemanenteDeclarado, "money"],
      ["basePpm", "Base para el PPM", a.basePpmDeclarada, "money"],
      ["tasaPpm", "Tasa de PPM", a.tasaPpm, "rate"],
      ["ppm", "PPM", a.ppmDeclarado, "money"],
      ["retenciones", "Retenciones", a.retenciones, "money"],
      ["total", "Total declarado", a.totalDeclarado, "money"],
    ];
    for (const [clave, etiqueta, valor, tipo] of desde) {
      const texto = valorFormateado(valor, tipo);
      if (texto) campos.push({ clave, etiqueta, texto });
    }
  }
  const leido = campos.length > 0;
  const folio = extraccion?.folio ?? antecedente?.folio ?? null;

  return (
    <SectionCard
      titulo="Formulario 29 del periodo"
      descripcion={
        leido
          ? "Resultado confirmado según Formulario 29 oficial."
          : "Estimación del periodo en curso. El resultado definitivo estará disponible cuando se presente el F29."
      }
      acciones={
        extraccion?.archivoGuardado ? (
          <Button type="button" variant="outline" size="sm" onClick={verPdf}>
            <FileText className="mr-2 h-4 w-4" aria-hidden />
            Ver F29 oficial
          </Button>
        ) : undefined
      }
    >
      {cargando ? (
        <p className="text-sm text-muted-foreground">Revisando este periodo…</p>
      ) : leido ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success-soft p-3 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Resultado confirmado según Formulario 29 oficial
            {folio ? ` · Folio ${folio}` : ""}.
          </p>
          <div className="rounded-2xl bg-secondary/60 p-4">
            {campos.map((campo) => (
              <DataRow key={campo.clave} label={campo.etiqueta} value={campo.texto} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Este periodo todavía no tiene un Formulario 29 presentado. Al actualizar, la
          aplicación lo buscará sola y completará las cifras cuando exista.
        </p>
      )}


      <p className="mt-3 text-xs text-muted-foreground">
        Estimación informativa: no reemplaza a tu contador.
      </p>
    </SectionCard>
  );
}
