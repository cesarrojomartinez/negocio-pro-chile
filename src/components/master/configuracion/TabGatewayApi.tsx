import { useState } from "react";
import {
  Server,
  Activity,
  ShieldCheck,
  Zap,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRightLeft,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import type { ConfiguracionGatewayApi, ModoProveedorTributario } from "@/lib/configuracion";
import {
  guardarConfiguracionProveedorFn,
  healthCheckSimpleApiFn,
  compararProveedoresFn,
} from "@/lib/simpleApi.functions";
import type { HealthCheckResult } from "@/integrations/sii/taxProviderRegistry";
import type { ResultadoComparacionProveedores } from "@/lib/providerComparison.server";
import { formatCLP } from "@/utils/currency";

export function TabGatewayApi({ datos }: { datos: ConfiguracionGatewayApi }) {
  const [modo, setModo] = useState<ModoProveedorTributario>(datos.modoProveedor || "api_gateway");
  const [endpoint, setEndpoint] = useState(datos.endpointSimpleApi || "https://api.simpleapi.cl");
  const [guardando, setGuardando] = useState(false);

  // Health check state
  const [probandoHealth, setProbandoHealth] = useState(false);
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);

  // Comparison state
  const [comparando, setComparando] = useState(false);
  const [resultadoComparacion, setResultadoComparacion] =
    useState<ResultadoComparacionProveedores | null>(null);

  const handleGuardarConfig = async () => {
    setGuardando(true);
    try {
      const res = await guardarConfiguracionProveedorFn({
        data: {
          modoProveedor: modo,
          endpointSimpleApi: endpoint,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Configuración de proveedores tributarios guardada con éxito.");
    } catch (e: any) {
      toast.error(e?.message || "No pudimos guardar la configuración.");
    } finally {
      setGuardando(false);
    }
  };

  const handleEjecutarHealthCheck = async () => {
    setProbandoHealth(true);
    try {
      const res = await healthCheckSimpleApiFn({
        data: { baseUrl: endpoint },
      });
      if (res.ok) {
        setHealthResult(res.data);
        if (res.data.status === "available") {
          toast.success("Health Check exitoso: SimpleAPI responde correctamente.");
        } else {
          toast.warning(`SimpleAPI respondió con estado: ${res.data.status}`);
        }
      } else {
        toast.error(res.error);
      }
    } catch (e: any) {
      toast.error("Error al ejecutar Health Check.");
    } finally {
      setProbandoHealth(false);
    }
  };

  const handleEjecutarComparacionPrueba = async () => {
    setComparando(true);
    try {
      const res = await compararProveedoresFn({
        data: {
          companyId: "demo-company-id",
          rutEmpresa: "77976228-9",
          periodo: "2026-07",
          usarMockParaGateway: true,
        },
      });
      if (res.ok) {
        setResultadoComparacion(res.data);
        if (res.data.coinciden) {
          toast.success("Prueba de comparación: ¡Los resultados coinciden al 100%!");
        } else {
          toast.warning("Prueba de comparación: Se detectaron diferencias.");
        }
      } else {
        toast.error(res.error);
      }
    } catch (e: any) {
      toast.error("Error al ejecutar comparación dual.");
    } finally {
      setComparando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. SELECCIÓN DE PROVEEDOR TRIBUTARIO MASTER */}
      <Card className="border-primary/20 bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-primary" /> Selección de Proveedor Tributario Master
              </CardTitle>
              <CardDescription className="text-xs">
                Selecciona la estrategia de integración tributaria activa para toda la plataforma (Gateway, SimpleAPI o Modo Comparar).
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleGuardarConfig} disabled={guardando}>
              <Save className="h-3.5 w-3.5 mr-1" />
              {guardando ? "Guardando..." : "Guardar Proveedor"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <RadioGroup
            value={modo}
            onValueChange={(val) => setModo(val as ModoProveedorTributario)}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <div
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                modo === "api_gateway"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "bg-muted/30 hover:bg-muted/60"
              }`}
              onClick={() => setModo("api_gateway")}
            >
              <div className="flex items-center justify-between mb-2">
                <RadioGroupItem value="api_gateway" id="p-gateway" />
                <Badge variant="outline" className="text-[10px]">Actual</Badge>
              </div>
              <Label htmlFor="p-gateway" className="font-bold cursor-pointer block text-sm">
                Gateway Principal
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Utiliza el Gateway SII Core determinístico de alto rendimiento.
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                modo === "simple_api"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "bg-muted/30 hover:bg-muted/60"
              }`}
              onClick={() => setModo("simple_api")}
            >
              <div className="flex items-center justify-between mb-2">
                <RadioGroupItem value="simple_api" id="p-simpleapi" />
                <Badge variant="secondary" className="text-[10px]">Nuevo</Badge>
              </div>
              <Label htmlFor="p-simpleapi" className="font-bold cursor-pointer block text-sm">
                SimpleAPI Chile
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Conexión directa vía REST API mediante la infraestructura SimpleAPI.cl.
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                modo === "automatic"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "bg-muted/30 hover:bg-muted/60"
              }`}
              onClick={() => setModo("automatic")}
            >
              <div className="flex items-center justify-between mb-2">
                <RadioGroupItem value="automatic" id="p-auto" />
                <Badge variant="outline" className="text-[10px]">Failover</Badge>
              </div>
              <Label htmlFor="p-auto" className="font-bold cursor-pointer block text-sm">
                Automático (Failover)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Conmuta automáticamente entre proveedores ante latencia o fallas.
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                modo === "compare"
                  ? "border-purple-500 bg-purple-500/5 ring-1 ring-purple-500"
                  : "bg-muted/30 hover:bg-muted/60"
              }`}
              onClick={() => setModo("compare")}
            >
              <div className="flex items-center justify-between mb-2">
                <RadioGroupItem value="compare" id="p-compare" />
                <Badge className="bg-purple-600 text-[10px]">Auditoría Dual</Badge>
              </div>
              <Label htmlFor="p-compare" className="font-bold cursor-pointer block text-sm">
                Comparar Ambos
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Ejecuta Gateway y SimpleAPI en paralelo para auditar discrepancias.
              </p>
            </div>
          </RadioGroup>

          {/* CONFIGURACIÓN Y HEALTH CHECK SIMPLE API */}
          <div className="p-4 rounded-xl border bg-muted/20 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Configuración y Health Check SimpleAPI Chile
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Credencial API Key</Label>
                <div className="h-9 px-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span>Cargada desde Secret de Lovable (<code>SIMPLEAPI_API_KEY</code>)</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="simpleapi-endpoint" className="text-xs font-semibold">Endpoint Base</Label>
                <Input
                  id="simpleapi-endpoint"
                  type="text"
                  placeholder="https://api.simpleapi.cl"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEjecutarHealthCheck}
                disabled={probandoHealth}
                className="h-8 text-xs gap-1.5"
              >
                {probandoHealth ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5 text-emerald-500" />}
                Ejecutar Health Check Independiente
              </Button>

              {healthResult && (
                <div className="flex items-center gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className={
                      healthResult.status === "available"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-amber-50 text-amber-700 border-amber-300"
                    }
                  >
                    Estado: {healthResult.status.toUpperCase()}
                  </Badge>
                  <span className="text-muted-foreground">Latencia: {healthResult.latencyMs} ms</span>
                </div>
              )}
            </div>

            {healthResult && (
              <p className="text-xs text-muted-foreground bg-background p-2.5 rounded-lg border">
                {healthResult.mensaje}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. PANEL MODO COMPARAR PROVEEDORES */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" /> Auditoría y Comparación Dual de Proveedores
              </CardTitle>
              <CardDescription className="text-xs">
                Ejecuta consultas concurrentes en Gateway y SimpleAPI para contrastar velocidad, costos y paridad tributaria en RCV.
              </CardDescription>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEjecutarComparacionPrueba}
              disabled={comparando}
              className="h-8 text-xs gap-1.5"
            >
              {comparando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5 text-purple-600" />}
              {comparando ? "Ejecutando Prueba..." : "Ejecutar Comparación Dual"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {resultadoComparacion ? (
            <div className="space-y-4">
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                  resultadoComparacion.coinciden
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                }`}
              >
                <span className="flex items-center gap-2">
                  {resultadoComparacion.coinciden ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                  {resultadoComparacion.resumenComparativo}
                </span>
                <span>Periodo: {resultadoComparacion.periodo}</span>
              </div>

              {/* TABLA COMPARATIVA DE PROVEEDORES */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* GATEWAY */}
                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-sm text-foreground flex items-center gap-2">
                      <Server className="h-4 w-4 text-emerald-500" /> {resultadoComparacion.gateway.proveedor}
                    </span>
                    <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700">
                      {resultadoComparacion.gateway.estado.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Tiempo Respuesta</span>
                      <span className="font-bold text-foreground">{resultadoComparacion.gateway.tiempoSegundosText}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Costo Estimado</span>
                      <span className="font-bold text-foreground">{resultadoComparacion.gateway.costoEstimadoCreditos} cr ({formatCLP(resultadoComparacion.gateway.costoEstimadoClp)})</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Docs Ventas / Compras</span>
                      <span className="font-bold text-foreground">{resultadoComparacion.gateway.cantidadDocumentosVentas} ventas / {resultadoComparacion.gateway.cantidadDocumentosCompras} compras</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">IVA Débito</span>
                      <span className="font-bold text-foreground">{formatCLP(resultadoComparacion.gateway.ivaDebitoClp)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">IVA Crédito</span>
                      <span className="font-bold text-foreground">{formatCLP(resultadoComparacion.gateway.ivaCreditoClp)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Remanente</span>
                      <span className="font-bold text-foreground">{formatCLP(resultadoComparacion.gateway.remanenteEstimadoClp)}</span>
                    </div>
                  </div>
                </div>

                {/* SIMPLE API */}
                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-sm text-foreground flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" /> {resultadoComparacion.simpleApi.proveedor}
                    </span>
                    <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700">
                      {resultadoComparacion.simpleApi.estado.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Tiempo Respuesta</span>
                      <span className="font-bold text-foreground">{resultadoComparacion.simpleApi.tiempoSegundosText}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Costo Estimado</span>
                      <span className="font-bold text-foreground">{resultadoComparacion.simpleApi.costoEstimadoCreditos} cr ({formatCLP(resultadoComparacion.simpleApi.costoEstimadoClp)})</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Docs Ventas / Compras</span>
                      <span className="font-bold text-foreground">{resultadoComparacion.simpleApi.cantidadDocumentosVentas} ventas / {resultadoComparacion.simpleApi.cantidadDocumentosCompras} compras</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">IVA Débito</span>
                      <span className="font-bold text-foreground">{formatCLP(resultadoComparacion.simpleApi.ivaDebitoClp)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">IVA Crédito</span>
                      <span className="font-bold text-foreground">{formatCLP(resultadoComparacion.simpleApi.ivaCreditoClp)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Remanente</span>
                      <span className="font-bold text-foreground">{formatCLP(resultadoComparacion.simpleApi.remanenteEstimadoClp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground rounded-xl border border-dashed space-y-2">
              <ArrowRightLeft className="mx-auto h-6 w-6 text-muted-foreground/60" />
              <p className="font-medium text-foreground">Aún no se ha ejecutado ninguna prueba de comparación dual</p>
              <p className="max-w-md mx-auto">
                Haz clic en "Ejecutar Comparación Dual" para probar las consultas concurrentes en Gateway y SimpleAPI y contrastar velocidad y paridad tributaria.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. METRICAS HISTORICAS GATEWAY */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Server className="h-4 w-4 text-emerald-500" /> Monitoreo y Telemetría del Gateway SII
              </CardTitle>
              <CardDescription className="text-xs">
                Visualización técnica del Gateway de conexión con el SII (Sin almacenamiento de credenciales ni secretos).
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold">
              <ShieldCheck className="h-3 w-3 mr-1" /> {datos.estado.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block">Proveedor Actual</span>
              <span className="text-sm font-bold block mt-1">{datos.proveedorActual}</span>
            </div>
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block">Versión de Motor Gateway</span>
              <span className="text-sm font-bold block mt-1">{datos.versionGateway}</span>
            </div>
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block">Costo Estimado por Llamada</span>
              <span className="text-sm font-bold block mt-1">${datos.costoPorLlamadaClp.toFixed(3)} CLP</span>
            </div>
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block">Costo Promedio Mensual</span>
              <span className="text-sm font-bold block mt-1">${datos.costoPromedioMensualClp.toLocaleString("es-CL")} CLP</span>
            </div>
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block">Consumo Diario</span>
              <span className="text-sm font-bold block mt-1">{datos.consumoDiarioLlamadas.toLocaleString("es-CL")} solicitudes</span>
            </div>
            <div className="p-3.5 rounded-xl border bg-card">
              <span className="text-xs text-muted-foreground block">Consumo Mensual Acumulado</span>
              <span className="text-sm font-bold block mt-1">{datos.consumoMensualLlamadas.toLocaleString("es-CL")} solicitudes</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border bg-muted/40 text-xs text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <Activity className="h-4 w-4 text-primary" /> Gateway Operativo con Cero Fallas Catastróficas
            </span>
            <span>Última verificación: {datos.ultimaActualizacion}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
