import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, Link2, Loader2, Unlink } from "lucide-react";

import { AppShell } from "@/components/shared/AppShell";
import { DataRow, SectionCard } from "@/components/shared/SectionCard";
import { MargenSelector } from "@/components/dashboard/MargenSelector";
import { ScenarioSwitcher } from "@/components/shared/ScenarioSwitcher";
import { ConnectionBadge } from "@/components/shared/Badges";
import { SimulatedDataNotice } from "@/components/shared/SimulatedDataNotice";
import { SiiConnectionPanel } from "@/components/sii/SiiConnectionPanel";
import { RealGatewayPanel } from "@/components/sii/RealGatewayPanel";
import { ModoActualizacionPanel } from "@/components/sii/ModoActualizacionPanel";


import { MoneyDialog } from "@/components/shared/MoneyDialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";
import { useCompany } from "@/hooks/useCompany";
import { EMPRESA_DEMO } from "@/data/mockTaxData";
import { formatearRut } from "@/lib/rut";
import { formatCLP, formatFechaHora } from "@/utils/currency";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Ajusta tu meta mensual, el margen preventivo, el dinero reservado y la conexión demostrativa con el SII.",
      },
      { property: "og:title", content: "Configuración | Mi Negocio al Día" },
      {
        property: "og:description",
        content: "Datos de la empresa, preferencias de alertas y conexión demostrativa.",
      },
    ],
  }),
  component: Configuracion,
});

function Configuracion() {
  const {
    metaMensual,
    setMetaMensual,
    dineroReservado,
    setDineroReservado,
    margenPorcentaje,
    setMargenPorcentaje,
    estadoConexion,
    ultimaSincronizacion,
    conectarDemo,
    desconectar,
  } = useTaxDashboard();
  const { modo, empresaActiva } = useCompany();

  const esCloud = modo === "cloud";
  const empresa = {
    razonSocial: esCloud
      ? (empresaActiva?.razonSocial ?? "—")
      : EMPRESA_DEMO.razonSocial,
    nombreFantasia: esCloud
      ? (empresaActiva?.nombreFantasia ?? "—")
      : EMPRESA_DEMO.nombreFantasia,
    rut: esCloud
      ? empresaActiva
        ? formatearRut(empresaActiva.rut)
        : "—"
      : EMPRESA_DEMO.rut,
    actividad: esCloud ? (empresaActiva?.actividad ?? "—") : EMPRESA_DEMO.actividad,
  };

  const [modalConexion, setModalConexion] = useState(false);
  const [dialogMeta, setDialogMeta] = useState(false);
  const [dialogReserva, setDialogReserva] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [alertas, setAlertas] = useState({
    reserva: true,
    meta: true,
    pendientes: false,
  });

  return (
    <AppShell>
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Configuración
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {esCloud
              ? "Ajusta tu meta, tu reserva y las alertas. Nada de lo que ingreses se envía al SII."
              : "Ajustes de la demostración. Nada de lo que ingreses se envía al SII."}
          </p>
        </header>

        <SimulatedDataNotice />

        <SectionCard
          titulo="Datos generales de la empresa"
          acciones={<Building2 className="h-5 w-5 text-primary" aria-hidden />}
        >
          <div className="rounded-2xl bg-secondary/60 p-4">
            <DataRow label="Razón social" value={empresa.razonSocial} />
            <DataRow label="Nombre de fantasía" value={empresa.nombreFantasia} />
            <DataRow label="RUT" value={empresa.rut} />
            <DataRow label="Actividad" value={empresa.actividad} />
          </div>
        </SectionCard>


        <div className="grid gap-5 xl:grid-cols-2">
          <SectionCard titulo="Meta y reserva">
            <div className="rounded-2xl bg-secondary/60 p-4">
              <DataRow label="Meta mensual" value={formatCLP(metaMensual)} strong />
              <DataRow
                label="Dinero reservado"
                value={formatCLP(dineroReservado)}
                strong
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setDialogMeta(true)}>
                Editar meta mensual
              </Button>
              <Button variant="outline" onClick={() => setDialogReserva(true)}>
                Editar dinero reservado
              </Button>
            </div>
          </SectionCard>

          <SectionCard titulo="Margen preventivo">
            <MargenSelector valor={margenPorcentaje} onCambiar={setMargenPorcentaje} />
          </SectionCard>
        </div>

        <SectionCard
          titulo="Preferencias de alertas"
          descripcion="Define qué avisos te gustaría recibir cuando esta función esté disponible."
        >
          <div className="space-y-3">
            {[
              {
                id: "reserva",
                label: "Avisarme cuando mi reserva no cubra la estimación",
              },
              { id: "meta", label: "Avisarme sobre el avance de mi meta mensual" },
              {
                id: "pendientes",
                label: "Avisarme cuando existan compras pendientes",
              },
            ].map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3"
              >
                <Label htmlFor={`alerta-${a.id}`} className="text-sm">
                  {a.label}
                </Label>
                <Switch
                  id={`alerta-${a.id}`}
                  checked={alertas[a.id as keyof typeof alertas]}
                  onCheckedChange={(v) => setAlertas((p) => ({ ...p, [a.id]: v }))}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        {esCloud ? (
          <>
            <ModoActualizacionPanel companyId={empresaActiva?.id ?? null} />
            <SiiConnectionPanel />
            <RealGatewayPanel />
          </>



        ) : (
          <SectionCard
            titulo="Conexión con el SII"
            descripcion="En esta etapa la conexión es solo demostrativa."
          >
            <SimulatedDataNotice className="mb-4" />
            <div className="flex flex-wrap items-center gap-3">
              <ConnectionBadge estado={estadoConexion} />
              <span className="text-sm text-muted-foreground">
                Última sincronización: {formatFechaHora(ultimaSincronizacion)}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => setModalConexion(true)}>
                <Link2 className="h-4 w-4" aria-hidden />
                Conectar SII
              </Button>
              <Button
                variant="outline"
                onClick={desconectar}
                disabled={estadoConexion === "disconnected"}
              >
                <Unlink className="h-4 w-4" aria-hidden />
                Desconectar
              </Button>
            </div>
          </SectionCard>
        )}

        {!esCloud && <ScenarioSwitcher />}

        <Dialog open={modalConexion} onOpenChange={setModalConexion}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Conexión con el SII</DialogTitle>
              <DialogDescription>
                La conexión real con el SII se habilitará en una próxima etapa
                mediante un servicio seguro. No ingreses una Clave Tributaria real en
                esta demostración.
              </DialogDescription>
            </DialogHeader>
            <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
              Esta demostración no solicita credenciales ni almacena contraseñas.
            </p>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setModalConexion(false)}>
                Cerrar
              </Button>
              <Button
                disabled={conectando}
                onClick={async () => {
                  setConectando(true);
                  try {
                    await conectarDemo();
                    setModalConexion(false);
                  } finally {
                    setConectando(false);
                  }
                }}
              >
                {conectando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {conectando ? "Conectando" : "Probar conexión demostrativa"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <MoneyDialog
          open={dialogMeta}
          onOpenChange={setDialogMeta}
          titulo="Editar meta mensual"
          descripcion="Define cuánto quieres vender este mes."
          etiqueta="Meta mensual"
          valor={metaMensual}
          onGuardar={setMetaMensual}
        />
        <MoneyDialog
          open={dialogReserva}
          onOpenChange={setDialogReserva}
          titulo="Dinero que ya tienes reservado"
          descripcion="Registra cuánto mantienes separado hoy para tus impuestos."
          etiqueta="Monto reservado"
          valor={dineroReservado}
          onGuardar={setDineroReservado}
        />
      </div>
    </AppShell>
  );
}
