import { useEffect, useRef, useState } from "react";
import { AlertTriangle, KeyRound, Loader2, PlugZap, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { SectionCard, DataRow } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCompany } from "@/hooks/useCompany";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";
import { apiGatewayService } from "@/services/apiGatewayService";
import type { DiagnosticoApiGateway } from "@/lib/apiGateway.server";
import type { ResultadoPruebaReal } from "@/lib/apiGatewayReal.server";
import type { ResultadoAuditoriaF29 } from "@/lib/f29Audit.server";
import { formatCLP, formatFechaHora } from "@/utils/currency";
import { mensajeProveedor } from "@/utils/mensajesProveedor";
import { esRutValido, formatearRut } from "@/lib/rut";

/** Códigos que indican sesión vencida del proveedor (no clave incorrecta). */
const CODIGOS_SESION_VENCIDA = ["SESSION_INVALID", "SESSION_EXPIRED", "AUTH_EXPIRED"];

/** Clave del sondeo guardado para esta sesión del navegador. */
const CLAVE_SONDEO = "mnd.diagnostico-productos";
/** Última prueba real, guardada solo para esta sesión del navegador. */
const CLAVE_ULTIMA_PRUEBA = "mnd.ultima-prueba-real";

/** Nombre visible de cada módulo consultado. */
const NOMBRE_MODULO: Record<string, string> = {
  rcv_sales_summary: "Ventas (resumen)",
  rcv_sales_documents: "Ventas (detalle)",
  rcv_purchases_registered: "Compras REGISTRO",
  rcv_purchases_pending: "Compras PENDIENTE",
  rcv_purchases_claimed: "Compras RECLAMADO",
  rcv_purchases_excluded: "Compras NO INCLUIR",
  f29_periods: "Formulario 29 (listado)",
  f29_detail: "Formulario 29 (detalle)",
  withholdings: "Retenciones",
};

/** Texto visible de cada clasificación de módulo. */
const ETIQUETA_ESTADO_MODULO: Record<string, string> = {
  completado: "Completado",
  sin_informacion: "Sin información en el periodo",
  no_disponible: "Omitido: recurso no disponible",
  no_contratado: "Producto no contratado",
  error_autenticacion: "Error de autenticación ante el SII",
  error_proveedor: "Error del proveedor",
  timeout: "Tiempo de espera agotado",
  respuesta_invalida: "Respuesta inválida del proveedor",
  desde_cache: "Vigente desde la última consulta",
  omitido: "No solicitado en esta ejecución",
};

/** Estilo visual por estado de producto (solo presentación). */
const ESTILO_PRODUCTO: Record<string, string> = {
  no_verificado: "border-primary/30 bg-info-soft",
  habilitado: "border-success/40 bg-success-soft",
  sin_informacion_periodo: "border-primary/30 bg-info-soft",
  no_contratado: "border-warning/40 bg-warning-soft",
  recurso_no_disponible: "border-warning/40 bg-warning-soft",
  saldo_insuficiente: "border-warning/40 bg-warning-soft",
  proxy_requerido: "border-warning/40 bg-warning-soft",
  mantenimiento: "border-warning/40 bg-warning-soft",
  error_autenticacion: "border-destructive/40 bg-destructive/5",
};


/**
 * Prueba controlada con el proveedor real.
 *
 * Solo aparece cuando el backend confirma que el modo de prueba está
 * habilitado. La clave se usa una vez y no se guarda en ninguna parte.
 */
export function RealGatewayPanel() {
  const { empresaActiva } = useCompany();
  const { periodoId, refrescarDatos, solicitudActualizacionReal } = useTaxDashboard();
  const contenedorRef = useRef<HTMLDivElement | null>(null);

  const [diagnostico, setDiagnostico] = useState<DiagnosticoApiGateway | null>(null);
  const [cargando, setCargando] = useState(true);
  const [rutUsuario, setRutUsuario] = useState("");
  /** Se activa sola tras un error de sesión y se apaga después de usarla. */
  const [sesionNueva, setSesionNueva] = useState(false);
  const [clave, setClave] = useState("");
  const [periodo, setPeriodo] = useState(periodoId);
  const [acepta, setAcepta] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [comprobandoProductos, setComprobandoProductos] = useState(false);
  const [auditando, setAuditando] = useState(false);
  /** Última auditoría del F29. Solo lectura; nunca guarda la clave. */
  const [auditoria, setAuditoria] = useState<ResultadoAuditoriaF29 | null>(null);
  /** Última prueba real ejecutada, visible aunque se borre la clave. */
  const [ultima, setUltima] = useState<{
    periodo: string;
    ejecutadaEn: string;
    resultado: ResultadoPruebaReal;
  } | null>(null);
  /** Último sondeo de productos, guardado solo para esta sesión del navegador. */
  const [sondeo, setSondeo] = useState<{
    productos: DiagnosticoApiGateway["productos"];
    verificadoEn: string;
  } | null>(null);

  // Se recupera el último sondeo guardado: nunca se vuelve a ejecutar solo.
  useEffect(() => {
    try {
      const crudo = sessionStorage.getItem(CLAVE_SONDEO);
      if (crudo) setSondeo(JSON.parse(crudo));
    } catch {
      setSondeo(null);
    }
    try {
      const previo = sessionStorage.getItem(CLAVE_ULTIMA_PRUEBA);
      if (previo) setUltima(JSON.parse(previo));
    } catch {
      setUltima(null);
    }
  }, []);

  /** Sondeo opcional: verifica productos contratados y consume pocos créditos. */
  const comprobarProductos = async () => {
    setComprobandoProductos(true);
    try {
      const d = await apiGatewayService.diagnosticar(true);
      setDiagnostico(d);
      const guardado = { productos: d.productos, verificadoEn: d.verificadoEn };
      setSondeo(guardado);
      try {
        sessionStorage.setItem(CLAVE_SONDEO, JSON.stringify(guardado));
      } catch {
        /* almacenamiento no disponible: el sondeo solo vive en memoria */
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No pudimos comprobar los productos contratados.",
      );
    } finally {
      setComprobandoProductos(false);
    }
  };


  const esDueno = empresaActiva?.rol === "owner";

  useEffect(() => {
    let vigente = true;
    apiGatewayService
      .diagnosticar()
      .then((d) => {
        if (vigente) setDiagnostico(d);
      })
      .catch(() => {
        if (vigente) setDiagnostico(null);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  if (cargando || !diagnostico?.modoPruebaHabilitado || !esDueno) return null;

  // Se prefiere el último sondeo real por sobre el estado "no verificado".
  const productos = sondeo?.productos ?? diagnostico.productos;

  // Los productos se consideran verificados solo tras un sondeo real.
  const productosVerificados =
    productos.length > 0 && productos.every((p) => p.estado !== "no_verificado");


  const ejecutar = async () => {
    if (!empresaActiva) return;
    setEjecutando(true);
    try {
      const r = await apiGatewayService.ejecutarPrueba({
        companyId: empresaActiva.id,
        periodo,
        rutUsuario,
        claveTributaria: clave,
        sesionNueva,
      });
      // `auth_cache=0` nunca queda activo de forma permanente.
      setSesionNueva(CODIGOS_SESION_VENCIDA.includes(r.errorCodigo ?? ""));
      const guardado = {
        periodo,
        ejecutadaEn: new Date().toISOString(),
        resultado: r,
      };
      setUltima(guardado);
      try {
        sessionStorage.setItem(CLAVE_ULTIMA_PRUEBA, JSON.stringify(guardado));
      } catch {
        /* almacenamiento no disponible: el resultado solo vive en memoria */
      }
      // La prueba controlada siempre usa API Gateway: nunca textos del mock.
      const m = mensajeProveedor({
        proveedor: "api_gateway",
        codigo: r.errorCodigo,
        mensaje: r.mensaje,
        productosVerificados,
      });
      if (m.tono === "error") toast.error(m.texto);
      else if (m.tono === "warning") toast.warning(m.texto);
      else if (m.tono === "info") toast.info(m.texto);
      else toast.success(m.texto);
      // Tras una consulta real hay datos nuevos guardados: refrescamos el panel.
      if (m.tono !== "error") await refrescarDatos();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No pudimos completar la prueba.",
      );
    } finally {
      // La clave se descarta siempre, funcione o falle la consulta.
      setClave("");
      setEjecutando(false);
    }
  };
  // Cuando el usuario pide "Actualizar" con proveedor real, traemos el formulario
  // a la vista para que ingrese su clave (nunca se guarda).
  useEffect(() => {
    if (solicitudActualizacionReal > 0) {
      contenedorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [solicitudActualizacionReal]);




  /** Auditoría del JSON del F29: máximo dos consultas reales, sin reintentos. */
  const auditar = async () => {
    if (!empresaActiva) return;
    setAuditando(true);
    try {
      const r = await apiGatewayService.auditarF29({
        companyId: empresaActiva.id,
        periodo,
        rutUsuario,
        claveTributaria: clave,
      });
      setAuditoria(r);
      toast.info(r.conclusionTexto);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No pudimos completar la auditoría.",
      );
    } finally {
      setClave("");
      setAuditando(false);
    }
  };

  return (
    <SectionCard
      titulo="Prueba controlada con el proveedor real"
      descripcion="Consulta única a tu información real del SII a través del proveedor autorizado. Se ejecuta desde el servidor y consume créditos."
      acciones={<PlugZap className="h-5 w-5 text-primary" aria-hidden />}
    >
      <div className="rounded-2xl border border-warning/40 bg-warning-soft px-3 py-3 text-sm">
        <p className="flex items-start gap-2 font-medium">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Esta es la única parte de la aplicación que consulta información real.
        </p>
        <p className="mt-1 text-muted-foreground">
          Tu clave se usa solo durante la consulta, viaja cifrada al servidor y no
          se guarda en la base de datos ni en este navegador. Las cifras siguen
          siendo una estimación informativa y no reemplazan a tu contador.
        </p>
      </div>

      <div className="mt-4 rounded-2xl bg-secondary/60 p-4">
        <DataRow label="Estado de la configuración" value={diagnostico.etiqueta} />
        <DataRow
          label="Créditos disponibles"
          value={
            diagnostico.creditosDisponibles == null
              ? "—"
              : String(diagnostico.creditosDisponibles)
          }
        />
        <DataRow
          label="Módulos habilitados"
          value={String(diagnostico.modulosHabilitados.length || "—")}
        />
        <DataRow label="Verificado" value={formatFechaHora(diagnostico.verificadoEn)} />
      </div>

      <div className="mt-3 space-y-2">
        {productos.map((p) => (
          <div
            key={p.clave}
            className={`rounded-2xl border px-3 py-2 text-sm ${
              ESTILO_PRODUCTO[p.estado] ?? "border-border bg-card"
            }`}
          >
            <p className="font-medium">
              {p.titulo}: <span className="font-normal">{p.etiqueta}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {p.estado === "no_verificado"
                ? "Los productos RCV y F29 todavía no fueron verificados en esta ejecución."
                : p.detalle}
            </p>
          </div>
        ))}

        {sondeo && (
          <p className="text-xs text-muted-foreground">
            Productos verificados el {formatFechaHora(sondeo.verificadoEn)}.
          </p>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={comprobandoProductos}
          onClick={comprobarProductos}
        >
          {comprobandoProductos ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Stethoscope className="mr-2 h-4 w-4" aria-hidden />
          )}
          {sondeo ? "Comprobar nuevamente" : "Comprobar productos contratados"}
        </Button>
      </div>



      {diagnostico.modulosPendientes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {diagnostico.modulosPendientes.map((m) => (
            <li key={m.modulo}>
              {m.modulo}: {m.motivo}
            </li>
          ))}
        </ul>
      )}

      <form
        id="form-sii-consulta"
        name="form-sii-consulta"
        method="post"
        action="#"
        onSubmit={(e) => {
          e.preventDefault();
          if (!acepta || !rutUsuario || !clave || ejecutando) return;
          void ejecutar();
        }}
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sii_username">RUT del usuario autorizado</Label>
            <Input
              id="sii_username"
              name="sii_username"
              type="text"
              inputMode="text"
              autoComplete="section-sii username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="12345678-9"
              value={rutUsuario}
              onChange={(e) => setRutUsuario(e.target.value)}
              onBlur={() =>
                esRutValido(rutUsuario) && setRutUsuario(formatearRut(rutUsuario))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sii_password">Clave Tributaria</Label>
            <Input
              id="sii_password"
              name="sii_password"
              type="password"
              autoComplete="section-sii current-password"
              autoCapitalize="none"
              spellCheck={false}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="periodo-real">Periodo a consultar</Label>
            <Input
              id="periodo-real"
              name="sii_periodo"
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3 space-y-1 rounded-2xl bg-secondary/60 px-3 py-3 text-xs text-muted-foreground">
          <p>
            Puedes utilizar el gestor de contraseñas de tu navegador o dispositivo
            para completar esta clave. Mi Negocio al Día no almacena tu Clave
            Tributaria.
          </p>
          <p>No guardes la clave en un computador o teléfono compartido.</p>
        </div>

        <div className="mt-3 flex items-start gap-2">
          <Checkbox
            id="consentimiento-real"
            checked={acepta}
            onCheckedChange={(v) => setAcepta(v === true)}
          />
          <Label htmlFor="consentimiento-real" className="text-sm leading-snug">
            Autorizo esta consulta puntual a mi información del SII para el periodo{" "}
            {periodo}.
          </Label>
        </div>

        {sesionNueva && (
          <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
            La sesión del SII utilizada por el proveedor venció. La próxima consulta
            creará una sesión nueva por única vez.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={
              !acepta || !rutUsuario || !clave || ejecutando || !diagnostico.puedeConsultar
            }
          >
            {ejecutando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <KeyRound className="h-4 w-4" aria-hidden />
            )}
            {ejecutando ? "Consultando" : `Ejecutar prueba de ${periodo}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!empresaActiva || ejecutando}
            onClick={async () => {
              if (!empresaActiva) return;
              try {
                await apiGatewayService.desconectar(empresaActiva.id);
                setUltima(null);
                try {
                  sessionStorage.removeItem(CLAVE_ULTIMA_PRUEBA);
                } catch {
                  /* almacenamiento no disponible */
                }
                toast.success("Cortamos la conexión con el proveedor real.");
              } catch {
                toast.error("No pudimos cortar la conexión.");
              }
            }}
          >
            Desconectar proveedor real
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!acepta || !rutUsuario || !clave || auditando || ejecutando}
            onClick={() => void auditar()}
          >
            {auditando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Stethoscope className="h-4 w-4" aria-hidden />
            )}
            {auditando ? "Auditando" : "Auditar Formulario 29 (2 consultas)"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              setCargando(true);
              try {
                setDiagnostico(await apiGatewayService.diagnosticar());
              } finally {
                setCargando(false);
              }
            }}
          >
            <Stethoscope className="h-4 w-4" aria-hidden />
            Revisar configuración
          </Button>
        </div>
      </form>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-success/40 bg-success-soft px-3 py-3 text-sm">
          <p className="font-medium">Actualización segura</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ingresa tu clave o complétala con el gestor de contraseñas de tu
            dispositivo. La clave se utiliza una sola vez y no queda almacenada en Mi
            Negocio al Día.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-secondary/60 px-3 py-3 text-sm opacity-80">
          <p className="font-medium">
            Automatización avanzada{" "}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal">
              No disponible
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Próximamente: actualizaciones programadas mediante un método de
            autorización compatible, sin almacenar tu Clave Tributaria.
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        El autocompletado no equivale a sincronización automática: debes abrir la
        aplicación, autorizar el uso de la credencial en tu dispositivo y pulsar
        Actualizar. Durante el resto del día se utilizan los datos en caché.
      </p>


      {ultima &&
        (() => {
          const r = ultima.resultado;
          const s = r.sincronizacion;
          const m = mensajeProveedor({
            proveedor: "api_gateway",
            codigo: r.errorCodigo,
            mensaje: r.mensaje,
            productosVerificados,
          });
          const estilo =
            m.tono === "error"
              ? "border-destructive/40 bg-destructive/5"
              : m.tono === "warning"
                ? "border-warning/40 bg-warning-soft"
                : m.tono === "info"
                  ? "border-primary/30 bg-info-soft"
                  : "border-success/40 bg-success-soft";
          const detalle = s?.detalleModulos ?? [];
          const nombres = (estados: string[]) =>
            detalle
              .filter((d) => estados.includes(d.estado))
              .map((d) => NOMBRE_MODULO[d.modulo] ?? d.modulo)
              .join(", ") || "—";
          const cat = s?.documentosPorCategoria;
          const estadoGeneral = s
            ? s.estado === "success"
              ? "Completada"
              : s.estado === "partial"
                ? "Parcial"
                : s.estado === "skipped"
                  ? "Omitida"
                  : "Con error"
            : "No se alcanzó a consultar el periodo";

          return (
            <div className={`mt-4 rounded-2xl border p-4 ${estilo}`}>
              <h3 className="text-sm font-semibold">
                Resultado de la última consulta real
              </h3>
              <p className="mt-1 text-sm">{m.texto}</p>
              {s?.inconsistencias?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {s.inconsistencias.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : null}


              <div className="mt-3">
                <DataRow label="Estado general" value={estadoGeneral} />
                <DataRow label="Periodo" value={ultima.periodo} />
                <DataRow label="Fecha y hora" value={formatFechaHora(ultima.ejecutadaEn)} />
                <DataRow
                  label="Documentos informados por el SII"
                  value={String(s?.documentosInformadosResumen ?? 0)}
                />
                <DataRow
                  label="Documentos recibidos en el detalle"
                  value={String(s?.documentosRecibidos ?? 0)}
                />
                <DataRow
                  label="Documentos guardados"
                  value={String(s?.documentosPersistidos ?? 0)}
                />
                <DataRow
                  label="Documentos descartados"
                  value={
                    s?.motivosRechazo?.length
                      ? s.motivosRechazo
                          .map((x) => `${x.cantidad} · ${x.motivo}`)
                          .join(" | ")
                      : String(s?.documentosDescartados ?? 0)
                  }
                />
                {s?.totalesResumen ? (
                  <>
                    <DataRow
                      label="Ventas según el SII"
                      value={`${formatCLP(s.totalesResumen.ventas.totalAmount)} · IVA ${formatCLP(
                        s.totalesResumen.ventas.vatAmount,
                      )}`}
                    />
                    <DataRow
                      label="Compras según el SII"
                      value={`${formatCLP(s.totalesResumen.compras.totalAmount)} · IVA ${formatCLP(
                        s.totalesResumen.compras.vatAmount,
                      )}`}
                    />
                    <DataRow
                      label="Origen de las cifras"
                      value={
                        s.fuenteTotales === "rcv_summary"
                          ? "Resumen oficial del SII (sin detalle de documentos)"
                          : "Detalle de documentos importados"
                      }
                    />
                  </>
                ) : null}

                <DataRow label="Ventas importadas" value={String(cat?.ventas ?? 0)} />
                <DataRow
                  label="Compras registradas"
                  value={String(cat?.comprasRegistro ?? 0)}
                />
                <DataRow
                  label="Compras pendientes"
                  value={String(cat?.comprasPendiente ?? 0)}
                />
                <DataRow
                  label="Compras reclamadas"
                  value={String(cat?.comprasReclamado ?? 0)}
                />
                <DataRow
                  label="Compras no incluidas"
                  value={String(cat?.comprasNoIncluir ?? 0)}
                />
                <DataRow label="Consultas al proveedor" value={String(r.consultas)} />
                <DataRow label="Créditos consumidos" value={String(r.creditosConsumidos)} />
                <DataRow
                  label="Saldo disponible"
                  value={
                    r.creditosDisponibles == null ? "—" : String(r.creditosDisponibles)
                  }
                />
                <DataRow label="Módulos completados" value={nombres(["completado"])} />
                <DataRow
                  label="Módulos omitidos"
                  value={nombres(["no_disponible", "sin_informacion", "omitido", "desde_cache"])}
                />
                <DataRow
                  label="Módulos fallidos"
                  value={nombres([
                    "error_autenticacion",
                    "error_proveedor",
                    "timeout",
                    "respuesta_invalida",
                    "no_contratado",
                  ])}
                />
                {r.errorCodigo ? (
                  <DataRow
                    label="Código de error"
                    value={`${r.errorCodigo} — ${ETIQUETA_ESTADO_MODULO[
                      detalle.find((d) => d.motivo === r.errorCodigo)?.estado ?? ""
                    ] ?? "Revisa el detalle de los módulos"}`}
                  />
                ) : null}
              </div>

              {detalle.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {detalle.map((d) => (
                    <li key={d.modulo}>
                      {NOMBRE_MODULO[d.modulo] ?? d.modulo}:{" "}
                      {ETIQUETA_ESTADO_MODULO[d.estado] ?? d.estado}
                      {d.motivo ? ` (${d.motivo})` : ""}
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
                El Formulario 29 está disponible, pero API Gateway no entrega de forma
                estructurada todos sus conceptos tributarios. Remanente, PPM,
                retenciones y total pagado quedan como desconocidos cuando no llegan
                en la respuesta. Estimación informativa: el resultado definitivo debe
                ser confirmado por tu contador.
              </p>
            </div>
          );
        })()}

      {auditoria && (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-info-soft p-4">
          <h3 className="text-sm font-semibold">
            Auditoría del Formulario 29 · {auditoria.periodo}
          </h3>
          <p className="mt-1 text-sm">{auditoria.conclusionTexto}</p>

          <div className="mt-3">
            <DataRow
              label="Consultas reales ejecutadas"
              value={`${auditoria.consultasEjecutadas} de 2`}
            />
            <DataRow
              label="Créditos antes"
              value={auditoria.creditosAntes == null ? "—" : String(auditoria.creditosAntes)}
            />
            <DataRow
              label="Créditos después"
              value={
                auditoria.creditosDespues == null ? "—" : String(auditoria.creditosDespues)
              }
            />
            <DataRow
              label="Créditos consumidos"
              value={String(auditoria.creditosConsumidos)}
            />
            <DataRow
              label="Folio recibido"
              value={
                auditoria.folioPreservado
                  ? `Preservado (${auditoria.folioEnmascarado})`
                  : "El listado no entregó folio"
              }
            />
          </div>

          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            {auditoria.consultas.map((c) => (
              <li key={c.orden} className="rounded-xl bg-card px-3 py-2">
                <p className="font-medium text-foreground">
                  {c.orden}. {c.titulo}
                </p>
                <p>
                  {c.ejecutada
                    ? `HTTP ${c.estadoHttp ?? "—"} · ${c.contentType ?? "sin tipo"}${
                        c.errorCodigo ? ` · ${c.errorCodigo}` : ""
                      }`
                    : "No ejecutada"}
                </p>
                <p>{c.mensaje}</p>
                {c.analisis ? (
                  <>
                    <p>
                      Envoltura: {c.analisis.envoltura ?? "sin lista"} ·{" "}
                      {c.analisis.elementos} elemento(s)
                    </p>
                    <p>
                      Propiedades del primer registro:{" "}
                      {c.analisis.propiedadesPrimerElemento.join(", ") || "—"}
                    </p>
                    <p>
                      Propiedades anidadas:{" "}
                      {c.analisis.propiedadesAnidadas.join(", ") || "—"}
                    </p>
                    <p>
                      Propiedades no conservadas:{" "}
                      {c.propiedadesDescartadas.join(", ") || "ninguna"}
                    </p>
                  </>
                ) : null}
              </li>
            ))}
          </ul>

          <ul className="mt-3 space-y-1 text-xs">
            {auditoria.conceptos.map((c) => (
              <li key={c.concepto}>
                <span className="font-medium">{c.concepto}:</span> {c.etiqueta}
              </li>
            ))}
          </ul>

          <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
            Esta auditoría no modifica los cálculos ni sobrescribe el Formulario 29
            confirmado por tu contador.
          </p>
        </div>
      )}

    </SectionCard>
  );
}
