import { useState } from "react";

import { SectionCard } from "@/components/shared/SectionCard";
import {
  BotonCsv,
  CargandoMaster,
  ErrorMaster,
  EtiquetaEstado,
  MetricaMaster,
  TablaMaster,
  useRecursoMaster,
} from "@/components/master/MasterUI";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { consumoMasterFn } from "@/lib/master.functions";
import type { ConsumoMaster } from "@/lib/master.server";
import { formatFechaHora, formatNumero } from "@/utils/currency";

export function ModuloConsumo() {
  const [mes, setMes] = useState<string | null>(null);
  const { datos, error, cargando } = useRecursoMaster<ConsumoMaster>(() =>
    consumoMasterFn({ data: { mes } }),
  );
  const [detalle, setDetalle] = useState<ConsumoMaster | null>(null);
  const vista = detalle ?? datos;

  if (cargando) return <CargandoMaster texto="Cargando el consumo…" />;
  if (error || !vista) return <ErrorMaster mensaje={error ?? "Sin información."} />;

  const cambiarMes = async (valor: string) => {
    setMes(valor);
    const r = await consumoMasterFn({ data: { mes: valor } });
    if (r.ok) setDetalle(r.data);
  };

  return (
    <div className="space-y-5">
      <SectionCard
        titulo="Créditos API y consumo"
        descripcion="Cada actualización real al SII consume créditos. Aquí ves cuánto usa cada cliente y qué se evitó con caché."
        acciones={
          <Select value={mes ?? vista.global.mes} onValueChange={(v) => void cambiarMes(v)}>
            <SelectTrigger className="h-9 w-[140px]" aria-label="Mes">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vista.mesesDisponibles.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricaMaster
            label="Unidades usadas"
            valor={formatNumero(vista.global.unidadesTotales)}
          />
          <MetricaMaster
            label="Presupuesto total"
            valor={formatNumero(vista.presupuestoTotal)}
            hint={`${vista.porcentajeUtilizado}% utilizado`}
            tono={vista.porcentajeUtilizado > 80 ? "warning" : "default"}
          />
          <MetricaMaster
            label="Consultas al RCV"
            valor={formatNumero(vista.global.consultasRcv)}
          />
          <MetricaMaster
            label="Consultas al F29"
            valor={formatNumero(vista.global.consultasF29)}
          />
          <MetricaMaster
            label="Evitadas con caché"
            valor={formatNumero(vista.global.consultasEvitadasPorCache)}
            tono="success"
          />
          <MetricaMaster label="PDF nuevos" valor={formatNumero(vista.global.pdfsNuevos)} />
          <MetricaMaster
            label="Errores con costo"
            valor={formatNumero(vista.global.erroresConCosto)}
            tono={vista.global.erroresConCosto > 0 ? "danger" : "default"}
          />
          <MetricaMaster
            label="Fuera del flujo económico"
            valor={formatNumero(vista.global.fueraDeFlujo)}
            tono={vista.global.fueraDeFlujo > 0 ? "warning" : "default"}
          />
        </div>
      </SectionCard>

      <SectionCard
        titulo="Consumo por cliente"
        acciones={
          <BotonCsv
            nombre="consumo-por-cliente"
            cabeceras={["Empresa", "Plan", "Unidades", "Presupuesto", "% usado"]}
            filas={vista.porEmpresa.map((e) => [
              e.empresa,
              e.plan,
              e.resumen.unidadesTotales,
              e.presupuesto,
              e.porcentaje,
            ])}
          />
        }
      >
        <TablaMaster
          cabeceras={["Empresa", "Plan", "Unidades", "Presupuesto", "Uso", "Alertas"]}
          filas={vista.porEmpresa.map((e) => ({
            clave: e.companyId,
            celdas: [
              e.empresa,
              e.plan,
              formatNumero(e.resumen.unidadesTotales),
              formatNumero(e.presupuesto),
              <EtiquetaEstado
                key="u"
                texto={`${e.porcentaje}%`}
                tono={e.porcentaje > 90 ? "danger" : e.porcentaje > 70 ? "warning" : "success"}
              />,
              e.alertas.length === 0 ? (
                "Sin alertas"
              ) : (
                <span key="a" className="space-y-1">
                  {e.alertas.map((a) => (
                    <span key={a.tipo} className="block text-xs">
                      {a.mensaje}
                    </span>
                  ))}
                </span>
              ),
            ],
          }))}
        />
      </SectionCard>

      <SectionCard titulo="Movimientos del mes">
        <TablaMaster
          cabeceras={["Fecha", "Empresa", "Categoría", "Periodo", "Consultas", "Unidades"]}
          filas={vista.movimientos.map((m) => ({
            clave: m.id,
            celdas: [
              formatFechaHora(m.fecha),
              m.empresa,
              m.categoria,
              m.periodo ?? "—",
              `${formatNumero(m.consultas)} (${formatNumero(m.cacheHits)} caché)`,
              formatNumero(m.unidades),
            ],
          }))}
        />
      </SectionCard>
    </div>
  );
}
