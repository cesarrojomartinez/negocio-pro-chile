import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileCheck2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { SectionCard, DataRow } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompany } from "@/hooks/useCompany";
import { validacionOficialService } from "@/services/validacionOficialService";
import type {
  DocumentoElegible,
  PrevisualizacionValidacion,
  RegistroValidacion,
} from "@/lib/validacionOficial.server";
import {
  aniosDisponibles,
  codigosAdicionales,
  codigosPrioritarios,
  documentosRequeridos,
  esPeriodoValido,
  etiquetaPeriodo,
  ETIQUETA_ARCHIVO_DTE,
  MENSAJE_ERROR_VALIDACION,
  MESES,
  periodoDe,
  TIPOS_VALIDACION,
  totalOficialDeclarado,
  type CodigoErrorValidacion,
  type TipoValidacion,
} from "@/lib/validacionOficial";
import type { TipoArchivoDte } from "@/lib/dteXmlParser";
import { formatCLP, formatFechaHora } from "@/utils/currency";
import { esRutValido, formatearRut } from "@/lib/rut";

const OPCIONES_ARCHIVO: { id: string; valor: TipoArchivoDte[]; label: string }[] = [
  { id: "pdf", valor: ["pdf"], label: "Obtener PDF" },
  { id: "xml", valor: ["xml"], label: "Obtener XML" },
  { id: "ambos", valor: ["pdf", "xml"], label: "Obtener ambos" },
];

const ETIQUETA_ESTADO: Record<RegistroValidacion["estado"], string> = {
  running: "En curso",
  success: "Completada",
  partial: "Completada con observaciones",
  failed: "Detenida",
};

const CLASE_ESTADO: Record<RegistroValidacion["estado"], string> = {
  running: "bg-secondary text-muted-foreground",
  success: "bg-success-soft text-success",
  partial: "bg-warning-soft text-warning-foreground",
  failed: "bg-danger-soft text-destructive",
};

function textoValor(valor: number | null): string {
  return valor == null ? "No informado" : formatCLP(valor);
}

function EtiquetaDocumento({ documento }: { documento: DocumentoElegible }) {
  return (
    <span>
      N° {documento.folio} · DTE {documento.dteCode} · {formatCLP(documento.total)} ·{" "}
      {documento.direccion === "sale" ? documento.receptor : documento.emisor}
    </span>
  );
}

export function ValidacionOficialPanel() {
  const { empresas, empresaActiva, seleccionarEmpresa } = useCompany();
  const empresasPropias = useMemo(
    () => empresas.filter((e) => e.rol === "owner" && !e.esDemo),
    [empresas],
  );

  const hoy = new Date();
  const [companyId, setCompanyId] = useState<string>(
    empresaActiva?.rol === "owner" ? empresaActiva.id : (empresasPropias[0]?.id ?? ""),
  );
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [tipo, setTipo] = useState<TipoValidacion>("f29");
  const [documentoVentaId, setDocumentoVentaId] = useState<string | null>(null);
  const [documentoCompraId, setDocumentoCompraId] = useState<string | null>(null);
  const [opcionArchivo, setOpcionArchivo] = useState("pdf");
  const [rutUsuario, setRutUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [confirmado, setConfirmado] = useState(false);

  const [previsualizacion, setPrevisualizacion] =
    useState<PrevisualizacionValidacion | null>(null);
  const [cargandoPrevio, setCargandoPrevio] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [historial, setHistorial] = useState<RegistroValidacion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const periodo = periodoDe(anio, mes);
  const archivos = OPCIONES_ARCHIVO.find((o) => o.id === opcionArchivo)?.valor ?? ["pdf"];
  const requeridos = documentosRequeridos(tipo);

  useEffect(() => {
    if (!companyId && empresasPropias[0]) setCompanyId(empresasPropias[0].id);
  }, [companyId, empresasPropias]);

  // La tarjeta de resultado sobrevive al recargar: se lee desde la base.
  useEffect(() => {
    if (!companyId) return;
    let vigente = true;
    validacionOficialService
      .listar(companyId, 5)
      .then((r) => vigente && setHistorial(r))
      .catch(() => vigente && setHistorial([]));
    return () => {
      vigente = false;
    };
  }, [companyId]);

  const previsualizar = useCallback(async () => {
    if (!companyId || !esPeriodoValido(periodo)) return;
    setCargandoPrevio(true);
    setError(null);
    setConfirmado(false);
    try {
      const r = await validacionOficialService.previsualizar({
        companyId,
        periodo,
        tipo,
        documentoVentaId,
        documentoCompraId,
        archivos,
      });
      setPrevisualizacion(r);
    } catch (e) {
      setPrevisualizacion(null);
      setError(e instanceof Error ? e.message : "No pudimos revisar este periodo.");
    } finally {
      setCargandoPrevio(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, periodo, tipo, documentoVentaId, documentoCompraId, opcionArchivo]);

  const emitidos = (previsualizacion?.documentos ?? []).filter(
    (d) => d.direccion === "sale",
  );
  const recibidos = (previsualizacion?.documentos ?? []).filter(
    (d) => d.direccion === "purchase",
  );

  const puedeEjecutar =
    Boolean(previsualizacion) &&
    confirmado &&
    esRutValido(rutUsuario) &&
    clave.length >= 4 &&
    (!requeridos.venta || Boolean(documentoVentaId)) &&
    (!requeridos.compra || Boolean(documentoCompraId));

  async function ejecutar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!puedeEjecutar || !companyId) return;
    setEjecutando(true);
    setError(null);
    try {
      const registro = await validacionOficialService.ejecutar({
        companyId,
        periodo,
        tipo,
        documentoVentaId,
        documentoCompraId,
        archivos,
        rutUsuario,
        claveTributaria: clave,
        consentimiento: true,
      });
      setHistorial((previo) => [registro, ...previo].slice(0, 5));
      toast[registro.estado === "failed" ? "error" : "success"](
        registro.estado === "failed"
          ? (registro.mensaje ?? "La validación se detuvo.")
          : "Validación registrada.",
      );
      await previsualizar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos completar la validación.");
    } finally {
      // La Clave Tributaria nunca queda en pantalla ni en el navegador.
      setClave("");
      setConfirmado(false);
      setEjecutando(false);
    }
  }

  if (empresasPropias.length === 0) return null;

  return (
    <SectionCard
      titulo="Validación de información oficial"
      descripcion="Prueba controlada del Formulario 29 y de los archivos oficiales de tus documentos, para cualquier empresa y cualquier periodo."
      acciones={<ShieldCheck className="h-5 w-5 text-primary" aria-hidden />}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <Label htmlFor="validacion-empresa">Empresa</Label>
          <Select
            value={companyId}
            onValueChange={(v) => {
              setCompanyId(v);
              seleccionarEmpresa(v);
              setPrevisualizacion(null);
              setDocumentoVentaId(null);
              setDocumentoCompraId(null);
            }}
          >
            <SelectTrigger id="validacion-empresa" className="mt-1 h-11 w-full">
              <SelectValue placeholder="Elige una empresa" />
            </SelectTrigger>
            <SelectContent>
              {empresasPropias.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.razonSocial}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="validacion-anio">Año</Label>
          <Select
            value={String(anio)}
            onValueChange={(v) => {
              setAnio(Number(v));
              setPrevisualizacion(null);
            }}
          >
            <SelectTrigger id="validacion-anio" className="mt-1 h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {aniosDisponibles(hoy.getFullYear()).map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="validacion-mes">Mes</Label>
          <Select
            value={String(mes)}
            onValueChange={(v) => {
              setMes(Number(v));
              setPrevisualizacion(null);
            }}
          >
            <SelectTrigger id="validacion-mes" className="mt-1 h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="validacion-periodo">Periodo</Label>
          <Input
            id="validacion-periodo"
            className="mt-1 h-11"
            value={periodo}
            onChange={(e) => {
              const valor = e.target.value.trim();
              if (esPeriodoValido(valor)) {
                setAnio(Number(valor.slice(0, 4)));
                setMes(Number(valor.slice(5, 7)));
                setPrevisualizacion(null);
              }
            }}
            inputMode="numeric"
            placeholder="AAAA-MM"
          />
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">Tipo de validación</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {TIPOS_VALIDACION.map((t) => (
            <label
              key={t.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${
                tipo === t.id ? "border-primary bg-info-soft" : "border-border"
              }`}
            >
              <input
                type="radio"
                name="tipo-validacion"
                className="mt-1"
                checked={tipo === t.id}
                onChange={() => {
                  setTipo(t.id);
                  setPrevisualizacion(null);
                }}
              />
              <span>
                <span className="font-semibold">
                  {t.letra}. {t.titulo}
                </span>
                <span className="block text-xs text-muted-foreground">{t.descripcion}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={previsualizar}
        disabled={cargandoPrevio || !companyId}
      >
        {cargandoPrevio && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Revisar antes de consultar
      </Button>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {previsualizacion && (
        <div className="mt-4 rounded-2xl border border-border p-4">
          <p className="text-sm font-semibold">
            Antes de consultar: {etiquetaPeriodo(previsualizacion.periodo)}
          </p>
          <div className="mt-2">
            <DataRow label="Empresa" value={previsualizacion.empresa} />
            <DataRow label="RUT" value={formatearRut(previsualizacion.rutEmpresa)} />
            <DataRow
              label="Información ya guardada del periodo"
              value={previsualizacion.periodoPersistido ? "Sí" : "Todavía no"}
            />
            <DataRow
              label="Formulario 29 ya archivado"
              value={
                previsualizacion.f29Archivado
                  ? `Sí, folio ${previsualizacion.f29Folio ?? "—"}`
                  : "No"
              }
            />
            <DataRow
              label="Documentos emitidos del periodo"
              value={String(previsualizacion.emitidos)}
            />
            <DataRow
              label="Documentos recibidos del periodo"
              value={String(previsualizacion.recibidos)}
            />
            <DataRow
              label="Consultas que se realizarían"
              value={String(previsualizacion.plan.llamadasEstimadas)}
            />
            <DataRow
              label="Consultas evitadas por información ya guardada"
              value={String(previsualizacion.plan.llamadasEvitadasPorCache)}
            />
            <DataRow
              label="Créditos estimados"
              value={
                previsualizacion.plan.costoParcialmenteDesconocido
                  ? `${previsualizacion.plan.creditosEstimados} más lo que informe el proveedor`
                  : String(previsualizacion.plan.creditosEstimados)
              }
              strong
            />
          </div>

          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {previsualizacion.plan.llamadas.map((l) => (
              <li key={`${l.etapa}-${l.recurso}`}>
                {l.seEjecuta ? "•" : "✓"} {l.etapa}: {l.motivo}
              </li>
            ))}
          </ul>

          {(requeridos.venta || requeridos.compra) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {requeridos.venta && (
                <div>
                  <Label htmlFor="validacion-emitido">Documento emitido</Label>
                  <Select
                    value={documentoVentaId ?? ""}
                    onValueChange={(v) => setDocumentoVentaId(v)}
                  >
                    <SelectTrigger id="validacion-emitido" className="mt-1 h-11 w-full">
                      <SelectValue placeholder="Elige un documento emitido" />
                    </SelectTrigger>
                    <SelectContent>
                      {emitidos.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          N° {d.folio} · {formatCLP(d.total)} · {d.receptor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {requeridos.compra && (
                <div>
                  <Label htmlFor="validacion-recibido">Documento recibido</Label>
                  <Select
                    value={documentoCompraId ?? ""}
                    onValueChange={(v) => setDocumentoCompraId(v)}
                  >
                    <SelectTrigger id="validacion-recibido" className="mt-1 h-11 w-full">
                      <SelectValue placeholder="Elige un documento recibido" />
                    </SelectTrigger>
                    <SelectContent>
                      {recibidos.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          N° {d.folio} · {formatCLP(d.total)} · {d.emisor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="sm:col-span-2">
                <Label htmlFor="validacion-archivo">Archivos a solicitar</Label>
                <Select value={opcionArchivo} onValueChange={setOpcionArchivo}>
                  <SelectTrigger id="validacion-archivo" className="mt-1 h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPCIONES_ARCHIVO.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {[documentoVentaId, documentoCompraId]
                .map((id) => previsualizacion.documentos.find((d) => d.id === id))
                .filter((d): d is DocumentoElegible => Boolean(d))
                .map((d) => (
                  <div key={d.id} className="rounded-xl bg-secondary p-3 text-xs sm:col-span-2">
                    <p className="text-sm font-semibold">
                      {d.direccion === "sale" ? "Documento emitido" : "Documento recibido"}
                    </p>
                    <p className="mt-1">
                      <EtiquetaDocumento documento={d} />
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Emisor: {d.emisor} · Receptor: {d.receptor} · Fecha: {d.fecha}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      PDF: {ETIQUETA_ARCHIVO_DTE[d.estadoPdf]} · XML:{" "}
                      {ETIQUETA_ARCHIVO_DTE[d.estadoXml]}
                    </p>
                  </div>
                ))}
            </div>
          )}

          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={ejecutar}
            name="form-validacion-oficial"
            autoComplete="on"
          >
            <div>
              <Label htmlFor="validacion-rut">RUT del usuario autorizado</Label>
              <Input
                id="validacion-rut"
                name="sii_username"
                className="mt-1 h-11"
                autoComplete="section-sii username"
                value={rutUsuario}
                onChange={(e) => setRutUsuario(e.target.value)}
                placeholder="12.345.678-9"
              />
            </div>
            <div>
              <Label htmlFor="validacion-clave">Clave Tributaria</Label>
              <Input
                id="validacion-clave"
                name="sii_password"
                type="password"
                className="mt-1 h-11"
                autoComplete="section-sii current-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
              />
            </div>
            <label className="flex items-start gap-3 text-sm sm:col-span-2">
              <Checkbox
                checked={confirmado}
                onCheckedChange={(v) => setConfirmado(v === true)}
              />
              <span>
                Confirmo esta ejecución con {previsualizacion.plan.llamadasEstimadas}{" "}
                consulta(s) y hasta {previsualizacion.plan.creditosEstimados} crédito(s).
                La clave se usa solo durante la consulta y no se guarda.
              </span>
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={!puedeEjecutar || ejecutando}>
                {ejecutando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Ejecutar validación controlada
              </Button>
            </div>
          </form>
        </div>
      )}

      {historial.length > 0 && (
        <div className="mt-5 space-y-4">
          <p className="text-sm font-semibold">Resultados guardados</p>
          {historial.map((r) => (
            <TarjetaValidacion key={r.id} registro={r} />
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Estimación informativa. El resultado definitivo debe ser confirmado por tu
        contador.
      </p>
    </SectionCard>
  );
}

function TarjetaValidacion({ registro }: { registro: RegistroValidacion }) {
  const total = totalOficialDeclarado(registro.codigos);
  const prioritarios = codigosPrioritarios(registro.codigos);
  const adicionales = codigosAdicionales(registro.codigos);
  const campos = registro.campos;

  return (
    <article className="rounded-2xl border border-border p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {etiquetaPeriodo(registro.periodo)} ·{" "}
            {TIPOS_VALIDACION.find((t) => t.id === registro.tipo)?.titulo}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFechaHora(registro.creadoEn)} · Ejecución {registro.syncRunId.slice(0, 8)}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CLASE_ESTADO[registro.estado]}`}
        >
          {ETIQUETA_ESTADO[registro.estado]}
        </span>
      </header>

      {registro.errorCodigo && (
        <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
          {registro.mensaje ??
            MENSAJE_ERROR_VALIDACION[registro.errorCodigo as CodigoErrorValidacion]}
        </p>
      )}

      <div className="mt-3">
        <DataRow label="Etapa" value={registro.etapa ?? "—"} />
        <DataRow
          label="Formulario 29 encontrado"
          value={registro.f29Encontrado ? "Sí" : "No"}
        />
        <DataRow label="Folio" value={registro.f29Folio ?? "No informado"} />
        <DataRow
          label="Archivo del formulario guardado"
          value={registro.f29PdfArchivado ? "Sí" : "No"}
        />
        <DataRow
          label={total.etiqueta}
          value={textoValor(total.valor)}
          strong
        />
        <DataRow
          label="Estimación de la aplicación"
          value={textoValor(registro.comparacion?.estimatedTotal ?? null)}
        />
        <DataRow
          label="Diferencia"
          value={
            registro.comparacion?.difference == null
              ? "No comparable"
              : `${formatCLP(registro.comparacion.difference)}${
                  registro.comparacion.differencePercentage != null
                    ? ` (${registro.comparacion.differencePercentage}%)`
                    : ""
                }`
          }
        />
        <DataRow label="Solicitudes reales al proveedor" value={String(registro.solicitudesReales)} />
        <DataRow label="Información reutilizada" value={String(registro.cacheUtilizada)} />
        <DataRow label="Consultas evitadas" value={String(registro.llamadasEvitadas)} />
        <DataRow
          label="Créditos consumidos"
          value={String(registro.creditosConsumidos)}
        />
        <DataRow
          label="Créditos disponibles"
          value={
            registro.creditosDisponibles == null
              ? "No informado"
              : String(registro.creditosDisponibles)
          }
        />
      </div>

      {campos && (
        <div className="mt-3 rounded-xl bg-secondary p-3">
          <p className="text-sm font-semibold">Resultado oficial</p>
          <div className="mt-1">
            <DataRow label="IVA débito" value={textoValor(campos.declared_vat_debit)} />
            <DataRow
              label="Total créditos"
              value={textoValor(campos.declared_total_vat_credits)}
            />
            <DataRow
              label="Remanente anterior"
              value={textoValor(campos.declared_previous_carryforward)}
            />
            <DataRow label="IVA determinado" value={textoValor(campos.declared_vat_payable)} />
            <DataRow
              label="Remanente siguiente"
              value={textoValor(campos.declared_new_carryforward)}
            />
            <DataRow label="Base PPM" value={textoValor(campos.declared_ppm_base)} />
            <DataRow
              label="Tasa PPM"
              value={
                campos.declared_ppm_rate == null
                  ? "No informado"
                  : `${campos.declared_ppm_rate}%`
              }
            />
            <DataRow label="PPM" value={textoValor(campos.declared_ppm)} />
            <DataRow
              label="Retenciones"
              value={textoValor(campos.declared_withholdings)}
            />
            <DataRow
              label="Total determinado"
              value={textoValor(campos.declared_total_determined)}
            />
            <DataRow label="Total a pagar" value={textoValor(campos.declared_total_payable)} />
            <DataRow label="Confianza de la lectura" value={registro.f29Confianza ?? "—"} />
          </div>
        </div>
      )}

      {registro.f29Encontrado && (
        <div className="mt-3">
          <p className="text-sm font-semibold">Códigos del formulario</p>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {prioritarios.map((c) => (
              <li key={c.codigo} className="flex justify-between gap-3 rounded-lg bg-secondary px-3 py-1.5">
                <span className="min-w-0 truncate">
                  {c.codigo} · {c.etiqueta}
                </span>
                <span className="shrink-0 tabular-nums">
                  {c.informado ? formatCLP(c.valor ?? 0) : "No informado"}
                </span>
              </li>
            ))}
          </ul>
          {adicionales.length > 0 && (
            <>
              <p className="mt-3 text-sm font-semibold">Otros códigos informados</p>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {adicionales.map((c) => (
                  <li
                    key={c.codigo}
                    className="flex justify-between gap-3 rounded-lg bg-secondary px-3 py-1.5"
                  >
                    <span className="min-w-0 truncate">
                      {c.codigo} · {c.etiqueta}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatCLP(c.valor ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {registro.codigosFaltantes.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Sin informar: {registro.codigosFaltantes.join(", ")}
            </p>
          )}
        </div>
      )}

      {(registro.comparacion?.explanationCodes.length ?? 0) > 0 && (
        <div className="mt-3">
          <p className="text-sm font-semibold">Qué explica la diferencia</p>
          <ul className="mt-2 space-y-1 text-sm">
            {registro.comparacion?.explanationCodes.map((e, i) => (
              <li key={`${e.codigo}-${i}`} className="rounded-lg bg-secondary px-3 py-2">
                <span className="font-medium">{e.etiqueta}</span>
                {e.diferencia != null && (
                  <span className="tabular-nums"> · {formatCLP(e.diferencia)}</span>
                )}
                <span className="block text-xs text-muted-foreground">{e.detalle}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {registro.documentos.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-semibold">Documentos revisados</p>
          <ul className="mt-2 space-y-1 text-sm">
            {registro.documentos.map((d, i) => (
              <li key={`${d.documentoId}-${d.tipoArchivo}-${i}`} className="rounded-lg bg-secondary px-3 py-2">
                <span className="flex flex-wrap items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-primary" aria-hidden />
                  {d.direccion === "sale" ? "Emitido" : "Recibido"} N° {d.folio} · DTE{" "}
                  {d.dteCode} · {d.tipoArchivo.toUpperCase()}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {d.mensaje}
                  {d.comparacionXml === "matched" && " · El XML coincide con el registro."}
                  {d.comparacionXml === "difference" &&
                    ` · Diferencias con el registro: ${d.detalleComparacion.join(" ")}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
