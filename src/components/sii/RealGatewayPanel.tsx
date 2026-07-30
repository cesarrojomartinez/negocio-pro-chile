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

  /** Sondeo opcional: verifica productos contratados y consume pocos créditos. */
  const comprobarProductos = async () => {
    setComprobandoProductos(true);
    try {
      setDiagnostico(await apiGatewayService.diagnosticar(true));
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

  const ejecutar = async () => {
    if (!empresaActiva) return;
    setEjecutando(true);
    try {
      const r = await apiGatewayService.ejecutarPrueba({
        companyId: empresaActiva.id,
        periodo: periodoId,
        rutUsuario,
        claveTributaria: clave,
      });
      setResultado(r);
      // La clave se descarta inmediatamente después de usarla.
      setClave("");
      if (r.errorCodigo) toast.error(r.mensaje);
      else toast.success(r.mensaje);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No pudimos completar la prueba.",
      );
    } finally {
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
        {diagnostico.productos.map((p) => (
          <div
            key={p.clave}
            className="rounded-2xl border border-border bg-card px-3 py-2 text-sm"
          >
            <p className="font-medium">
              {p.titulo}: <span className="font-normal">{p.etiqueta}</span>
            </p>
            <p className="text-xs text-muted-foreground">{p.detalle}</p>
          </div>
        ))}
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
          Comprobar productos contratados
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
      </div>

      <div className="mt-3 flex items-start gap-2">
        <Checkbox
          id="consentimiento-real"
          checked={acepta}
          onCheckedChange={(v) => setAcepta(v === true)}
        />
        <Label htmlFor="consentimiento-real" className="text-sm leading-snug">
          Autorizo esta consulta puntual a mi información del SII para el periodo{" "}
          {periodoId}.
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
          {ejecutando ? "Consultando" : `Ejecutar prueba de ${periodoId}`}
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

      {resultado && (
        <div className="mt-4 rounded-2xl border border-border p-4">
          <p className="text-sm font-semibold">{resultado.mensaje}</p>
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
        </div>
      )}
    </SectionCard>
  );
}
