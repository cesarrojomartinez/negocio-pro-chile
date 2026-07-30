import { useMemo, useState } from "react";
import { FileCode2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataRow } from "@/components/shared/SectionCard";
import { EstadoBadge } from "@/components/shared/DocumentList";
import { dteFilesService } from "@/services/dteFilesService";
import type { DocumentoCentro } from "@/lib/dteFiles.server";
import type { TipoArchivoDte } from "@/lib/dteXmlParser";
import { esRutValido, formatearRut } from "@/lib/rut";
import { formatCLP, formatFecha } from "@/utils/currency";
import { estadoDesdeRcv } from "@/lib/taxMappers";
import { cn } from "@/lib/utils";

const TIPO_LABEL: Record<string, string> = {
  factura: "Factura",
  boleta: "Boleta",
  notaCredito: "Nota de crédito",
  notaDebito: "Nota de débito",
};

const CLASE_VALIDACION: Record<string, string> = {
  ok: "text-success",
  warning: "text-warning-foreground",
  error: "text-destructive",
};

export function DocumentoDetalle({
  documento,
  companyId,
  periodo,
  descargaDisponible,
  abierto,
  onCerrar,
  onActualizado,
}: {
  documento: DocumentoCentro | null;
  companyId: string;
  periodo: string;
  descargaDisponible: boolean;
  abierto: boolean;
  onCerrar: () => void;
  onActualizado: () => void;
}) {
  const [rutUsuario, setRutUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [trabajando, setTrabajando] = useState<TipoArchivoDte | null>(null);

  const archivoPdf = useMemo(
    () => documento?.archivos.find((a) => a.tipoArchivo === "pdf" && a.estado === "stored"),
    [documento],
  );
  const archivoXml = useMemo(
    () => documento?.archivos.find((a) => a.tipoArchivo === "xml" && a.estado === "stored"),
    [documento],
  );

  if (!documento) return null;

  async function descargar(tipoArchivo: TipoArchivoDte) {
    if (!documento) return;
    if (!esRutValido(rutUsuario)) {
      toast.error("Revisa el RUT del usuario autorizado.");
      return;
    }
    if (clave.length < 4) {
      toast.error("Ingresa tu Clave Tributaria para continuar.");
      return;
    }
    setTrabajando(tipoArchivo);
    try {
      const r = await dteFilesService.descargar({
        companyId,
        periodo,
        documentoId: documento.id,
        tipoArchivo,
        rutUsuario: formatearRut(rutUsuario),
        claveTributaria: clave,
      });
      if (r.error) toast.warning(r.mensaje);
      else toast.success(r.mensaje);
      onActualizado();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No pudimos obtener el documento.",
      );
    } finally {
      // La clave nunca queda en memoria después de la operación.
      setClave("");
      setTrabajando(null);
    }
  }

  async function abrirArchivo(archivoId: string) {
    try {
      const url = await dteFilesService.urlFirmada(companyId, archivoId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos abrir el archivo.");
    }
  }

  const validaciones = archivoXml?.validaciones ?? [];

  return (
    <Sheet open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {TIPO_LABEL[documento.tipo] ?? documento.tipo} N° {documento.folio}
          </SheetTitle>
          <SheetDescription>
            {documento.direccion === "sale" ? "Documento emitido" : "Documento recibido"} ·{" "}
            {formatFecha(documento.fecha)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <EstadoBadge estado={estadoDesdeRcv(documento.direccion, documento.estadoRcv)} />
            <Badge variant="secondary">Código DTE {documento.dteCode}</Badge>
            {documento.simulado && <Badge variant="secondary">Demostrativo</Badge>}
          </div>

          <div className="rounded-2xl bg-secondary/60 p-4">
            <DataRow
              label={documento.direccion === "sale" ? "Cliente" : "Proveedor"}
              value={documento.contraparte}
            />
            <DataRow label="RUT" value={documento.contraparteRut ?? "Sin informar"} />
            <DataRow label="Neto" value={formatCLP(documento.neto)} />
            <DataRow label="IVA" value={formatCLP(documento.iva)} />
            <DataRow label="Exento" value={formatCLP(documento.exento)} />
            <DataRow label="Total" value={formatCLP(documento.total)} strong />
          </div>

          <div className="flex flex-wrap gap-2">
            {archivoPdf && (
              <Button variant="outline" size="sm" onClick={() => abrirArchivo(archivoPdf.id)}>
                <FileText className="mr-2 h-4 w-4" aria-hidden />
                Ver PDF guardado
              </Button>
            )}
            {archivoXml && (
              <Button variant="outline" size="sm" onClick={() => abrirArchivo(archivoXml.id)}>
                <FileCode2 className="mr-2 h-4 w-4" aria-hidden />
                Ver XML guardado
              </Button>
            )}
          </div>

          {validaciones.length > 0 && (
            <div className="rounded-2xl border border-border p-4">
              <p className="text-sm font-semibold">Comparación con el registro del SII</p>
              <ul className="mt-2 space-y-1 text-sm">
                {validaciones.map((v) => (
                  <li key={v.id} className={cn(CLASE_VALIDACION[v.estado])}>
                    • {v.titulo}: {v.detalle}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Solo informamos las diferencias. Nunca modificamos los montos guardados.
              </p>
            </div>
          )}

          {documento.simulado ? (
            <p className="rounded-2xl bg-secondary/60 p-4 text-sm text-muted-foreground">
              Datos simulados para pruebas. No corresponden a información obtenida del SII,
              por eso no hay archivos oficiales que descargar.
            </p>
          ) : !descargaDisponible ? (
            <p className="rounded-2xl bg-secondary/60 p-4 text-sm text-muted-foreground">
              La descarga de archivos oficiales no está habilitada para esta empresa.
            </p>
          ) : (
            <form
              className="space-y-3 rounded-2xl border border-border p-4"
              onSubmit={(e) => e.preventDefault()}
            >
              <p className="text-sm font-semibold">Descargar desde el SII</p>
              <p className="text-xs text-muted-foreground">
                Cada archivo se pide una sola vez y queda guardado en tu carpeta privada.
              </p>
              <div>
                <Label htmlFor="doc-rut">RUT del usuario autorizado</Label>
                <Input
                  id="doc-rut"
                  name="username"
                  autoComplete="section-sii username"
                  value={rutUsuario}
                  onChange={(e) => setRutUsuario(e.target.value)}
                  onBlur={() => esRutValido(rutUsuario) && setRutUsuario(formatearRut(rutUsuario))}
                  placeholder="12.345.678-9"
                />
              </div>
              <div>
                <Label htmlFor="doc-clave">Clave Tributaria</Label>
                <Input
                  id="doc-clave"
                  name="password"
                  type="password"
                  autoComplete="section-sii current-password"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={trabajando !== null}
                  onClick={() => descargar("pdf")}
                >
                  {trabajando === "pdf" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" aria-hidden />
                  )}
                  Traer PDF
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={trabajando !== null}
                  onClick={() => descargar("xml")}
                >
                  {trabajando === "xml" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <FileCode2 className="mr-2 h-4 w-4" aria-hidden />
                  )}
                  Traer XML
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Tu clave se usa solo durante esta consulta y no queda guardada.
              </p>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
