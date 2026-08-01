import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/shared/SectionCard";
import {
  BotonCsv,
  CargandoMaster,
  ErrorMaster,
  EtiquetaEstado,
  MetricaMaster,
  SerieBarras,
  TablaMaster,
  useRecursoMaster,
} from "@/components/master/MasterUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cambiarEstadoPagoFn,
  pagosMasterFn,
  registrarPagoManualFn,
} from "@/lib/master.functions";
import { ESTADOS_PAGO } from "@/lib/master";
import type { PagosMaster } from "@/lib/master.server";
import { ETIQUETA_ESTADO } from "@/lib/cuenta";
import { formatCLP, formatFecha, formatFechaHora } from "@/utils/currency";

const TONO_PAGO: Record<string, "success" | "warning" | "danger" | "default"> = {
  aprobado: "success",
  pendiente: "warning",
  vencido: "warning",
  fallido: "danger",
  anulado: "danger",
};

export function ModuloPagos() {
  const { datos, error, cargando, recargar } = useRecursoMaster<PagosMaster>(() =>
    pagosMasterFn(),
  );
  const [empresa, setEmpresa] = useState("");
  const [monto, setMonto] = useState("");
  const [referencia, setReferencia] = useState("");

  if (cargando) return <CargandoMaster texto="Cargando pagos…" />;
  if (error || !datos) return <ErrorMaster mensaje={error ?? "Sin información."} />;

  const registrar = async () => {
    const r = await registrarPagoManualFn({
      data: { companyId: empresa, monto: Number(monto.replace(/\D/g, "")), referencia },
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setMonto("");
    setReferencia("");
    toast.success("Pago registrado.");
    await recargar();
  };

  const cambiarEstado = async (eventoId: string, estado: string) => {
    const r = await cambiarEstadoPagoFn({ data: { eventoId, estado } });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Pago actualizado.");
    await recargar();
  };

  return (
    <div className="space-y-5">
      <SectionCard
        titulo="Pagos y facturación"
        descripcion="Cobros de la suscripción a la plataforma. No tiene relación con el F29 ni con los impuestos del cliente."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricaMaster
            label="Ingresos del mes"
            valor={formatCLP(datos.totales.ingresosMes)}
            tono="success"
          />
          <MetricaMaster label="Pagos aprobados" valor={datos.totales.aprobados} />
          <MetricaMaster
            label="Pendientes"
            valor={datos.totales.pendientes}
            tono={datos.totales.pendientes > 0 ? "warning" : "default"}
          />
          <MetricaMaster label="Fallidos" valor={datos.totales.fallidos} tono="danger" />
          <MetricaMaster label="Vencidos" valor={datos.totales.vencidos} tono="warning" />
          <MetricaMaster label="Cancelaciones" valor={datos.totales.cancelaciones} />
        </div>
        <div className="mt-4">
          <SerieBarras
            datos={datos.ingresos.map((i) => ({ etiqueta: i.mes, valor: i.monto }))}
            formato={formatCLP}
          />
        </div>
      </SectionCard>

      <SectionCard
        titulo="Suscripciones vigentes"
        acciones={
          <BotonCsv
            nombre="suscripciones"
            cabeceras={["Empresa", "Plan", "Estado", "Precio", "Próxima renovación"]}
            filas={datos.suscripciones.map((s) => [
              s.empresa,
              s.plan,
              ETIQUETA_ESTADO[s.estado],
              s.precio ?? 0,
              s.proximaRenovacion ?? "",
            ])}
          />
        }
      >
        <TablaMaster
          cabeceras={["Empresa", "Plan", "Estado", "Precio", "Renovación", "Medio de pago"]}
          filas={datos.suscripciones.map((s) => ({
            clave: s.companyId,
            celdas: [
              s.empresa,
              s.plan,
              ETIQUETA_ESTADO[s.estado],
              s.precio == null ? "—" : formatCLP(s.precio),
              s.proximaRenovacion ? formatFecha(s.proximaRenovacion) : "—",
              s.metodoPago ?? "Por definir",
            ],
          }))}
        />
      </SectionCard>

      <SectionCard
        titulo="Registrar un pago manual"
        descripcion="Úsalo cuando el cliente transfiere fuera de la plataforma."
      >
        <div className="flex flex-wrap items-end gap-2">
          <Select value={empresa} onValueChange={setEmpresa}>
            <SelectTrigger className="h-10 w-[220px]" aria-label="Empresa">
              <SelectValue placeholder="Elige la empresa" />
            </SelectTrigger>
            <SelectContent>
              {datos.suscripciones.map((s) => (
                <SelectItem key={s.companyId} value={s.companyId}>
                  {s.empresa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="w-[140px]"
            inputMode="numeric"
            placeholder="Monto en pesos"
            aria-label="Monto del pago"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          <Input
            className="w-[180px]"
            placeholder="Referencia (opcional)"
            aria-label="Referencia"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
          />
          <Button
            disabled={!empresa || Number(monto.replace(/\D/g, "")) <= 0}
            onClick={() => void registrar()}
          >
            Registrar pago
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        titulo="Historial de cobros"
        acciones={
          <BotonCsv
            nombre="pagos"
            cabeceras={["Fecha", "Empresa", "Tipo", "Monto", "Estado", "Referencia"]}
            filas={datos.eventos.map((e) => [
              e.fecha,
              e.empresa,
              e.tipo,
              e.monto ?? 0,
              e.estado,
              e.referencia,
            ])}
          />
        }
      >
        <TablaMaster
          cabeceras={["Fecha", "Empresa", "Tipo", "Monto", "Estado", "Cambiar estado"]}
          filas={datos.eventos.slice(0, 100).map((e) => ({
            clave: e.id,
            celdas: [
              formatFechaHora(e.fecha),
              e.empresa,
              e.tipo,
              e.monto == null ? "—" : formatCLP(e.monto),
              <EtiquetaEstado
                key="e"
                texto={e.estado}
                tono={TONO_PAGO[e.estado] ?? "default"}
              />,
              <Select
                key="s"
                value={e.estado}
                onValueChange={(v) => void cambiarEstado(e.id, v)}
              >
                <SelectTrigger className="h-8 w-[140px]" aria-label="Estado del pago">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_PAGO.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>,
            ],
          }))}
        />
      </SectionCard>
    </div>
  );
}
