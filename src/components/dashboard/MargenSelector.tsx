import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const OPCIONES = [0, 5, 10];

export function MargenSelector({
  valor,
  onCambiar,
}: {
  valor: number;
  onCambiar: (v: number) => void;
}) {
  const personalizado = !OPCIONES.includes(valor);
  const [modoPersonalizado, setModoPersonalizado] = useState(personalizado);
  const [texto, setTexto] = useState(String(valor));

  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="text-sm font-semibold">Margen preventivo</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Porcentaje adicional que se suma al total tributario estimado para evitar
        sorpresas al cierre.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {OPCIONES.map((o) => (
          <Button
            key={o}
            type="button"
            variant={!modoPersonalizado && valor === o ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setModoPersonalizado(false);
              onCambiar(o);
            }}
          >
            {o}%
          </Button>
        ))}
        <Button
          type="button"
          variant={modoPersonalizado ? "default" : "outline"}
          size="sm"
          onClick={() => setModoPersonalizado(true)}
        >
          Personalizado
        </Button>
      </div>
      {modoPersonalizado && (
        <div className={cn("mt-3 flex flex-wrap items-end gap-2")}>
          <div className="flex-1 min-w-[140px]">
            <Label htmlFor="margen-personalizado">Porcentaje personalizado</Label>
            <Input
              id="margen-personalizado"
              inputMode="numeric"
              value={texto}
              onChange={(e) => setTexto(e.target.value.replace(/[^\d]/g, ""))}
              className="mt-1 h-11"
            />
          </div>
          <Button
            type="button"
            onClick={() => onCambiar(Math.min(100, Number(texto) || 0))}
          >
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}
