import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, FileCode2, FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState, LoadingBlock } from "@/components/shared/States";
import { EstadoBadge } from "@/components/shared/DocumentList";
import { DocumentoDetalle } from "@/components/documents/DocumentoDetalle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dteFilesService } from "@/services/dteFilesService";
import type {
  DocumentoCentro,
  ListadoDocumentos,
} from "@/lib/dteFiles.server";
import type { TipoArchivoDte } from "@/lib/dteXmlParser";
import { esRutValido, formatearRut } from "@/lib/rut";
import { estadoDesdeRcv } from "@/lib/taxMappers";
import { formatCLP, formatFecha } from "@/utils/currency";

const MAX_LOTE = 20;
const CREDITO_POR_ARCHIVO: Record<TipoArchivoDte, number> = { pdf: 0.01, xml: 0.005 };

const TIPO_LABEL: Record<string, string> = {
  factura: "Factura",
  boleta: "Boleta",
  notaCredito: "Nota de crédito",
  notaDebito: "Nota de débito",
};

function coincide(documento: DocumentoCentro, texto: string): boolean {
  if (!texto.trim()) return true;
  const t = texto.trim().toLowerCase();
  return (
    String(documento.folio).includes(t) ||
    documento.contraparte.toLowerCase().includes(t) ||
    (documento.contraparteRut ?? "").toLowerCase().includes(t) ||
    String(Math.abs(documento.total)).includes(t.replace(/\D/g, "")) ||
    documento.fecha.includes(t)
  );
}

export function CentroDocumental({
  companyId,
  periodo,
}: {
  companyId: string | null;
  periodo: string;
}) {
  const [listado, setListado] = useState<ListadoDocumentos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [direccion, setDireccion] = useState<"sale" | "purchase">("sale");
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [soloSinArchivo, setSoloSinArchivo] = useState(false);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [detalle, setDetalle] = useState<DocumentoCentro | null>(null);
  const [tipoLote, setTipoLote] = useState<TipoArchivoDte>("pdf");
  const [rutUsuario, setRutUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [archivando, setArchivando] = useState(false);

  const cargar = useCallback(async () => {
    if (!companyId) {
      setListado(null);
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      setListado(await dteFilesService.listar(companyId, periodo));
    } catch {
      setListado(null);
    } finally {
      setCargando(false);
    }
  }, [companyId, periodo]);

  useEffect(() => {
    void cargar();
    setSeleccion([]);
    setDetalle(null);
  }, [cargar]);

  const documentos = listado?.documentos ?? [];

  const filtrados = useMemo(
    () =>
      documentos.filter(
        (d) =>
          d.direccion === direccion &&
          (tipo === "todos" || d.tipo === tipo) &&
          (!soloSinArchivo || d.archivos.length === 0) &&
          coincide(d, busqueda),
      ),
    [documentos, direccion, tipo, soloSinArchivo, busqueda],
  );

  const tipos = useMemo(
    () => Array.from(new Set(documentos.filter((d) => d.direccion === direccion).map((d) => d.tipo))),
    [documentos, direccion],
  );

  const seleccionables = filtrados.filter((d) => !d.simulado);
  const costoEstimado = Number((seleccion.length * CREDITO_POR_ARCHIVO[tipoLote]).toFixed(4));

  if (!companyId)
    return (
      <SectionCard titulo="Documentos tributarios">
        <EmptyState
          titulo="Disponible con tu empresa conectada"
          mensaje="Inicia sesión con tu empresa para ver y archivar sus documentos tributarios."
        />
      </SectionCard>
    );

  function alternar(id: string) {
    setSeleccion((previo) =>
      previo.includes(id)
        ? previo.filter((x) => x !== id)
        : previo.length >= MAX_LOTE
          ? previo
          : [...previo, id],
    );
  }

  async function archivarLote() {
    if (!companyId || seleccion.length === 0) return;
    if (!esRutValido(rutUsuario)) {
      toast.error("Revisa el RUT del usuario autorizado.");
      return;
    }
    if (clave.length < 4) {
      toast.error("Ingresa tu Clave Tributaria para continuar.");
      return;
    }
    setArchivando(true);
    try {
      const r = await dteFilesService.descargarLote({
        companyId,
        periodo,
        documentoIds: seleccion,
        tipoArchivo: tipoLote,
        rutUsuario: formatearRut(rutUsuario),
        claveTributaria: clave,
      });
      const guardados = r.resultados.filter((x) => x.archivo && !x.error).length;
      toast.success(
        `Archivamos ${guardados} de ${seleccion.length} documentos. Consumo: ${r.creditosConsumidos} créditos.`,
      );
      if (r.detenidoPor) toast.warning(r.detenidoPor);
      setSeleccion([]);
      await cargar();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No pudimos completar el archivado.",
      );
    } finally {
      // La clave nunca queda en memoria después de la operación.
      setClave("");
      setArchivando(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard
        titulo="Documentos tributarios"
        descripcion="Cada factura, boleta y nota del periodo, con su archivo oficial disponible bajo demanda."
      >
        {cargando ? (
          <LoadingBlock alto="h-72" />
        ) : (
          <>
            <Tabs
              value={direccion}
              onValueChange={(v) => {
                setDireccion(v as "sale" | "purchase");
                setTipo("todos");
                setSeleccion([]);
              }}
            >
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="sale" className="flex-1 sm:flex-none">
                  Emitidos ({listado?.totales.emitidos ?? 0})
                </TabsTrigger>
                <TabsTrigger value="purchase" className="flex-1 sm:flex-none">
                  Recibidos ({listado?.totales.recibidos ?? 0})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Label htmlFor="doc-buscar">Buscar</Label>
                <div className="relative mt-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="doc-buscar"
                    className="h-11 pl-9"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Folio, RUT, nombre o monto"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="doc-tipo">Tipo de documento</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger id="doc-tipo" className="mt-1 h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los tipos</SelectItem>
                    {tipos.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TIPO_LABEL[t] ?? t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm">
              <Checkbox
                checked={soloSinArchivo}
                onCheckedChange={(v) => setSoloSinArchivo(v === true)}
              />
              Mostrar solo los que todavía no tienen archivo guardado
            </label>

            {filtrados.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  titulo="Sin documentos que mostrar"
                  mensaje="Ajusta la búsqueda o actualiza el periodo para ver sus documentos."
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {filtrados.map((d) => {
                  const tienePdf = d.archivos.some(
                    (a) => a.tipoArchivo === "pdf" && a.estado === "stored",
                  );
                  const tieneXml = d.archivos.some(
                    (a) => a.tipoArchivo === "xml" && a.estado === "stored",
                  );
                  return (
                    <li key={d.id} className="rounded-2xl border border-border p-4">
                      <div className="flex items-start gap-3">
                        {!d.simulado && (
                          <Checkbox
                            className="mt-1"
                            aria-label={`Seleccionar folio ${d.folio}`}
                            checked={seleccion.includes(d.id)}
                            onCheckedChange={() => alternar(d.id)}
                          />
                        )}
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setDetalle(d)}
                        >
                          <p className="truncate text-sm font-semibold">{d.contraparte}</p>
                          <p className="text-xs text-muted-foreground">
                            {TIPO_LABEL[d.tipo] ?? d.tipo} N° {d.folio} · {formatFecha(d.fecha)}
                            {d.contraparteRut ? ` · ${d.contraparteRut}` : ""}
                          </p>
                          <p className="num-md mt-2 text-lg">{formatCLP(d.total)}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <EstadoBadge estado={estadoDesdeRcv(d.direccion, d.estadoRcv)} />
                            {tienePdf && (
                              <Badge variant="secondary">
                                <FileText className="mr-1 h-3 w-3" aria-hidden />
                                PDF
                              </Badge>
                            )}
                            {tieneXml && (
                              <Badge variant="secondary">
                                <FileCode2 className="mr-1 h-3 w-3" aria-hidden />
                                XML
                              </Badge>
                            )}
                            {d.simulado && <Badge variant="secondary">Demostrativo</Badge>}
                          </div>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {listado?.hayDatosSimulados && (
              <p className="mt-4 text-xs text-muted-foreground">
                Datos simulados para pruebas. No corresponden a información obtenida del SII.
              </p>
            )}
          </>
        )}
      </SectionCard>

      {listado?.descargaDisponible && seleccionables.length > 0 && (
        <SectionCard
          titulo="Archivado por lote"
          descripcion="Trae varios archivos de una sola vez, con el costo estimado a la vista antes de confirmar."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="lote-tipo">Tipo de archivo</Label>
              <Select value={tipoLote} onValueChange={(v) => setTipoLote(v as TipoArchivoDte)}>
                <SelectTrigger id="lote-tipo" className="mt-1 h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="xml">XML</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="lote-rut">RUT del usuario autorizado</Label>
              <Input
                id="lote-rut"
                name="username"
                autoComplete="section-sii username"
                className="mt-1 h-11"
                value={rutUsuario}
                onChange={(e) => setRutUsuario(e.target.value)}
                onBlur={() => esRutValido(rutUsuario) && setRutUsuario(formatearRut(rutUsuario))}
                placeholder="12.345.678-9"
              />
            </div>
            <div>
              <Label htmlFor="lote-clave">Clave Tributaria</Label>
              <Input
                id="lote-clave"
                name="password"
                type="password"
                autoComplete="section-sii current-password"
                className="mt-1 h-11"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            Seleccionaste {seleccion.length} de un máximo de {MAX_LOTE} documentos. Costo
            estimado: {costoEstimado} créditos. Los archivos ya guardados no se vuelven a pedir.
          </p>

          <Button
            className="mt-3"
            disabled={archivando || seleccion.length === 0}
            onClick={archivarLote}
          >
            {archivando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Archive className="mr-2 h-4 w-4" aria-hidden />
            )}
            Archivar seleccionados
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Tu clave se usa solo durante esta consulta y no queda guardada.
          </p>
        </SectionCard>
      )}

      <DocumentoDetalle
        documento={detalle}
        companyId={companyId}
        periodo={periodo}
        descargaDisponible={listado?.descargaDisponible ?? false}
        abierto={detalle !== null}
        onCerrar={() => setDetalle(null)}
        onActualizado={() => void cargar()}
      />
    </div>
  );
}
