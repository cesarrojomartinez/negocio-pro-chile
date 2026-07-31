import { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { syncPreferencesService } from "@/services/syncPreferencesService";
import {
  evaluarPresupuesto,
  evaluarRecordatorio,
  type SyncPreferences,
} from "@/lib/syncPreferences";

/**
 * Recordatorio amable de actualización mensual y estado del presupuesto
 * interno de consultas. No ejecuta ninguna consulta por sí mismo.
 */
export function RecordatorioActualizacion({
  companyId,
  ultimaSincronizacion,
}: {
  companyId: string | null;
  ultimaSincronizacion: string | null;
}) {
  const [prefs, setPrefs] = useState<SyncPreferences | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(() => {
    if (!companyId) return setPrefs(null);
    syncPreferencesService
      .obtener(companyId)
      .then(setPrefs)
      .catch(() => setPrefs(null));
  }, [companyId]);

  useEffect(() => cargar(), [cargar]);

  if (!companyId || !prefs) return null;

  const recordatorio = evaluarRecordatorio({
    ahora: new Date(),
    ultimaSincronizacion,
    preferencias: prefs,
  });
  const presupuesto = evaluarPresupuesto(prefs);

  const cambiar = async (cambio: Parameters<typeof syncPreferencesService.actualizar>[0]) => {
    setOcupado(true);
    try {
      setPrefs(await syncPreferencesService.actualizar(cambio));
    } catch {
      /* silencioso: el recordatorio nunca debe bloquear la pantalla */
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-3">
      {recordatorio.mensaje && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-3">
          <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="flex-1 text-sm">{recordatorio.mensaje}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Descartar recordatorio"
            disabled={ocupado}
            onClick={() => cambiar({ companyId, descartarRecordatorio: true })}
          >
            {ocupado ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <X className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>
      )}

      {presupuesto.mensaje && (
        <p className="text-xs text-muted-foreground">{presupuesto.mensaje}</p>
      )}

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="recordatorio-mensual" className="text-sm">
          Avisarme cuando convenga actualizar
        </Label>
        <Switch
          id="recordatorio-mensual"
          checked={prefs.reminderEnabled}
          disabled={ocupado}
          onCheckedChange={(v) => cambiar({ companyId, reminderEnabled: v })}
        />
      </div>
    </div>
  );
}
