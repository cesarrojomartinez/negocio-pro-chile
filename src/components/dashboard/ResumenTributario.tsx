import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DataRow, SectionCard } from "@/components/shared/SectionCard";
import { formatCLP } from "@/utils/currency";
import { descripcionOrigenEstimacion, textoRemanente } from "@/lib/f29Antecedent";
import type { ConciliacionF29 } from "@/lib/f29Reconciliation";
import type { FuentePeriodo, ResumenMensual } from "@/types/tax";
import { MargenSelector } from "./MargenSelector";

export function ResumenTributario({
  resumen,
  margenPorcentaje,
  onCambiarMargen,
  mostrarSelectorMargen = true,
  fuentePeriodo,
  conciliacion,
}: {
  resumen: ResumenMensual;
  margenPorcentaje: number;
  onCambiarMargen: (v: number) => void;
  mostrarSelectorMargen?: boolean;
  /** Origen real de la información del periodo seleccionado. */
  fuentePeriodo: FuentePeriodo;
  /** Comparación interna con el Formulario 29 oficial del periodo. */
  conciliacion?: ConciliacionF29;
}) {
  const oficial = conciliacion?.hayOficial === true;
  return (
    <SectionCard
      titulo={oficial ? "Resultado tributario del mes" : "Estimación tributaria del mes"}
      descripcion={
        oficial
          ? "Cifras tomadas del Formulario 29 oficial del periodo."
          : descripcionOrigenEstimacion(fuentePeriodo)
      }
    >

      <div className="rounded-2xl bg-secondary/60 p-4">
        <DataRow
          label="IVA débito por ventas"
          value={formatCLP(resumen.ivaDebito)}
        />
        <DataRow
          label="IVA crédito por compras"
          value={`−${formatCLP(resumen.ivaCredito)}`}
          tone="success"
        />
        <DataRow
          label="Remanente anterior"
          value={`−${formatCLP(resumen.remanenteAnterior)}`}
          tone="success"
          hint={textoRemanente(
            resumen.remanenteAnterior,
            resumen.fuenteRemanente,
            formatCLP,
          )}
        />
        <DataRow
          label="IVA estimado por pagar"
          value={formatCLP(resumen.ivaEstimado)}
          strong
          tone={resumen.ivaEstimado > 0 ? "default" : "success"}
          hint={
            resumen.ivaEstimado === 0
              ? "Con los datos actuales no habría IVA por pagar."
              : undefined
          }
        />
        <DataRow
          label="Nuevo remanente estimado"
          value={formatCLP(resumen.nuevoRemanente)}
          tone={resumen.nuevoRemanente > 0 ? "success" : "default"}
          hint={
            resumen.nuevoRemanente > 0
              ? "Podría utilizarse como crédito en el próximo periodo."
              : "Sin remanente estimado para el próximo periodo."
          }
        />
        <DataRow
          label="PPM estimado"
          value={resumen.ppmPendiente ? "Por confirmar" : formatCLP(resumen.ppmEstimado)}
          tone={resumen.ppmPendiente ? "warning" : "default"}
          hint={
            resumen.ppmPendiente
              ? "Aún no conocemos tu tasa de PPM para este mes, así que no lo sumamos al total. Actualiza el periodo o confírmala con tu contador."
              : undefined
          }
        />
        <DataRow
          label="Retenciones estimadas"
          value={formatCLP(resumen.retencionesEstimadas)}
        />
        <DataRow
          label={
            resumen.ppmPendiente
              ? "Total tributario estimado (sin PPM)"
              : "Total tributario estimado"
          }
          value={formatCLP(resumen.totalTributarioEstimado)}
          strong
        />

        <DataRow
          label={`Margen preventivo (${margenPorcentaje}%)`}
          value={formatCLP(resumen.margenPreventivo)}
        />
        <DataRow
          label="Reserva recomendada"
          value={formatCLP(resumen.reservaRecomendada)}
          strong
          tone="primary"
        />
      </div>

      {mostrarSelectorMargen && (
        <div className="mt-4">
          <MargenSelector valor={margenPorcentaje} onCambiar={onCambiarMargen} />
        </div>
      )}

      <Accordion type="single" collapsible className="mt-4">
        <AccordionItem value="explicacion" className="border-b-0">
          <AccordionTrigger className="text-sm font-semibold">
            {oficial
              ? "¿De dónde salen estas cifras?"
              : "¿Cómo se calcula esta estimación?"}
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm text-muted-foreground">
            {oficial ? (
              <>
                <p>
                  Estos montos vienen del Formulario 29 presentado por este periodo:{" "}
                  {conciliacion?.conceptosOficiales.join(", ").toLowerCase()}.
                </p>
                {conciliacion?.ajustado ? (
                  <div>
                    <p className="font-medium text-foreground">
                      Corregimos lo que habíamos estimado:
                    </p>
                    <ul className="mt-1 space-y-1">
                      {conciliacion.diferencias.map((d) => (
                        <li key={d.id}>
                          {d.concepto}: estimábamos {formatCLP(d.estimado)} y el
                          formulario indica {formatCLP(d.oficial)} (
                          {d.diferencia > 0 ? "+" : "−"}
                          {formatCLP(Math.abs(d.diferencia))}).
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p>
                    Nuestra estimación coincidió con el formulario oficial en todos los
                    conceptos.
                  </p>
                )}
              </>
            ) : (
              <p>
                El IVA estimado considera el IVA de las ventas, el crédito disponible de
                compras y el remanente registrado. El PPM y las retenciones se muestran
                por separado. El resultado definitivo puede variar cuando tu contador
                prepare el Formulario 29.
              </p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <p className="mt-3 text-xs text-muted-foreground">
        {oficial
          ? "Cifras del Formulario 29 oficial. Información referencial: no reemplaza a tu contador."
          : "Estimación informativa. El resultado definitivo debe ser confirmado por tu contador."}
      </p>

    </SectionCard>
  );
}
