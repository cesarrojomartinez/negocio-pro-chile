import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataRow, SectionCard } from "@/components/shared/SectionCard";
import { formatCLP, parseMonto } from "@/utils/currency";
import { simularVentaAdicional } from "@/utils/taxCalculations";

const RAPIDOS = [100000, 500000, 1000000];

export function SimuladorVentas({
  tasaPpm,
  margenPorcentaje,
}: {
  tasaPpm: number;
  margenPorcentaje: number;
}) {
  const [monto, setMonto] = useState(500000);
  const [texto, setTexto] = useState("500000");

  const resultado = useMemo(
    () => simularVentaAdicional(monto, tasaPpm, margenPorcentaje),
    [monto, tasaPpm, margenPorcentaje],
  );

  return (
    <SectionCard
      titulo="¿Qué pasa si vendo más?"
      descripcion="Herramienta informativa. No modifica los datos de tu dashboard."
      acciones={<Calculator className="h-5 w-5 text-primary" aria-hidden />}
    >
      <div className="flex flex-wrap gap-2">
        {RAPIDOS.map((v) => (
          <Button
            key={v}
            type="button"
            variant={monto === v ? "default" : "outline"}
            onClick={() => {
              setMonto(v);
              setTexto(String(v));
            }}
          >
            {formatCLP(v)}
          </Button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <Label htmlFor="monto-simulador">Monto personalizado</Label>
          <Input
            id="monto-simulador"
            inputMode="numeric"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="mt-1 h-11"
          />
        </div>
        <Button type="button" onClick={() => setMonto(parseMonto(texto))}>
          Simular
        </Button>
      </div>

      <div className="mt-4 rounded-2xl bg-secondary/60 p-4">
        <DataRow
          label="Venta adicional"
          value={formatCLP(resultado.ventaAdicional)}
          strong
        />
        <DataRow
          label="IVA incluido aproximado"
          value={formatCLP(resultado.ivaIncluido)}
        />
        <DataRow label="Neto aproximado" value={formatCLP(resultado.neto)} />
        <DataRow
          label="PPM adicional estimado"
          value={formatCLP(resultado.ppmAdicional)}
        />
        <DataRow
          label="Reserva tributaria adicional"
          value={formatCLP(resultado.reservaAdicional)}
          tone="primary"
          strong
        />
        <DataRow
          label="Monto restante antes de costos"
          value={formatCLP(resultado.restanteAntesDeCostos)}
        />
      </div>

      <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
        Una venta de {formatCLP(resultado.ventaAdicional)} no significa que tendrás{" "}
        {formatCLP(resultado.ventaAdicional)} disponibles. Una parte corresponde a
        IVA, PPM y costos del negocio.
      </p>
    </SectionCard>
  );
}
