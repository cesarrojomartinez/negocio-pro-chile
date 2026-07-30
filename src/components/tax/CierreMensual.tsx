import { useCallback, useEffect, useState } from "react";
import { CalendarCheck2, Clock3, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { DataRow, SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { periodoService } from "@/services/periodoService";
import type { ResumenPeriodo } from "@/lib/periodLifecycle.server";
import { antiguedadLegible } from "@/lib/freshness";
import { formatCLP, formatFechaHora } from "@/utils/currency";

const FRESCURA: Record<
  string,
  { titulo: string; texto: string; clase: string }
> = {
  never_synced: {
    titulo: "Sin información del SII",
    texto: "Todavía no traemos ventas ni compras de este mes.",
    clase: "border-border bg-secondary/60 text-muted-foreground",
  },
  fresh: {
    titulo: "Información al día",
    texto: "Ya consultamos la información vigente de este periodo.",
    clase: "border-success/30 bg-success-soft text-success",
  },
  stale: {
    titulo: "Conviene actualizar",
    texto: "Puede que existan documentos nuevos desde la última consulta.",
    clase: "border-warning/40 bg-warning-soft text-warning-foreground",
  },
  outdated: {
    titulo: "Información desactualizada",
    texto: "Han pasado varios días. Los montos podrían haber cambiado.",
    clase: "border-warning/40 bg-warning-soft text-warning-foreground",
  },
  closed_period: {
    titulo: "Periodo cerrado",
    texto: "Este mes ya fue revisado y cerrado.",
    clase: "border-primary/30 bg-primary/10 text-primary",
  },
};

const numero = (v: string) => {
  const n = Number(v.replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Ciclo mensual: muestra la frescura de la información, permite pedir la
 * revisión del contador, confirmar los antecedentes del Formulario 29,
 * cerrar el mes y reabrirlo con un motivo.
 */
export function CierreMensual({
  companyId,
  periodo,
  onCambio,
}: {
  companyId: string | null;
  periodo: string;
  onCambio?: () => void;
}) {
  const [resumen, setResumen] = useState<ResumenPeriodo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [dialogF29, setDialogF29] = useState(false);
  const [dialogReapertura, setDialogReapertura] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [form, setForm] = useState({
    iva: "0",
    ppm: "0",
    retenciones: "0",
    remanenteAnterior: "0",
    remanenteNuevo: "0",
    tasaPpm: "",
    basePpm: "",
    folio: "",
    notas: "",
  });

  const cargar = useCallback(() => {
    if (!companyId) {
      setResumen(null);
      return;
    }
    periodoService
      .resumen(companyId, periodo)
      .then(setResumen)
      .catch(() => setResumen(null));
  }, [companyId, periodo]);

  useEffect(() => cargar(), [cargar]);

  useEffect(() => {
    const a = resumen?.antecedentes;
    if (!a) return;
    setForm({
      iva: String(a.ivaDeterminado ?? 0),
      ppm: String(a.ppm ?? 0),
      retenciones: String(a.retenciones ?? 0),
      remanenteAnterior: String(a.remanenteAnterior ?? 0),
      remanenteNuevo: String(a.remanenteNuevo ?? 0),
      tasaPpm: a.tasaPpm != null ? String(a.tasaPpm * 100) : "",
      basePpm: a.basePpm != null ? String(a.basePpm) : "",
      folio: a.folio ?? "",
      notas: a.notas ?? "",
    });
  }, [resumen]);

  if (!companyId || !resumen) return null;

  const frescura = FRESCURA[resumen.sincronizacion?.estadoFrescura ?? "never_synced"];

  async function ejecutar(accion: () => Promise<ResumenPeriodo>, exito: string) {
    setOcupado(true);
    try {
      setResumen(await accion());
      toast.success(exito);
      onCambio?.();
    } catch (e) {
      toast.error("No pudimos completar la acción", {
        description: e instanceof Error ? e.message : "Intenta nuevamente.",
      });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <SectionCard
      titulo="Ciclo del mes"
      descripcion="Revisa, confirma con tu contador y cierra el periodo cuando esté listo."
      acciones={<CalendarCheck2 className="h-5 w-5 text-primary" aria-hidden />}
    >
      <div className={`rounded-2xl border p-4 ${frescura.clase}`}>
        <p className="text-sm font-semibold">{frescura.titulo}</p>
        <p className="mt-0.5 text-sm opacity-90">{frescura.texto}</p>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs opacity-80">
          <Clock3 className="h-3.5 w-3.5" aria-hidden />
          Última consulta{" "}
          {antiguedadLegible(
            resumen.sincronizacion?.ultimaSincronizacionExitosa
              ? Math.floor(
                  (Date.now() -
                    new Date(
                      resumen.sincronizacion.ultimaSincronizacionExitosa,
                    ).getTime()) /
                    3600000,
                )
              : null,
          )}
          {resumen.sincronizacion?.usosDeCache
            ? ` · ${resumen.sincronizacion.usosDeCache} veces reutilizamos la información guardada`
            : ""}
        </p>
      </div>

      <div className="mt-4 rounded-2xl bg-secondary/60 p-4">
        <DataRow label="Estado del periodo" value={resumen.etiqueta} strong />
        <DataRow
          label="Revisión solicitada"
          value={formatFechaHora(resumen.revisionSolicitadaEn)}
        />
        <DataRow label="Confirmado" value={formatFechaHora(resumen.confirmadoEn)} />
        <DataRow label="Cerrado" value={formatFechaHora(resumen.cerradoEn)} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{resumen.descripcion}</p>

      {resumen.motivoReapertura && (
        <p className="mt-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
          Motivo de la reapertura: {resumen.motivoReapertura}
        </p>
      )}

      {resumen.comparacion && (
        <div className="mt-4 rounded-2xl border border-border p-4">
          <p className="text-sm font-semibold">Lo estimado y lo declarado</p>
          <div className="mt-2">
            <DataRow
              label="IVA estimado"
              value={formatCLP(resumen.comparacion.estimadoIva)}
            />
            <DataRow
              label="IVA declarado"
              value={formatCLP(resumen.comparacion.declaradoIva)}
            />
            <DataRow
              label="Total estimado"
              value={formatCLP(resumen.comparacion.estimadoTotal)}
            />
            <DataRow
              label="Total declarado"
              value={formatCLP(resumen.comparacion.declaradoTotal)}
              strong
            />
            <DataRow
              label="Diferencia"
              value={formatCLP(resumen.comparacion.diferencia)}
              tone={
                Math.abs(resumen.comparacion.diferencia) < 1 ? "success" : "warning"
              }
            />
          </div>
          {resumen.comparacion.explicacion && (
            <p className="mt-2 text-xs text-muted-foreground">
              {resumen.comparacion.explicacion}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {resumen.puedePedirRevision && (
          <Button
            variant="outline"
            disabled={ocupado}
            onClick={() =>
              ejecutar(
                () => periodoService.pedirRevision(companyId, periodo),
                "Le avisamos a tu contador que este mes está listo para revisar.",
              )
            }
          >
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Pedir revisión del contador
          </Button>
        )}
        {resumen.puedeConfirmar && (
          <Button disabled={ocupado} onClick={() => setDialogF29(true)}>
            Confirmar antecedentes del F29
          </Button>
        )}
        {resumen.puedeCerrar && (
          <Button
            variant="outline"
            disabled={ocupado}
            onClick={() =>
              ejecutar(
                () => periodoService.cerrar(companyId, periodo),
                "Cerramos este mes. La información queda como referencia.",
              )
            }
          >
            <Lock className="h-4 w-4" aria-hidden />
            Cerrar el mes
          </Button>
        )}
        {resumen.puedeReabrir && (
          <Button
            variant="outline"
            disabled={ocupado}
            onClick={() => setDialogReapertura(true)}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reabrir el mes
          </Button>
        )}
      </div>

      <Dialog open={dialogF29} onOpenChange={setDialogF29}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Antecedentes del Formulario 29</DialogTitle>
            <DialogDescription>
              Copia aquí las cifras del F29 que preparó tu contador. Con ellas dejamos
              de estimar y mostramos los valores confirmados.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: "iva", label: "IVA determinado" },
              { id: "ppm", label: "PPM" },
              { id: "retenciones", label: "Retenciones" },
              { id: "remanenteAnterior", label: "Remanente anterior" },
              { id: "remanenteNuevo", label: "Nuevo remanente" },
              { id: "basePpm", label: "Base imponible del PPM" },
              { id: "tasaPpm", label: "Tasa de PPM (%)" },
              { id: "folio", label: "Folio del F29" },
            ].map((campo) => (
              <div key={campo.id} className="space-y-1.5">
                <Label htmlFor={`f29-${campo.id}`}>{campo.label}</Label>
                <Input
                  id={`f29-${campo.id}`}
                  inputMode={campo.id === "folio" ? "text" : "decimal"}
                  value={form[campo.id as keyof typeof form]}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [campo.id]: e.target.value }))
                  }
                />
              </div>
            ))}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="f29-notas">Notas del contador (opcional)</Label>
              <Textarea
                id="f29-notas"
                value={form.notas}
                onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDialogF29(false)}>
              Cancelar
            </Button>
            <Button
              disabled={ocupado}
              onClick={async () => {
                await ejecutar(
                  () =>
                    periodoService.confirmarF29({
                      companyId,
                      periodo,
                      ivaDeterminado: numero(form.iva),
                      ppm: numero(form.ppm),
                      retenciones: numero(form.retenciones),
                      remanenteAnterior: numero(form.remanenteAnterior),
                      remanenteNuevo: numero(form.remanenteNuevo),
                      tasaPpm: form.tasaPpm ? Number(form.tasaPpm) / 100 : null,
                      basePpm: form.basePpm ? numero(form.basePpm) : null,
                      folio: form.folio || null,
                      notas: form.notas || null,
                    }),
                  "Guardamos los antecedentes confirmados del F29.",
                );
                setDialogF29(false);
              }}
            >
              Guardar y confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogReapertura} onOpenChange={setDialogReapertura}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reabrir el mes</DialogTitle>
            <DialogDescription>
              Cuéntanos por qué necesitas reabrirlo. Dejamos registro del motivo.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Por ejemplo: llegó una factura de compra atrasada."
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDialogReapertura(false)}>
              Cancelar
            </Button>
            <Button
              disabled={ocupado}
              onClick={async () => {
                await ejecutar(
                  () => periodoService.reabrir(companyId, periodo, motivo),
                  "Reabrimos el mes para que puedas corregirlo.",
                );
                setDialogReapertura(false);
                setMotivo("");
              }}
            >
              Reabrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
