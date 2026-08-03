import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  BadgePercent,
  Bell,
  Building2,
  Cpu,
  Globe,
  History,
  Mail,
  Palette,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CONFIGURACION_POR_DEFECTO,
  type ConfiguracionGlobal,
  type GrupoConfiguracion,
  type RegistroHistorialConfig,
} from "@/lib/configuracion";
import {
  guardarGrupoConfiguracionMasterFn,
  obtenerConfiguracionGlobalMasterFn,
  obtenerHistorialConfiguracionMasterFn,
  restablecerGrupoConfiguracionMasterFn,
} from "@/lib/configuracion.functions";
import { MasterLayout } from "@/components/master/MasterLayout";
import { TabPlataforma } from "@/components/master/configuracion/TabPlataforma";
import { TabLanding } from "@/components/master/configuracion/TabLanding";
import { TabBranding } from "@/components/master/configuracion/TabBranding";
import { TabComercial } from "@/components/master/configuracion/TabComercial";
import { TabGatewayApi } from "@/components/master/configuracion/TabGatewayApi";
import { TabIaGateway } from "@/components/master/configuracion/TabIaGateway";
import { TabCorreos } from "@/components/master/configuracion/TabCorreos";
import { TabNotificaciones } from "@/components/master/configuracion/TabNotificaciones";
import { TabSeguridad } from "@/components/master/configuracion/TabSeguridad";
import { TabSistema } from "@/components/master/configuracion/TabSistema";
import { ModalHistorialConfig } from "@/components/master/configuracion/ModalHistorialConfig";

export const Route = createFileRoute("/admin/configuracion/")({
  loader: async () => obtenerConfiguracionGlobalMasterFn(),
  component: CentroConfiguracionMasterPage,
});

function CentroConfiguracionMasterPage() {
  const loaderData = Route.useLoaderData();
  const navigate = useNavigate();

  const [config, setConfig] = useState<ConfiguracionGlobal>(
    loaderData.ok ? loaderData.data : CONFIGURACION_POR_DEFECTO,
  );
  const [tabActiva, setTabActiva] = useState<GrupoConfiguracion>("plataforma");
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [modalHistorialOpen, setModalHistorialOpen] = useState(false);
  const [historial, setHistorial] = useState<RegistroHistorialConfig[]>([]);

  useEffect(() => {
    if (!loaderData.ok) {
      toast.error(loaderData.error || "No fue posible cargar la configuración global.");
    }
  }, [loaderData]);

  const cargarHistorial = async () => {
    const res = (await obtenerHistorialConfiguracionMasterFn()) as any;
    if (res.ok) setHistorial(res.data);
    setModalHistorialOpen(true);
  };

  const handleGuardarGrupo = async (grupo: GrupoConfiguracion, valores: unknown) => {
    setGuardando(true);
    const res = await guardarGrupoConfiguracionMasterFn({ data: { grupo, valores } });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.data.mensaje);
    setConfig((prev) => ({ ...prev, [grupo]: valores as any }));
  };

  const handleRestablecerGrupo = async (grupo: GrupoConfiguracion) => {
    if (!confirm(`¿Restablecer el grupo '${grupo}' a los valores por defecto del sistema?`)) return;
    setGuardando(true);
    const res = await restablecerGrupoConfiguracionMasterFn({ data: { grupo } });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.data.mensaje);
    setConfig((prev) => ({ ...prev, [grupo]: CONFIGURACION_POR_DEFECTO[grupo] as any }));
  };

  const pestanas = [
    { id: "plataforma", label: "Plataforma", icono: Building2 },
    { id: "landing", label: "Landing & SEO", icono: Globe },
    { id: "branding", label: "Branding", icono: Palette },
    { id: "comercial", label: "Comercial", icono: BadgePercent },
    { id: "gateway_api", label: "Gateway API", icono: Server },
    { id: "ia_gateway", label: "IA Gateway", icono: Cpu },
    { id: "correos", label: "Correos", icono: Mail },
    { id: "notificaciones", label: "Notificaciones", icono: Bell },
    { id: "seguridad", label: "Seguridad", icono: ShieldCheck },
    { id: "sistema", label: "Sistema", icono: Activity },
  ] as const;

  const pestanasFiltradas = pestanas.filter((p) =>
    p.label.toLowerCase().includes(busqueda.toLowerCase().trim()),
  );

  return (
    <div className="space-y-6">
        {/* Header Superior del Centro de Configuración */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b">
          <div>
            <h1 className="text-xl font-extrabold flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" /> Centro de Configuración Global SaaS
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Panel de control maestro para personalizar parámetros institucionales, branding, pasarelas y seguridad.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar parámetro..."
                className="h-9 text-xs pl-8 bg-card"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs gap-1.5"
              onClick={cargarHistorial}
            >
              <History className="h-3.5 w-3.5" />
              Historial Cambios
            </Button>
          </div>
        </div>

        {/* Sistema de Pestañas SaaS Stripe/Supabase Style */}
        <Tabs
          value={tabActiva}
          onValueChange={(val) => setTabActiva(val as GrupoConfiguracion)}
          className="space-y-6"
        >
          <TabsList className="flex h-auto w-full flex-wrap gap-1 rounded-xl bg-card p-1.5 border border-border shadow-xs">
            {pestanasFiltradas.map((p) => {
              const Icono = p.icono;
              return (
                <TabsTrigger
                  key={p.id}
                  value={p.id}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                >
                  <Icono className="h-3.5 w-3.5 shrink-0" />
                  {p.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="plataforma">
            <TabPlataforma
              datos={config.plataforma}
              onGuardar={(vals) => handleGuardarGrupo("plataforma", vals)}
              onRestablecer={() => handleRestablecerGrupo("plataforma")}
              guardando={guardando}
            />
          </TabsContent>

          <TabsContent value="landing">
            <TabLanding
              datos={config.landing}
              onGuardar={(vals) => handleGuardarGrupo("landing", vals)}
              onRestablecer={() => handleRestablecerGrupo("landing")}
              guardando={guardando}
            />
          </TabsContent>

          <TabsContent value="branding">
            <TabBranding
              datos={config.branding}
              onGuardar={(vals) => handleGuardarGrupo("branding", vals)}
              onRestablecer={() => handleRestablecerGrupo("branding")}
              guardando={guardando}
            />
          </TabsContent>

          <TabsContent value="comercial">
            <TabComercial
              datos={config.comercial}
              onGuardar={(vals) => handleGuardarGrupo("comercial", vals)}
              onRestablecer={() => handleRestablecerGrupo("comercial")}
              guardando={guardando}
            />
          </TabsContent>

          <TabsContent value="gateway_api">
            <TabGatewayApi datos={config.gateway_api} />
          </TabsContent>

          <TabsContent value="ia_gateway">
            <TabIaGateway
              datos={config.ia_gateway}
              onGuardar={(vals) => handleGuardarGrupo("ia_gateway", vals)}
              onRestablecer={() => handleRestablecerGrupo("ia_gateway")}
              guardando={guardando}
            />
          </TabsContent>

          <TabsContent value="correos">
            <TabCorreos
              datos={config.correos}
              onGuardar={(vals) => handleGuardarGrupo("correos", vals)}
              onRestablecer={() => handleRestablecerGrupo("correos")}
              guardando={guardando}
            />
          </TabsContent>

          <TabsContent value="notificaciones">
            <TabNotificaciones
              datos={config.notificaciones}
              onGuardar={(vals) => handleGuardarGrupo("notificaciones", vals)}
              onRestablecer={() => handleRestablecerGrupo("notificaciones")}
              guardando={guardando}
            />
          </TabsContent>

          <TabsContent value="seguridad">
            <TabSeguridad
              datos={config.seguridad}
              onGuardar={(vals) => handleGuardarGrupo("seguridad", vals)}
              onRestablecer={() => handleRestablecerGrupo("seguridad")}
              guardando={guardando}
            />
          </TabsContent>

          <TabsContent value="sistema">
            <TabSistema datos={config.sistema} />
          </TabsContent>
        </Tabs>

        {/* Modal de Historial */}
        <ModalHistorialConfig
          abierto={modalHistorialOpen}
          onOpenChange={setModalHistorialOpen}
          historial={historial}
        />
      </div>
  );
}
