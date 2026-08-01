import { useState } from "react";

import { SectionCard } from "@/components/shared/SectionCard";
import {
  CargandoMaster,
  ErrorMaster,
  MetricaMaster,
  useRecursoMaster,
} from "@/components/master/MasterUI";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { metricasMasterFn } from "@/lib/master.functions";
import type { MetricasMaster } from "@/lib/master.server";
import { formatCLP, formatPorcentaje } from "@/utils/currency";

export function ModuloMetricas() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [plan, setPlan] = useState("");
  const { datos, error, cargando } = useRecursoMaster<MetricasMaster>(() =>
    metricasMasterFn({ data: {} }),
  );
  const [filtrado, setFiltrado] = useState<MetricasMaster | null>(null);
  const vista = filtrado ?? datos;

  if (cargando) return <CargandoMaster texto="Cargando métricas…" />;
  if (error || !vista) return <ErrorMaster mensaje={error ?? "Sin información."} />;

  const aplicar = async () => {
    const r = await metricasMasterFn({
      data: { desde: desde || null, hasta: hasta || null, planCodigo: plan || null },
    });
    if (r.ok) setFiltrado(r.data);
  };

  return (
    <SectionCard
      titulo="Métricas de la plataforma"
      descripcion="Uso, crecimiento y retención. Son cifras internas, no tributarias."
      acciones={
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            className="h-9 w-[150px]"
            aria-label="Desde"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
          <Input
            type="date"
            className="h-9 w-[150px]"
            aria-label="Hasta"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            <option value="">Todos los planes</option>
            {vista.planes.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={() => void aplicar()}>
            Aplicar
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricaMaster label="Usuarios activos" valor={vista.usuariosActivos} />
        <MetricaMaster label="Empresas activas" valor={vista.empresasActivas} />
        <MetricaMaster label="Nuevas altas" valor={vista.nuevasAltas} />
        <MetricaMaster
          label="Conversión a pago"
          valor={formatPorcentaje(vista.tasaConversion)}
          tono="success"
        />
        <MetricaMaster label="Cancelaciones" valor={vista.cancelaciones} tono="warning" />
        <MetricaMaster label="Retención" valor={formatPorcentaje(vista.retencion)} />
        <MetricaMaster
          label="Ingreso mensual recurrente"
          valor={formatCLP(vista.ingresoMensual)}
        />
        <MetricaMaster label="Uso promedio por empresa" valor={vista.usoPromedio} />
        <MetricaMaster
          label="Errores"
          valor={vista.errores}
          tono={vista.errores > 0 ? "danger" : "default"}
        />
        <MetricaMaster label="Consultas evitadas con caché" valor={vista.usoCache} />
        <MetricaMaster
          label="Clientes sin actividad"
          valor={vista.clientesSinActividad}
          tono={vista.clientesSinActividad > 0 ? "warning" : "default"}
        />
      </div>
    </SectionCard>
  );
}
