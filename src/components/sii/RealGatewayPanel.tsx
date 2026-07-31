import { useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCompany } from "@/hooks/useCompany";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";
import { apiGatewayService } from "@/services/apiGatewayService";
import type { DiagnosticoApiGateway } from "@/lib/apiGateway.server";
import { formatFechaHora } from "@/utils/currency";
import { mensajeProveedor } from "@/utils/mensajesProveedor";
import { esRutValido, formatearRut } from "@/lib/rut";
import { esPeriodoValido, etiquetaPeriodo, normalizarPeriodo } from "@/lib/periodo";


/** Códigos que indican sesión vencida del proveedor (no clave incorrecta). */
const CODIGOS_SESION_VENCIDA = ["SESSION_INVALID", "SESSION_EXPIRED", "AUTH_EXPIRED"];

/**
 * Actualización del periodo con la información real del SII.
 *
 * Un solo paso para la persona: RUT, Clave Tributaria y Actualizar. La
 * aplicación trae las ventas y compras, busca el Formulario 29 del mismo
 * periodo, lo guarda y completa los cálculos. La clave se usa una vez y nunca
 * se guarda.
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
  /** Última vez que el usuario tocó el selector de este formulario. */
  const [periodoManual, setPeriodoManual] = useState(false);

  const [acepta, setAcepta] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  /** Resumen simple de la última actualización, sin lenguaje técnico. */
  const [resumen, setResumen] = useState<{
    periodo: string;
    fecha: string;
    texto: string;
    tono: "success" | "warning" | "error" | "info";
    f29: string;
    /** Verdadero cuando el RCV quedó al día pero el F29 no se pudo leer. */
    f29Pendiente: boolean;

  } | null>(null);

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

  // Cuando el usuario pide "Actualizar", traemos el formulario a la vista y
  // dejamos el cursor en el primer dato que falta (la clave nunca se guarda).
  useEffect(() => {
    if (solicitudActualizacionReal === 0) return;
    contenedorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const id = window.setTimeout(() => {
      const objetivo = document.getElementById(
        rutUsuario ? "sii_password" : "sii_username",
      ) as HTMLInputElement | null;
      objetivo?.focus();
    }, 350);
    return () => window.clearTimeout(id);
    // Solo reacciona a la solicitud, no a lo que se va escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudActualizacionReal]);


  // El formulario SIEMPRE sigue al periodo elegido en la pantalla, salvo que la
  // persona haya elegido otro mes aquí mismo. Antes el valor quedaba congelado
  // en el periodo que estaba activo al montar el panel y se actualizaba un mes
  // distinto al seleccionado.
  useEffect(() => {
    if (!periodoManual && periodoId && periodoId !== periodo) setPeriodo(periodoId);
  }, [periodoId, periodoManual, periodo]);

  if (cargando || !diagnostico?.modoPruebaHabilitado || !esDueno) return null;

  const actualizar = async () => {
    if (!empresaActiva) return;
    // El periodo viaja como texto AAAA-MM: nunca se convierte a fecha.
    const periodoSolicitado = normalizarPeriodo(periodo);
    if (!periodoSolicitado) {
      toast.error("Elige un periodo válido (mes y año).");
      return;
    }
    setEjecutando(true);
    try {
      const r = await apiGatewayService.ejecutarPrueba({
        companyId: empresaActiva.id,
        periodo: periodoSolicitado,
        rutUsuario,
        claveTributaria: clave,
        sesionNueva,
      });
      // `auth_cache=0` nunca queda activo de forma permanente.
      setSesionNueva(CODIGOS_SESION_VENCIDA.includes(r.errorCodigo ?? ""));
      const m = mensajeProveedor({
        proveedor: "api_gateway",
        codigo: r.errorCodigo,
        mensaje: r.mensaje,
        productosVerificados: true,
      });
      setResumen({
        // El servidor devuelve el periodo que realmente actualizó.
        periodo: r.sincronizacion?.periodo ?? periodoSolicitado,
        fecha: new Date().toISOString(),
        texto: m.texto,
        tono: m.tono as "success" | "warning" | "error" | "info",
        f29: r.f29.mensaje,
        f29Pendiente: r.f29.estado === "revisar" || r.f29.estado === "no_declarado",

      });

      if (m.tono === "error") toast.error(m.texto);
      else if (m.tono === "warning") toast.warning(m.texto);
      else if (m.tono === "info") toast.info(m.texto);
      else toast.success(m.texto);
      // Tras la actualización hay datos nuevos guardados: refrescamos el panel.
      if (m.tono !== "error") await refrescarDatos();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No pudimos completar la actualización.",
      );
    } finally {
      // La clave se descarta siempre, funcione o falle la actualización.
      setClave("");
      setEjecutando(false);
    }
  };

  const estilo =
    resumen?.tono === "error"
      ? "border-destructive/40 bg-destructive/5"
      : resumen?.tono === "warning"
        ? "border-warning/40 bg-warning-soft"
        : resumen?.tono === "info"
          ? "border-primary/30 bg-info-soft"
          : "border-success/40 bg-success-soft";

  return (
    <div ref={contenedorRef} id="actualizar-sii" data-panel="sii-real">
      <SectionCard
        titulo="Actualizar con la información del SII"
        descripcion="Elige el periodo, ingresa tu clave y la aplicación actualiza tus ventas, tus compras y tu Formulario 29 cuando ya está presentado."
        acciones={<RefreshCw className="h-5 w-5 text-primary" aria-hidden />}
      >
        <form
          id="form-sii-consulta"
          name="form-sii-consulta"
          method="post"
          action="#"
          onSubmit={(e) => {
            e.preventDefault();
            if (!acepta || !rutUsuario || !clave || ejecutando) return;
            void actualizar();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
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
              <Label htmlFor="periodo-real">Periodo</Label>
              <Input
                id="periodo-real"
                name="sii_periodo"
                type="month"
                value={periodo}
                onChange={(e) => {
                  setPeriodoManual(true);
                  setPeriodo(e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Se actualizará {etiquetaPeriodo(periodo)} ({periodo}).
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-1 rounded-2xl bg-secondary/60 px-3 py-3 text-xs text-muted-foreground">
            <p>
              Tu clave se usa solo durante esta actualización, viaja cifrada al
              servidor y no queda guardada en la aplicación ni en este navegador.
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
              Autorizo actualizar mi información del SII para {etiquetaPeriodo(periodo)}{" "}
              ({periodo}).
            </Label>
          </div>


          {sesionNueva && (
            <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-xs">
              La sesión anterior venció. La próxima actualización abrirá una sesión
              nueva por única vez.
            </p>
          )}

          <div className="mt-4">
            <Button
              type="submit"
              disabled={
                !acepta ||
                !rutUsuario ||
                !clave ||
                ejecutando ||
                !esPeriodoValido(normalizarPeriodo(periodo) ?? "") ||
                !diagnostico.puedeConsultar
              }

            >
              {ejecutando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <KeyRound className="h-4 w-4" aria-hidden />
              )}
              {ejecutando ? "Actualizando" : "Actualizar"}
            </Button>
          </div>
        </form>

        {resumen && (
          <div className={`mt-4 rounded-2xl border p-4 text-sm ${estilo}`}>
            <p className="font-semibold">
              Última actualización · {etiquetaPeriodo(resumen.periodo)}
            </p>
            <p className="mt-1">{resumen.texto}</p>
            <p
              className={`mt-1 ${
                resumen.f29Pendiente ? "text-amber-700" : "text-muted-foreground"
              }`}
            >
              {resumen.f29}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatFechaHora(resumen.fecha)}. Estimación informativa: no reemplaza a
              tu contador.
            </p>
          </div>
        )}

      </SectionCard>
    </div>
  );
}
