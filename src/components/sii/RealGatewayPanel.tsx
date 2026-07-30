import { useEffect, useState } from "react";
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
import { formatFechaHora } from "@/utils/currency";
import { mensajeProveedor } from "@/utils/mensajesProveedor";

/** Clave del sondeo guardado para esta sesión del navegador. */
const CLAVE_SONDEO = "mnd.diagnostico-productos";

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
  const { periodoId } = useTaxDashboard();

  const [diagnostico, setDiagnostico] = useState<DiagnosticoApiGateway | null>(null);
  const [cargando, setCargando] = useState(true);
  const [rutUsuario, setRutUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [periodo, setPeriodo] = useState(periodoId);
  const [acepta, setAcepta] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPruebaReal | null>(null);
  const [comprobandoProductos, setComprobandoProductos] = useState(false);
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
      });
      setResultado(r);
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rut-usuario-real">RUT del usuario autorizado</Label>
          <Input
            id="rut-usuario-real"
            inputMode="text"
            autoComplete="off"
            placeholder="12345678-9"
            value={rutUsuario}
            onChange={(e) => setRutUsuario(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clave-real">Clave Tributaria</Label>
          <Input
            id="clave-real"
            type="password"
            autoComplete="off"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="periodo-real">Periodo a consultar</Label>
          <Input
            id="periodo-real"
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
          />
        </div>
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


      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() => void ejecutar()}
          disabled={!acepta || !rutUsuario || !clave || ejecutando || !diagnostico.puedeConsultar}
        >
          {ejecutando ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <KeyRound className="h-4 w-4" aria-hidden />
          )}
          {ejecutando ? "Consultando" : `Ejecutar prueba de ${periodo}`}
        </Button>
        <Button
          variant="outline"
          disabled={!empresaActiva || ejecutando}
          onClick={async () => {
            if (!empresaActiva) return;
            try {
              await apiGatewayService.desconectar(empresaActiva.id);
              setResultado(null);
              toast.success("Cortamos la conexión con el proveedor real.");
            } catch {
              toast.error("No pudimos cortar la conexión.");
            }
          }}
        >
          Desconectar proveedor real
        </Button>
        <Button
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

      {resultado &&
        (() => {
          const m = mensajeProveedor({
            proveedor: "api_gateway",
            codigo: resultado.errorCodigo,
            mensaje: resultado.mensaje,
            productosVerificados,
          });
          const estilo =
            m.tono === "error"
              ? "border-destructive/40 bg-destructive/5"
              : m.tono === "warning"
                ? "border-warning/40 bg-warning-soft"
                : m.tono === "info"
                  ? "border-primary/30 bg-info-soft"
                  : "border-border";
          return (
        <div className={`mt-4 rounded-2xl border p-4 ${estilo}`}>
          <p className="text-sm font-semibold">{m.texto}</p>

          <div className="mt-2">
            <DataRow label="Consultas al proveedor" value={String(resultado.consultas)} />
            <DataRow label="Créditos consumidos" value={String(resultado.creditosConsumidos)} />
            <DataRow
              label="Créditos disponibles"
              value={
                resultado.creditosDisponibles == null
                  ? "—"
                  : String(resultado.creditosDisponibles)
              }
            />
            <DataRow
              label="Documentos recibidos"
              value={String(resultado.sincronizacion?.documentosRecibidos ?? 0)}
            />
            <DataRow
              label="Documentos nuevos"
              value={String(resultado.sincronizacion?.documentosCreados ?? 0)}
            />
            {resultado.sincronizacion?.modulosNoDisponibles.length ? (
              <DataRow
                label="Sin recurso disponible"
                value={resultado.sincronizacion.modulosNoDisponibles.join(", ")}
              />
            ) : null}
          </div>
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

    </SectionCard>
  );
}
