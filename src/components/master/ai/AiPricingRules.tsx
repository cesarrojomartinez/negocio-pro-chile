import { useEffect, useState } from "react";
import {
  Calculator,
  Check,
  Coins,
  Cpu,
  Layers,
  Loader2,
  Save,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guardarGrupoConfiguracionMasterFn } from "@/lib/configuracion.functions";
import type { ConfiguracionIaGateway } from "@/lib/configuracion";
import { listarPlanesMasterAdminFn, listarWalletsIAMasterFn } from "@/lib/cuenta.functions";
import type { PlanMaster, ResumenCreditosIAMaster } from "@/lib/cuenta.server";
import { formatCLP } from "@/utils/currency";

interface AiPricingRulesProps {
  datosIniciales?: ConfiguracionIaGateway;
  onActualizado?: () => void;
}

export function AiPricingRules({ datosIniciales, onActualizado }: AiPricingRulesProps) {
  /* ── Sección 1: Costos Internos del Gateway IA ── */
  const [costoInfra, setCostoInfra] = useState(String(datosIniciales?.costoMensualInfraestructuraClp ?? 85000));
  const [costoProcesamiento, setCostoProcesamiento] = useState(String(datosIniciales?.costoPromedioProcesamientoClp ?? 12));
  const [costoOcr, setCostoOcr] = useState(String(datosIniciales?.costoOcrDocumentoClp ?? 8));
  const [costoAdicional, setCostoAdicional] = useState(String(datosIniciales?.costoProcesamientoAdicionalClp ?? 5));
  const [margenPorcentaje, setMargenPorcentaje] = useState(String(datosIniciales?.margenPlataformaPorcentaje ?? 35));
  const [costoMinimo, setCostoMinimo] = useState(String(datosIniciales?.costoMinimoOperacionClp ?? 15));

  /* ── Sección 2: Valor del Crédito ── */
  const [valorCredito, setValorCredito] = useState(String(datosIniciales?.valorUnCreditoClp ?? 0.4));

  /* ── Sección 3: Medición única = créditos gastados en el API Gateway ── */
  const [creditosPorLlamada, setCreditosPorLlamada] = useState(
    String(datosIniciales?.creditosPorLlamadaGateway ?? 10),
  );
  const [llamadasSimuladas, setLlamadasSimuladas] = useState("5000");

  const [guardando, setGuardando] = useState(false);
  const [guardadoExito, setGuardadoExito] = useState(false);

  /* ── Datos vivos: planes + consumo de clientes ── */
  const [planes, setPlanes] = useState<PlanMaster[] | null>(null);
  const [consumo, setConsumo] = useState<ResumenCreditosIAMaster | null>(null);
  const [cargandoVinculacion, setCargandoVinculacion] = useState(true);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [resPlanes, resWallets] = await Promise.all([
        listarPlanesMasterAdminFn({ data: undefined }),
        listarWalletsIAMasterFn({ data: undefined }),
      ]);
      if (!vivo) return;
      if (resPlanes.ok) setPlanes(resPlanes.data);
      if (resWallets.ok) setConsumo(resWallets.data);
      setCargandoVinculacion(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  /* ── Cálculos económicos ── */
  const valorCreditoNum = parseFloat(valorCredito) || 0.4;
  const margenNum = parseFloat(margenPorcentaje) || 0;
  const creditosLlamadaNum = parseFloat(creditosPorLlamada) || 1;
  const costoMinimoNum = parseFloat(costoMinimo) || 0;
  const llamadasNum = parseFloat(llamadasSimuladas) || 0;

  const creditosMes = Math.round(creditosLlamadaNum * llamadasNum);
  const costoLlamada = Math.max(creditosLlamadaNum * valorCreditoNum, costoMinimoNum);
  const costoVariableMes = Math.round(costoLlamada * llamadasNum);
  const costoTotalMes = costoVariableMes + (parseFloat(costoInfra) || 0);
  const ingresoMes = Math.round(costoVariableMes * (1 + margenNum / 100));
  const margenMes = ingresoMes - costoTotalMes;

  /* ── Guardar ── */
  const handleGuardar = async () => {
    setGuardando(true);

    const payload: ConfiguracionIaGateway = {
      costoMensualInfraestructuraClp: parseFloat(costoInfra) || 85000,
      costoPromedioProcesamientoClp: parseFloat(costoProcesamiento) || 12,
      costoOcrDocumentoClp: parseFloat(costoOcr) || 8,
      costoProcesamientoAdicionalClp: parseFloat(costoAdicional) || 5,
      margenPlataformaPorcentaje: parseFloat(margenPorcentaje) || 35,
      costoMinimoOperacionClp: parseFloat(costoMinimo) || 15,
      valorUnCreditoClp: parseFloat(valorCredito) || 0.4,
      creditosPorLlamadaGateway: parseFloat(creditosPorLlamada) || 10,
    };

    const res = await guardarGrupoConfiguracionMasterFn({
      data: { grupo: "ia_gateway", valores: payload },
    });

    setGuardando(false);

    if (!res.ok) {
      toast.error(res.error || "Error al guardar la configuración económica del Gateway IA.");
      return;
    }

    toast.success("Configuración económica guardada y persistida correctamente.");
    setGuardadoExito(true);
    setTimeout(() => setGuardadoExito(false), 3000);
    if (onActualizado) onActualizado();
  };

  return (
    <div className="space-y-6">
      {/* SECCIÓN 1: ECONOMÍA DEL GATEWAY IA */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Cpu className="h-4 w-4 text-purple-600" /> Economía del Gateway IA
          </h3>
          <Badge variant="outline" className="text-[11px] font-mono bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-700">
            Costos Internos
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Costos reales de infraestructura y procesamiento del Gateway IA. Estos valores son internos y no visibles para los clientes.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Costo Mensual Infraestructura (CLP)</Label>
            <Input value={costoInfra} onChange={(e) => setCostoInfra(e.target.value)} className="text-xs h-9 font-mono" type="number" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Costo Promedio Procesamiento (CLP)</Label>
            <Input value={costoProcesamiento} onChange={(e) => setCostoProcesamiento(e.target.value)} className="text-xs h-9 font-mono" type="number" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Costo OCR por Documento (CLP)</Label>
            <Input value={costoOcr} onChange={(e) => setCostoOcr(e.target.value)} className="text-xs h-9 font-mono" type="number" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Costo Procesamiento Adicional (CLP)</Label>
            <Input value={costoAdicional} onChange={(e) => setCostoAdicional(e.target.value)} className="text-xs h-9 font-mono" type="number" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Margen Plataforma (%)</Label>
            <Input value={margenPorcentaje} onChange={(e) => setMargenPorcentaje(e.target.value)} className="text-xs h-9 font-mono" type="number" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Costo Mínimo por Operación (CLP)</Label>
            <Input value={costoMinimo} onChange={(e) => setCostoMinimo(e.target.value)} className="text-xs h-9 font-mono" type="number" />
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: VALOR DEL CRÉDITO */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-600" /> Valor del Crédito IA
          </h3>
          <Badge variant="outline" className="text-[11px] font-mono bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700">
            Unidad Base
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Este es el valor unitario del crédito IA. Todo el sistema de cobros, planes y estimaciones se basa en este valor.
        </p>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 flex-1 min-w-[180px] max-w-xs">
            <Label className="text-xs font-medium">Valor de 1 Crédito (CLP)</Label>
            <Input value={valorCredito} onChange={(e) => setValorCredito(e.target.value)} className="text-sm h-10 font-mono font-bold" type="number" step="0.01" />
          </div>
          <div className="rounded-xl border bg-muted/40 px-4 py-2.5 text-xs font-mono text-muted-foreground">
            <span className="block text-[11px] font-sans">Equivalencia:</span>
            <span className="block">100 créditos = {formatCLP(Math.round(100 * valorCreditoNum))}</span>
            <span className="block">1.000 créditos = {formatCLP(Math.round(1000 * valorCreditoNum))}</span>
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: MEDICIÓN ÚNICA — CRÉDITOS DEL API GATEWAY */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Calculator className="h-4 w-4 text-emerald-600" /> Medición y Simulación del API Gateway
          </h3>
          <Badge variant="outline" className="text-[11px] font-mono bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-700">
            Tiempo Real
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          La única unidad medida son los créditos gastados en el API Gateway. No existe catálogo de operaciones: cada llamada consume la misma cantidad de créditos.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Créditos por llamada al Gateway</Label>
            <Input value={creditosPorLlamada} onChange={(e) => setCreditosPorLlamada(e.target.value)} className="text-sm h-10 font-mono font-bold" type="number" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Llamadas mensuales a simular</Label>
            <Input value={llamadasSimuladas} onChange={(e) => setLlamadasSimuladas(e.target.value)} className="text-sm h-10 font-mono" type="number" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-xs">
          <div className="rounded-xl border bg-muted/40 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Créditos Mes</span>
            <div className="font-mono font-bold text-foreground">{creditosMes.toLocaleString("es-CL")}</div>
          </div>
          <div className="rounded-xl border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 block">Costo por Llamada</span>
            <div className="font-mono font-bold text-amber-700 dark:text-amber-300">{formatCLP(Math.round(costoLlamada))}</div>
          </div>
          <div className="rounded-xl border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-300 block">Costo Total Mes</span>
            <div className="font-mono font-bold text-blue-700 dark:text-blue-300">{formatCLP(costoTotalMes)}</div>
          </div>
          <div className="rounded-xl border bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300 block">Ingreso Estimado</span>
            <div className="font-mono font-bold text-purple-700 dark:text-purple-300">{formatCLP(ingresoMes)}</div>
          </div>
          <div className="rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">Margen Mes</span>
            <div className={`font-mono font-bold ${margenMes >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}`}>
              {formatCLP(margenMes)}
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 4: VINCULACIÓN CON LOS PLANES */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" /> Créditos Incluidos por Plan
          </h3>
          <Badge variant="outline" className="text-[11px] font-mono bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-700">
            {planes?.length ?? 0} planes
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Cada plan entrega una cuota mensual de créditos del API Gateway. Aquí se compara el precio del plan contra el costo real de esos créditos.
        </p>

        {cargandoVinculacion ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando planes…</p>
        ) : (
          <div className="rounded-xl border overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="bg-muted/60 border-b">
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Plan</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Precio</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Créditos incluidos</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Llamadas equivalentes</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Costo créditos</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Margen</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Empresas</th>
                </tr>
              </thead>
              <tbody>
                {(planes ?? []).map((p) => {
                  const creditos = p.monthlyUpdatesIncluded ?? 0;
                  const costo = Math.round(creditos * valorCreditoNum);
                  const precio = p.priceClp ?? 0;
                  const margen = precio - costo;
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 px-3 font-medium text-foreground">{p.name}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatCLP(precio)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{creditos.toLocaleString("es-CL")}</td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                        {Math.floor(creditos / creditosLlamadaNum).toLocaleString("es-CL")}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">{formatCLP(costo)}</td>
                      <td className={`py-2 px-3 text-right font-mono font-bold ${margen >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatCLP(margen)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{p.companyCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECCIÓN 5: CONSUMO REAL DE CLIENTES */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-rose-600" /> Consumo de Créditos por Cliente
          </h3>
          <Badge variant="outline" className="text-[11px] font-mono bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-700">
            {consumo?.billeteras.length ?? 0} empresas
          </Badge>
        </div>

        {cargandoVinculacion ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando consumo…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-muted/40 p-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Créditos asignados</span>
                <span className="font-mono font-bold text-base">{(consumo?.resumen.creditosAsignadosTotal ?? 0).toLocaleString("es-CL")}</span>
              </div>
              <div className="rounded-xl border bg-muted/40 p-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Créditos consumidos</span>
                <span className="font-mono font-bold text-base text-amber-600">{(consumo?.resumen.creditosConsumidosTotal ?? 0).toLocaleString("es-CL")}</span>
              </div>
              <div className="rounded-xl border bg-muted/40 p-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Costo real créditos consumidos</span>
                <span className="font-mono font-bold text-base">
                  {formatCLP(Math.round((consumo?.resumen.creditosConsumidosTotal ?? 0) * valorCreditoNum))}
                </span>
              </div>
            </div>

            <div className="rounded-xl border overflow-x-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead>
                  <tr className="bg-muted/60 border-b">
                    <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Empresa</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Plan</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Asignados</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Consumidos</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Disponibles</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Costo real</th>
                  </tr>
                </thead>
                <tbody>
                  {(consumo?.billeteras ?? []).map((b) => (
                    <tr key={b.companyId} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 px-3 font-medium text-foreground">{b.companyName}</td>
                      <td className="py-2 px-3 text-muted-foreground">{b.planName}</td>
                      <td className="py-2 px-3 text-right font-mono">{b.monthlyAllowance.toLocaleString("es-CL")}</td>
                      <td className="py-2 px-3 text-right font-mono text-amber-600">{b.consumedMonth.toLocaleString("es-CL")}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{b.balance.toLocaleString("es-CL")}</td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                        {formatCLP(Math.round(b.consumedMonth * valorCreditoNum))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* GUARDAR */}
      <div className="flex items-center justify-end gap-3">
        {guardadoExito && (
          <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
            <Check className="h-3.5 w-3.5" /> Guardado
          </span>
        )}
        <Button onClick={() => void handleGuardar()} disabled={guardando} className="gap-2">
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar configuración económica
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5" /> La única unidad de medición es el crédito gastado en el API Gateway; los planes definen la cuota mensual de cada cliente.
      </p>
    </div>
  );
}
