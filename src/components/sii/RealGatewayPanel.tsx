import { useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCompany } from "@/hooks/useCompany";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";
import { useActualizacionMasiva } from "@/hooks/useActualizacionMasiva";
import { apiGatewayService } from "@/services/apiGatewayService";
import type { DiagnosticoApiGateway } from "@/lib/apiGateway.server";
import { formatFechaHora } from "@/utils/currency";
import { esRutValido, formatearRut } from "@/lib/rut";
import {
  esPeriodoValido,
  etiquetaPeriodo,
  normalizarPeriodo,
  periodoSiguiente,
} from "@/lib/periodo";
import { periodoEnCurso } from "@/lib/syncEconomica";

/** Máximo de periodos por trabajo, para no saturar al proveedor. */
const MAX_PERIODOS = 12;

/** Devuelve todos los meses entre dos periodos, ambos incluidos. */
function rangoPeriodos(desde: string, hasta: string): string[] {
  const lista: string[] = [];
  let actual = desde;
  while (actual <= hasta && lista.length <= MAX_PERIODOS) {
    lista.push(actual);
    actual = periodoSiguiente(actual);
  }
  return lista;
}

/**
 * Meses de un año, sin pasarse del mes en curso. Sirve para los atajos
 * "Todo 2025" / "Todo 2026": un año completo cabe justo en un trabajo.
 */
function mesesDelAnio(anio: number, mesEnCurso: string): string[] {
  const meses = Array.from(
    { length: 12 },
    (_, i) => `${anio}-${String(i + 1).padStart(2, "0")}`,
  );
  return meses.filter((p) => p <= mesEnCurso);
}


/**
 * Actualización con la información real del SII.
 *
 * Se pueden elegir varios periodos, seguidos o sueltos. La aplicación trabaja
 * un mes a la vez y el aviso flotante sigue el avance aunque se cambie de
 * pantalla. La clave se usa una vez y nunca se guarda.
 */
export function RealGatewayPanel() {
  const { empresaActiva } = useCompany();
  const { periodoId, solicitudActualizacionReal } = useTaxDashboard();
  const { iniciar, enCurso, terminado, items, totales } = useActualizacionMasiva();
  const contenedorRef = useRef<HTMLDivElement | null>(null);

  const [diagnostico, setDiagnostico] = useState<DiagnosticoApiGateway | null>(null);
  const [cargando, setCargando] = useState(true);
  const [rutUsuario, setRutUsuario] = useState("");
  const [clave, setClave] = useState("");
  /** Periodos elegidos para este trabajo (uno o varios, seguidos o sueltos). */
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [desde, setDesde] = useState(periodoId);
  const [hasta, setHasta] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [habilitando, setHabilitando] = useState(false);

  /** Registra la empresa activa en la lista de prueba controlada. */
  const habilitarEmpresa = async () => {
    if (!empresaActiva?.id) return;
    setHabilitando(true);
    try {
      await apiGatewayService.habilitarEmpresa(empresaActiva.id, true);
      const actualizado = await apiGatewayService.diagnosticar(empresaActiva.id);
      setDiagnostico(actualizado);
      toast.success("Empresa habilitada para la actualización real.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No pudimos habilitar esta empresa.",
      );
    } finally {
      setHabilitando(false);
    }
  };


  const esDueno = empresaActiva?.rol === "owner";

  useEffect(() => {
    if (!empresaActiva?.id) {
      setCargando(false);
      return;
    }
    let vigente = true;
    setCargando(true);
    apiGatewayService
      .diagnosticar(empresaActiva.id)
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
  }, [empresaActiva?.id]);

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

  // Mientras no se agreguen periodos a mano, el trabajo sigue al mes visible.
  useEffect(() => {
    if (seleccionados.length === 0 && periodoId) setDesde(periodoId);
  }, [periodoId, seleccionados.length]);

  if (cargando || !diagnostico?.modoPruebaHabilitado || !esDueno) return null;

  const agregar = () => {
    const inicio = normalizarPeriodo(desde);
    if (!inicio) {
      toast.error("Elige un periodo válido (mes y año).");
      return;
    }
    const fin = normalizarPeriodo(hasta);
    if (fin && fin < inicio) {
      toast.error("El periodo final debe ser posterior al inicial.");
      return;
    }
    const nuevos = fin ? rangoPeriodos(inicio, fin) : [inicio];
    const union = Array.from(new Set([...seleccionados, ...nuevos])).sort();
    if (union.length > MAX_PERIODOS) {
      toast.warning(`Puedes actualizar hasta ${MAX_PERIODOS} periodos por vez.`);
      return;
    }
    setSeleccionados(union);
    setHasta("");
  };

  const quitar = (p: string) =>
    setSeleccionados((prev) => prev.filter((x) => x !== p));

  const listaFinal =
    seleccionados.length > 0
      ? seleccionados
      : [normalizarPeriodo(desde)].filter((p): p is string => !!p);

  const enviar = () => {
    if (!empresaActiva) return;
    if (listaFinal.length === 0) {
      toast.error("Elige al menos un periodo.");
      return;
    }
    iniciar({
      companyId: empresaActiva.id,
      rutUsuario,
      claveTributaria: clave,
      periodos: listaFinal,
    });
    // La clave se descarta del formulario apenas comienza el trabajo.
    setClave("");
    setAcepta(false);
    toast.success(
      listaFinal.length === 1
        ? "Actualizando el periodo elegido"
        : `Actualizando ${listaFinal.length} periodos, uno por uno`,
      {
        description:
          "Puedes cambiar de pantalla: el aviso flotante te mostrará cuando esté listo.",
      },
    );
  };

  return (
    <div ref={contenedorRef} id="actualizar-sii" data-panel="sii-real">
      <SectionCard
        titulo="Actualizar con la información del SII"
        descripcion="Elige uno o varios periodos, ingresa tu clave y la aplicación actualiza tus ventas, tus compras y tu Formulario 29 cuando ya está presentado."
        acciones={<RefreshCw className="h-5 w-5 text-primary" aria-hidden />}
      >
        <form
          id="form-sii-consulta"
          name="form-sii-consulta"
          method="post"
          action="#"
          onSubmit={(e) => {
            e.preventDefault();
            if (!acepta || !rutUsuario || !clave || enCurso) return;
            enviar();
          }}
        >
          {!diagnostico.empresaAutorizada && (
            <div className="mb-4 space-y-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-3 text-sm text-foreground">
              <p>
                Esta empresa aún no está habilitada para la prueba controlada de
                actualización. No se ha realizado ninguna consulta ni se han
                consumido créditos.
              </p>
              <p className="text-xs text-muted-foreground">
                Al habilitarla, autorizas consultas reales al proveedor para esta
                empresa. Puedes hacerlo solo si eres el dueño.
              </p>
              <Button
                type="button"
                variant="secondary"
                disabled={habilitando}
                onClick={habilitarEmpresa}
              >
                {habilitando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                )}
                Habilitar esta empresa
              </Button>
            </div>
          )}

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
              <Label htmlFor="periodo-real">Periodo (o inicio del rango)</Label>
              <Input
                id="periodo-real"
                name="sii_periodo"
                type="month"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="periodo-real-hasta">Hasta (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  id="periodo-real-hasta"
                  name="sii_periodo_hasta"
                  type="month"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                />
                <Button type="button" variant="secondary" onClick={agregar}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Agregar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Deja "Hasta" vacío para agregar un mes suelto.
              </p>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-xs font-medium text-foreground">
              Periodos por actualizar ({listaFinal.length})
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {listaFinal.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs text-foreground"
                >
                  {etiquetaPeriodo(p)}
                  {seleccionados.length > 0 && (
                    <button
                      type="button"
                      onClick={() => quitar(p)}
                      aria-label={`Quitar ${etiquetaPeriodo(p)}`}
                      className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Se actualizan de a uno, en orden. Puedes cambiar de pantalla mientras
              tanto.
            </p>
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
              Autorizo actualizar mi información del SII para{" "}
              {listaFinal.length === 1
                ? `${etiquetaPeriodo(listaFinal[0])} (${listaFinal[0]})`
                : `${listaFinal.length} periodos seleccionados`}
              .
            </Label>
          </div>

          <div className="mt-4">
            <Button
              type="submit"
              disabled={
                !acepta ||
                !rutUsuario ||
                !clave ||
                enCurso ||
                listaFinal.length === 0 ||
                !listaFinal.every((p) => esPeriodoValido(p)) ||
                !diagnostico.puedeConsultar
              }
            >
              {enCurso ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <KeyRound className="h-4 w-4" aria-hidden />
              )}
              {enCurso ? "Actualizando" : "Actualizar"}
            </Button>
          </div>
        </form>

        {(enCurso || terminado) && items.length > 0 && (
          <div className="mt-4 rounded-2xl border border-border p-4 text-sm">
            <p className="font-semibold">
              {enCurso
                ? "Actualización en curso"
                : "Listo: evaluación de periodos actualizados"}
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {items.map((i) => (
                <li key={i.periodo}>
                  <span className="font-medium">{etiquetaPeriodo(i.periodo)}:</span>{" "}
                  {i.mensaje ??
                    (i.estado === "en_curso" ? "Actualizando…" : "En espera")}
                  {i.f29 ? ` · ${i.f29}` : ""}
                </li>
              ))}
            </ul>
            {terminado && (
              <p className="mt-2 text-xs text-muted-foreground">
                {totales.listos} al día · {totales.avisos} por revisar ·{" "}
                {totales.errores} con problema. {formatFechaHora(new Date().toISOString())}.
                Estimación informativa: no reemplaza a tu contador.
              </p>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
