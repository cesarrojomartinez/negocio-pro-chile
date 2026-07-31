import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/shared/AppShell";
import { DataRow, SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ETIQUETA_ESTADO, type EstadoCuenta } from "@/lib/cuenta";
import { formatFechaHora } from "@/utils/currency";
import { cambiarEstadoCuentaFn, panelMasterFn } from "@/lib/cuenta.functions";
import type { PanelMaster } from "@/lib/cuenta.server";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Panel de administración | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Visión interna de clientes, planes, consumo y alertas operativas de Mi Negocio al Día.",
      },
      { property: "og:title", content: "Panel de administración | Mi Negocio al Día" },
      {
        property: "og:description",
        content: "Clientes, estados de cuenta, consumo y alertas de la plataforma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [panel, setPanel] = useState<PanelMaster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("");

  const cargar = async () => {
    setCargando(true);
    const r = await panelMasterFn();
    if (r.ok) {
      setPanel(r.data);
      setError(null);
    } else setError(r.error);
    setCargando(false);
  };

  useEffect(() => {
    void cargar();
  }, []);

  const cambiarEstado = async (companyId: string, estado: EstadoCuenta) => {
    const r = await cambiarEstadoCuentaFn({ data: { companyId, estado } });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Estado actualizado.");
    await cargar();
  };

  if (cargando) {
    return (
      <AppShell>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Cargando panel…
        </p>
      </AppShell>
    );
  }

  if (error || !panel) {
    return (
      <AppShell>
        <SectionCard titulo="Panel de administración">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error ?? "No pudimos cargar el panel."}
          </p>
        </SectionCard>
      </AppShell>
    );
  }

  const empresas = panel.empresas.filter((e) =>
    `${e.razonSocial} ${e.rut}`.toLowerCase().includes(filtro.trim().toLowerCase()),
  );

  return (
    <AppShell>
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-bold sm:text-2xl">Panel de administración</h1>
          <p className="text-sm text-muted-foreground">
            Uso interno. Muestra clientes, planes, consumo y alertas operativas.
          </p>
        </header>

        <SectionCard titulo="Resumen general">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metrica label="Empresas activas" valor={panel.totales.empresasActivas} />
            <Metrica label="En prueba" valor={panel.totales.enPrueba} />
            <Metrica label="Suspendidas" valor={panel.totales.empresasSuspendidas} />
            <Metrica label="Clientes pagados" valor={panel.totales.conversiones} />
            <Metrica
              label="Actualizaciones exitosas"
              valor={panel.totales.actualizacionesExitosas}
            />
            <Metrica label="Errores" valor={panel.totales.errores} />
            <Metrica label="Resueltas con caché" valor={panel.totales.usoCache} />
            <Metrica
              label="Consumo promedio"
              valor={Math.round(panel.totales.consumoMedio)}
            />
          </div>
        </SectionCard>

        {panel.alertas.length > 0 && (
          <SectionCard titulo="Alertas operativas">
            {panel.alertas.map((a) => (
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
            ))}
          </SectionCard>
        )}

        <SectionCard
          titulo="Clientes"
          acciones={
            <Input
              className="h-9 w-[220px]"
              placeholder="Buscar por nombre o RUT"
              aria-label="Buscar cliente"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          }
        >
          <div className="space-y-3">
            {empresas.map((e) => (
              <div key={e.companyId} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {e.razonSocial}
                      {e.esDemo && (
                        <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                          Demostración
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      RUT {e.rut} · alta {formatFechaHora(e.alta)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void cambiarEstado(e.companyId, "active")}
                    >
                      Activar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void cambiarEstado(e.companyId, "suspended")}
                    >
                      Suspender
                    </Button>
                  </div>
                </div>
                <div className="mt-2">
                  <DataRow label="Plan" value={e.plan} />
                  <DataRow label="Estado" value={ETIQUETA_ESTADO[e.estadoCuenta]} />
                  <DataRow label="Usuarios" value={`${e.usuarios}`} />
                  <DataRow
                    label="Periodos con datos reales"
                    value={`${e.periodosSincronizados}`}
                  />
                  <DataRow
                    label="Actualizaciones del mes"
                    value={`${e.consultasMes}`}
                    hint={`Resueltas con caché: ${e.cacheMes}`}
                  />
                  <DataRow
                    label="Errores recientes"
                    value={`${e.erroresRecientes}`}
                    tone={e.erroresRecientes > 0 ? "warning" : "default"}
                  />
                  <DataRow
                    label="Última actualización"
                    value={
                      e.ultimaActualizacion
                        ? formatFechaHora(e.ultimaActualizacion)
                        : "Por confirmar"
                    }
                  />
                </div>
              </div>
            ))}
            {empresas.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay empresas que coincidan con la búsqueda.
              </p>
            )}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}

function Metrica({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums">{valor}</p>
    </div>
  );
}
