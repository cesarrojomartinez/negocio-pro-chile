import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function aTexto(tasa: number | null): string {
  if (tasa == null) return "";
  return (tasa * 100).toLocaleString("es-CL", { maximumFractionDigits: 3 });
}

function aFraccion(texto: string): number | null {
  const limpio = texto.replace(",", ".").trim();
  if (!limpio) return null;
  const n = Number(limpio);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n / 100;
}

/**
 * Permite reemplazar la tasa de PPM estimada por la que la persona conoce.
 * No modifica datos guardados: solo ajusta el cálculo que se está mostrando.
 */
export function PpmSelector({
  tasaEstimada,
  tasaPersonalizada,
  onCambiar,
}: {
  /** Tasa que usó la estimación (fracción) o `null` si aún no se conoce. */
  tasaEstimada: number | null;
  /** Tasa elegida manualmente (fracción) o `null` si se usa la estimada. */
  tasaPersonalizada: number | null;
  onCambiar: (v: number | null) => void;
}) {
  const [abierto, setAbierto] = useState(tasaPersonalizada != null);
  const [texto, setTexto] = useState(aTexto(tasaPersonalizada ?? tasaEstimada));

  useEffect(() => {
    if (tasaPersonalizada != null) setAbierto(true);
  }, [tasaPersonalizada]);

  const valor = aFraccion(texto);

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Tasa de PPM</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tasaPersonalizada != null
              ? `Estás usando una tasa propia de ${aTexto(tasaPersonalizada)}%. La estimada es ${
                  tasaEstimada != null ? `${aTexto(tasaEstimada)}%` : "desconocida"
                }.`
              : tasaEstimada != null
                ? `Estimada: ${aTexto(tasaEstimada)}%. No todas las empresas tienen la misma tasa; puedes cambiarla.`
                : "Aún no conocemos tu tasa. Puedes ingresarla para ver el PPM estimado."}
          </p>
        </div>
        <Button
          type="button"
          variant={abierto ? "default" : "outline"}
          size="sm"
          onClick={() => setAbierto((v) => !v)}
        >
          {abierto ? "Ocultar" : "Cambiar tasa"}
        </Button>
      </div>

      {abierto && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1">
            <Label htmlFor="ppm-personalizado">Tasa de PPM (%)</Label>
            <Input
              id="ppm-personalizado"
              inputMode="decimal"
              placeholder="Ej: 0,8"
              value={texto}
              onChange={(e) => setTexto(e.target.value.replace(/[^\d.,]/g, ""))}
              className="mt-1 h-11"
            />
          </div>
          <Button type="button" disabled={valor == null} onClick={() => onCambiar(valor)}>
            Aplicar
          </Button>
          {tasaPersonalizada != null && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onCambiar(null);
                setTexto(aTexto(tasaEstimada));
              }}
            >
              Usar tasa estimada
            </Button>
          )}
        </div>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        Cambiar la tasa solo ajusta esta estimación informativa. No modifica tus datos
        ni reemplaza a tu contador.
      </p>
    </div>
  );
}
