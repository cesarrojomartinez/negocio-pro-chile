import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileDown, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { DataRow, SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { esRutValido, formatearRut } from "@/lib/rut";
import { f29PdfService } from "@/services/f29PdfService";
import type { ExtraccionF29, ResultadoExtraccionF29 } from "@/lib/f29PdfExtraction.server";
import { formatCLP } from "@/utils/currency";
import { cn } from "@/lib/utils";

const ETIQUETA_ESTADO: Record<string, { texto: string; clase: string }> = {
  success: { texto: "Lectura completa", clase: "border-success/30 bg-success-soft text-success" },
  needs_review: {
    texto: "Requiere revisión",
    clase: "border-warning/40 bg-warning-soft text-warning-foreground",
  },
  partial: {
    texto: "Lectura parcial",
    clase: "border-warning/40 bg-warning-soft text-warning-foreground",
  },
  failed: { texto: "No se pudo leer", clase: "border-destructive/30 bg-danger-soft text-destructive" },
  ambiguous_declaration: {
    texto: "Declaración por confirmar",
    clase: "border-warning/40 bg-warning-soft text-warning-foreground",
  },
  pending: { texto: "Pendiente", clase: "border-border bg-secondary/60 text-muted-foreground" },
};

const CAMPOS_VISIBLES: { clave: string; etiqueta: string; tipo: "money" | "rate" }[] = [
  { clave: "declared_vat_debit", etiqueta: "IVA débito declarado", tipo: "money" },
  { clave: "declared_vat_credit", etiqueta: "IVA crédito declarado", tipo: "money" },
  { clave: "declared_previous_carryforward", etiqueta: "Remanente anterior", tipo: "money" },
  { clave: "declared_new_carryforward", etiqueta: "Nuevo remanente", tipo: "money" },
  { clave: "declared_vat_payable", etiqueta: "IVA determinado", tipo: "money" },
  { clave: "declared_ppm_base", etiqueta: "Base imponible PPM", tipo: "money" },
  { clave: "declared_ppm_rate", etiqueta: "Tasa de PPM", tipo: "rate" },
  { clave: "declared_ppm", etiqueta: "PPM declarado", tipo: "money" },
  { clave: "declared_withholdings", etiqueta: "Retenciones declaradas", tipo: "money" },
  { clave: "declared_total_payable", etiqueta: "Total a pagar declarado", tipo: "money" },
];

function valorFormateado(valor: unknown, tipo: "money" | "rate"): string | null {
  if (valor == null || typeof valor !== "number" || !Number.isFinite(valor)) return null;
  if (tipo === "rate") return `${(valor * 100).toFixed(2).replace(".", ",")}%`;
  return formatCLP(valor);
}

export function F29OficialPanel({
  companyId,
  periodo,
  onCambio,
}: {
  companyId: string | null;
  periodo: string;
  onCambio?: () => void;
}) {
  const [extraccion, setExtraccion] = useState<ExtraccionF29 | null>(null);
  const [resultado, setResultado] = useState<ResultadoExtraccionF29 | null>(null);
  const [cargando, setCargando] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [rutUsuario, setRutUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [folioConfirmado, setFolioConfirmado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!companyId) return;
    setCargando(true);
    try {
      setExtraccion(await f29PdfService.obtener(companyId, periodo));
    } catch {
      setExtraccion(null);
    } finally {
      setCargando(false);
    }
  }, [companyId, periodo]);

  useEffect(() => {
    void cargar();
    setResultado(null);
    setFolioConfirmado(null);
  }, [cargar]);

  const declaracionesAmbiguas = useMemo(
    () => (resultado?.errorCodigo === "F29_MULTIPLE_DECLARATIONS" ? resultado.declaraciones : []),
    [resultado],
  );

  if (!companyId) return null;

  async function descargar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!companyId) return;
    if (!esRutValido(rutUsuario)) {
      toast.error("Revisa el RUT del usuario autorizado.");
      return;
    }
    if (clave.length < 4) {
      toast.error("Ingresa tu Clave Tributaria para continuar.");
      return;
    }

    setEjecutando(true);
    try {
      const r = await f29PdfService.extraer({
        companyId,
        periodo,
        rutUsuario: formatearRut(rutUsuario),
        claveTributaria: clave,
        folioConfirmado,
      });
      setResultado(r);
      if (r.extraccion) setExtraccion(r.extraccion);
      if (r.errorCodigo) toast.warning(r.mensaje);
      else toast.success(r.mensaje);
      if (r.recalculado) onCambio?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos completar la descarga.");
    } finally {
      // La clave nunca queda en memoria después de la operación.
      setClave("");
      setEjecutando(false);
    }
  }

  async function verPdf() {
    if (!companyId) return;
    try {
      const url = await f29PdfService.urlFirmada(companyId, periodo);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos abrir el formulario.");
    }
  }

  const estado = extraccion ? (ETIQUETA_ESTADO[extraccion.estadoExtraccion] ?? ETIQUETA_ESTADO.pending) : null;

  return (
    <SectionCard
      titulo="Formulario 29 oficial del SII"
      descripcion="Descarga el formulario compacto declarado y lee sus códigos directamente desde el documento oficial."
      acciones={
        extraccion?.archivoGuardado ? (
          <Button type="button" variant="outline" size="sm" onClick={verPdf}>
            <FileText className="mr-2 h-4 w-4" aria-hidden />
            Ver formulario
          </Button>
        ) : undefined
      }
    >
      {cargando ? (
        <p className="text-sm text-muted-foreground">Revisando si este periodo ya tiene formulario…</p>
      ) : extraccion && estado ? (
        <div className="space-y-4">
          <div className={cn("flex flex-wrap items-center gap-2 rounded-2xl border p-3 text-sm", estado.clase)}>
            {extraccion.estadoExtraccion === "success" ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            ) : (
              <AlertTriangle className="h-4 w-4" aria-hidden />
            )}
            <span className="font-semibold">{estado.texto}</span>
            {extraccion.folio && (
              <Badge variant="secondary">Folio {extraccion.folio}</Badge>
            )}
            {extraccion.esRectificatoria && <Badge variant="secondary">Rectificatoria</Badge>}
          </div>

          <div className="rounded-2xl bg-secondary/60 p-4">
            {CAMPOS_VISIBLES.map((campo) => {
              const texto = valorFormateado(
                (extraccion.campos as Record<string, unknown>)[campo.clave],
                campo.tipo,
              );
              return texto ? (
                <DataRow key={campo.clave} label={campo.etiqueta} value={texto} />
              ) : null;
            })}
          </div>

          {extraccion.validaciones.filter((v) => v.estado !== "ok").length > 0 && (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {extraccion.validaciones
                .filter((v) => v.estado !== "ok")
                .map((v) => (
                  <li key={v.id}>• {v.mensaje}</li>
                ))}
            </ul>
          )}

          {extraccion.advertencias.length > 0 && (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {extraccion.advertencias.map((a) => (
                <li key={a}>• {a}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Este periodo todavía no tiene el formulario oficial descargado.
        </p>
      )}

      {declaracionesAmbiguas.length > 0 && (
        <div className="mt-4 rounded-2xl border border-warning/40 bg-warning-soft p-4">
          <p className="text-sm font-semibold">Confirma cuál declaración corresponde</p>
          <p className="mt-1 text-sm text-muted-foreground">{resultado?.motivoSeleccion}</p>
          <div className="mt-3 grid gap-2">
            {declaracionesAmbiguas.map((d) => (
              <button
                key={d.folio}
                type="button"
                onClick={() => setFolioConfirmado(d.folio)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left text-sm",
                  folioConfirmado === d.folio ? "border-primary bg-primary/10" : "border-border bg-card",
                )}
              >
                Folio {d.folio}
                {d.fecha ? ` · ${d.fecha}` : ""}
                {d.estado ? ` · ${d.estado}` : ""}
                {d.esRectificatoria ? " · rectificatoria" : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={descargar}>
        <div>
          <Label htmlFor="f29-rut">RUT del usuario autorizado</Label>
          <Input
            id="f29-rut"
            name="username"
            autoComplete="section-sii username"
            inputMode="text"
            value={rutUsuario}
            onChange={(e) => setRutUsuario(e.target.value)}
            onBlur={() => esRutValido(rutUsuario) && setRutUsuario(formatearRut(rutUsuario))}
            placeholder="12.345.678-9"
          />
        </div>
        <div>
          <Label htmlFor="f29-clave">Clave Tributaria</Label>
          <Input
            id="f29-clave"
            name="password"
            type="password"
            autoComplete="section-sii current-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={ejecutando}>
            {ejecutando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileDown className="mr-2 h-4 w-4" aria-hidden />
            )}
            Descargar y leer el F29 del periodo
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            La clave se usa solo durante esta consulta y no se guarda en la aplicación. Si el
            formulario ya fue descargado antes, no se vuelve a consultar al SII.
          </p>
        </div>
      </form>

      {resultado && (
        <div className="mt-4 rounded-2xl bg-secondary/60 p-4 text-sm">
          <p className="font-semibold">Detalle de la operación</p>
          <DataRow label="Créditos consumidos" value={String(resultado.creditosConsumidos)} />
          {resultado.creditosDisponibles != null && (
            <DataRow label="Créditos disponibles" value={String(resultado.creditosDisponibles)} />
          )}
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {resultado.llamadas.map((l, i) => (
              <li key={`${l.endpoint}-${i}`}>
                • {l.endpoint} — {l.preventedProviderCall ? "sin consulta" : "consulta real"} ·{" "}
                {l.reasonForProviderCall}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Las cifras provienen del formulario oficial declarado ante el SII. Esta lectura es
        informativa y no reemplaza a tu contador.
      </p>
    </SectionCard>
  );
}
