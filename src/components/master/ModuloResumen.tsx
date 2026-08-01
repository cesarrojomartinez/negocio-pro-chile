import { SectionCard } from "@/components/shared/SectionCard";
import {
  CargandoMaster,
  ErrorMaster,
  MetricaMaster,
  SerieBarras,
  useRecursoMaster,
} from "@/components/master/MasterUI";
import { resumenMasterFn } from "@/lib/master.functions";
import type { ResumenMaster } from "@/lib/master.server";
import { formatCLP, formatFechaHora, formatNumero } from "@/utils/currency";
import { AlertTriangle } from "lucide-react";

export function ModuloResumen() {
  const { datos, error, cargando } = useRecursoMaster<ResumenMaster>(() =>
    resumenMasterFn(),
  );

  if (cargando) return <CargandoMaster texto="Cargando el resumen…" />;
  if (error || !datos) return <ErrorMaster mensaje={error ?? "Sin información."} />;

  const t = datos.totales;

  return (
    <div className="space-y-5">
      <SectionCard
        titulo="Resumen general"
        descripcion="Estado de la plataforma en el mes en curso. No consulta al SII ni consume créditos."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricaMaster label="Clientes registrados" valor={t.clientes} />
          <MetricaMaster label="Activos" valor={t.activos} tono="success" />
          <MetricaMaster label="En prueba" valor={t.enPrueba} tono="primary" />
          <MetricaMaster label="Suspendidos" valor={t.suspendidos} tono="warning" />
          <MetricaMaster label="Ingresos del mes" valor={formatCLP(t.ingresosMes)} />
          <MetricaMaster
            label="Pagos pendientes"
            valor={t.pagosPendientes}
            tono={t.pagosPendientes > 0 ? "warning" : "default"}
          />
          <MetricaMaster
            label="Consumo API del mes"
            valor={formatNumero(t.consumoMes)}
            hint="Unidades usadas"
          />
          <MetricaMaster
            label="Errores recientes"
            valor={t.erroresRecientes}
            tono={t.erroresRecientes > 0 ? "danger" : "default"}
          />
          <MetricaMaster label="Nuevas empresas" valor={t.nuevasEmpresas} />
          <MetricaMaster label="Conversiones a pago" valor={t.conversiones} />
        </div>
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard titulo="Ingresos por mes" descripcion="Suscripciones aprobadas.">
          <SerieBarras
            datos={datos.ingresos.map((i) => ({ etiqueta: i.mes, valor: i.monto }))}
            formato={formatCLP}
          />
        </SectionCard>

        <SectionCard titulo="Consumo de créditos por mes">
          <SerieBarras
            datos={datos.consumo.map((c) => ({ etiqueta: c.mes, valor: c.unidades }))}
            formato={formatNumero}
          />
        </SectionCard>

        <SectionCard titulo="Clientes por estado">
          <SerieBarras
            datos={datos.porEstado.map((e) => ({
              etiqueta: e.estado,
              valor: e.cantidad,
            }))}
            formato={formatNumero}
          />
        </SectionCard>

        <SectionCard titulo="Altas y bajas">
          <SerieBarras
            datos={datos.altasBajas.map((a) => ({
              etiqueta: a.mes,
              valor: a.altas - a.bajas,
            }))}
            formato={(v) => (v >= 0 ? `+${v}` : String(v))}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Diferencia neta entre empresas nuevas y bajas del mes.
          </p>
        </SectionCard>
      </div>

      <SectionCard
        titulo="Alertas operativas"
        descripcion="Errores de actualización, consumo alto y pagos por revisar."
      >
        {datos.alertas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin alertas por ahora.</p>
        ) : (
          datos.alertas.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-start gap-2 border-b border-border/70 py-2.5 last:border-0"
            >
              <AlertTriangle
                className={
                  "mt-0.5 h-4 w-4 shrink-0 " +
                  (a.severidad === "critical"
                    ? "text-destructive"
                    : "text-warning-foreground")
                }
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-sm">{a.mensaje}</p>
                <p className="text-xs text-muted-foreground">
                  {a.empresa ?? "Plataforma"} · {formatFechaHora(a.fecha)}
                </p>
              </div>
            </div>
          ))
        )}
      </SectionCard>
    </div>
  );
}
