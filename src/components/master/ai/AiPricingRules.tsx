import { useState } from "react";
import {
  Calculator,
  Check,
  Coins,
  Cpu,
  DollarSign,
  Layers,
  Pencil,
  Plus,
  Save,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guardarGrupoConfiguracionMasterFn } from "@/lib/configuracion.functions";
import type { ConfiguracionIaGateway, OperacionCredito } from "@/lib/configuracion";
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
  const [valorCredito, setValorCredito] = useState(String(datosIniciales?.valorUnCreditoClp ?? 0.40));

  /* ── Sección 3: Catálogo de Operaciones ── */
  const [operaciones, setOperaciones] = useState<OperacionCredito[]>(
    datosIniciales?.operaciones ?? [
      { nombre: "Actualizar empresa pequeña", creditosConsumidos: 50 },
      { nombre: "Actualizar empresa mediana", creditosConsumidos: 180 },
      { nombre: "Actualizar empresa grande", creditosConsumidos: 700 },
      { nombre: "Actualizar empresa corporativa", creditosConsumidos: 2500 },
      { nombre: "Analizar F29", creditosConsumidos: 120 },
      { nombre: "Analizar RCV", creditosConsumidos: 180 },
      { nombre: "Generar informe", creditosConsumidos: 80 },
      { nombre: "OCR documento", creditosConsumidos: 30 },
    ],
  );
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null);
  const [nuevaOp, setNuevaOp] = useState({ nombre: "", creditosConsumidos: 0 });

  /* ── Sección 4: Simulador ── */
  const [operacionSimulador, setOperacionSimulador] = useState(0);

  const [guardando, setGuardando] = useState(false);
  const [guardadoExito, setGuardadoExito] = useState(false);

  /* ── Cálculos del simulador ── */
  const opSeleccionada = operaciones[operacionSimulador] ?? operaciones[0];
  const creditosOp = opSeleccionada?.creditosConsumidos ?? 50;
  const valorCreditoNum = parseFloat(valorCredito) || 0.40;
  const margenNum = parseFloat(margenPorcentaje) || 35;
  const costoOperacion = Math.round(creditosOp * valorCreditoNum * 100) / 100;
  const precioPlataforma = Math.round(costoOperacion * (1 + margenNum / 100) * 100) / 100;

  /* ── Handlers operaciones ── */
  const agregarOperacion = () => {
    if (!nuevaOp.nombre.trim()) return;
    setOperaciones([...operaciones, { ...nuevaOp }]);
    setNuevaOp({ nombre: "", creditosConsumidos: 0 });
  };

  const eliminarOperacion = (idx: number) => {
    setOperaciones(operaciones.filter((_, i) => i !== idx));
    if (operacionSimulador >= operaciones.length - 1) setOperacionSimulador(0);
  };

  const actualizarOperacion = (idx: number, campo: keyof OperacionCredito, valor: string | number) => {
    const copia = [...operaciones];
    if (campo === "nombre") copia[idx] = { ...copia[idx], nombre: valor as string };
    else copia[idx] = { ...copia[idx], creditosConsumidos: Number(valor) || 0 };
    setOperaciones(copia);
  };

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
      valorUnCreditoClp: parseFloat(valorCredito) || 0.40,
      operaciones,
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
      {/* ═══════════════════════════════════════════════════
          SECCIÓN 1: ECONOMÍA DEL GATEWAY IA
      ═══════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════
          SECCIÓN 2: VALOR DEL CRÉDITO
      ═══════════════════════════════════════════════════ */}
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

        <div className="flex items-end gap-4">
          <div className="space-y-1.5 flex-1 max-w-xs">
            <Label className="text-xs font-medium">Valor de 1 Crédito (CLP)</Label>
            <Input value={valorCredito} onChange={(e) => setValorCredito(e.target.value)} className="text-sm h-10 font-mono font-bold" type="number" step="0.01" />
          </div>
          <div className="rounded-xl border bg-muted/40 p-3 text-xs space-y-1">
            <span className="text-muted-foreground">Equivalencia:</span>
            <div className="font-mono font-bold text-foreground">100 créditos = {formatCLP(Math.round(valorCreditoNum * 100))}</div>
            <div className="font-mono font-bold text-foreground">1.000 créditos = {formatCLP(Math.round(valorCreditoNum * 1000))}</div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          SECCIÓN 3: CATÁLOGO DE OPERACIONES
      ═══════════════════════════════════════════════════ */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" /> Catálogo de Operaciones
          </h3>
          <Badge variant="outline" className="text-[11px] font-mono bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-700">
            {operaciones.length} operaciones
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Define cuántos créditos consume cada tipo de operación. Estos valores determinan el cálculo de consumo para los clientes.
        </p>

        {/* Tabla de operaciones */}
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/60 border-b">
                <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Operación</th>
                <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground w-40">Créditos</th>
                <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground w-32">Costo (CLP)</th>
                <th className="text-center py-2.5 px-3 font-semibold text-muted-foreground w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {operaciones.map((op, idx) => (
                <tr key={idx} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-2 px-3">
                    {editandoIdx === idx ? (
                      <Input
                        value={op.nombre}
                        onChange={(e) => actualizarOperacion(idx, "nombre", e.target.value)}
                        className="h-7 text-xs"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium text-foreground">{op.nombre}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {editandoIdx === idx ? (
                      <Input
                        value={op.creditosConsumidos}
                        onChange={(e) => actualizarOperacion(idx, "creditosConsumidos", e.target.value)}
                        className="h-7 text-xs font-mono text-right w-24 ml-auto"
                        type="number"
                      />
                    ) : (
                      <span className="font-mono font-bold text-foreground">{op.creditosConsumidos.toLocaleString("es-CL")}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                    {formatCLP(Math.round(op.creditosConsumidos * valorCreditoNum))}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setEditandoIdx(editandoIdx === idx ? null : idx)}
                        type="button"
                      >
                        {editandoIdx === idx ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Pencil className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => eliminarOperacion(idx)}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Agregar nueva operación */}
        <div className="flex items-end gap-3 pt-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs font-medium">Nueva Operación</Label>
            <Input
              value={nuevaOp.nombre}
              onChange={(e) => setNuevaOp({ ...nuevaOp, nombre: e.target.value })}
              placeholder="Nombre de la operación"
              className="h-8 text-xs"
            />
          </div>
          <div className="w-32 space-y-1.5">
            <Label className="text-xs font-medium">Créditos</Label>
            <Input
              value={nuevaOp.creditosConsumidos || ""}
              onChange={(e) => setNuevaOp({ ...nuevaOp, creditosConsumidos: parseInt(e.target.value) || 0 })}
              className="h-8 text-xs font-mono"
              type="number"
            />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={agregarOperacion} type="button">
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          SECCIÓN 4: SIMULADOR ECONÓMICO
      ═══════════════════════════════════════════════════ */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Calculator className="h-4 w-4 text-emerald-600" /> Simulador Económico
          </h3>
          <Badge variant="outline" className="text-[11px] font-mono bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-700">
            Tiempo Real
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Selecciona una operación para visualizar el cálculo económico completo en tiempo real.
        </p>

        {/* Selector de operación */}
        <div className="space-y-1.5 max-w-md">
          <Label className="text-xs font-medium">Operación a simular</Label>
          <select
            value={operacionSimulador}
            onChange={(e) => setOperacionSimulador(parseInt(e.target.value))}
            className="w-full rounded-lg border bg-background px-3 py-2 text-xs"
          >
            {operaciones.map((op, idx) => (
              <option key={idx} value={idx}>
                {op.nombre} ({op.creditosConsumidos.toLocaleString("es-CL")} créditos)
              </option>
            ))}
          </select>
        </div>

        {/* Pipeline visual del simulador */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-xs">
          <div className="rounded-xl border bg-muted/40 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Operación</span>
            <div className="font-medium text-foreground text-[11px] leading-tight">{opSeleccionada?.nombre}</div>
          </div>

          <div className="rounded-xl border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 block">Créditos</span>
            <div className="font-mono font-bold text-amber-700 dark:text-amber-300">{creditosOp.toLocaleString("es-CL")}</div>
            <span className="text-[9px] text-muted-foreground block">× {formatCLP(valorCreditoNum)} c/u</span>
          </div>

          <div className="rounded-xl border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-300 block">Costo Base</span>
            <div className="font-mono font-bold text-blue-700 dark:text-blue-300">{formatCLP(costoOperacion)}</div>
          </div>

          <div className="rounded-xl border bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300 block">Margen</span>
            <div className="font-mono font-bold text-purple-700 dark:text-purple-300">+{margenNum}%</div>
          </div>

          <div className="rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">Precio Cliente</span>
            <div className="font-mono font-bold text-emerald-700 dark:text-emerald-300">{formatCLP(precioPlataforma)}</div>
          </div>
        </div>

        {/* Resumen rentabilidad */}
        <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-xs">
          <h4 className="font-bold text-foreground flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-emerald-600" /> Resumen de Rentabilidad
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div>
              <span className="text-muted-foreground block text-[11px]">Costo operación:</span>
              <span className="font-mono font-bold text-foreground text-sm">{formatCLP(costoOperacion)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Precio cliente:</span>
              <span className="font-mono font-bold text-emerald-600 text-sm">{formatCLP(precioPlataforma)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Ganancia bruta:</span>
              <span className="font-mono font-bold text-primary text-sm">{formatCLP(Math.round((precioPlataforma - costoOperacion) * 100) / 100)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Margen bruto:</span>
              <span className="font-mono font-bold text-primary text-sm">{margenNum}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          BOTÓN GUARDAR GLOBAL
      ═══════════════════════════════════════════════════ */}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={handleGuardar} size="sm" disabled={guardando} className="text-xs gap-1.5">
          {guardadoExito ? <Check className="h-4 w-4 text-emerald-400" /> : <Save className="h-4 w-4" />}
          {guardando ? "Guardando..." : guardadoExito ? "Configuración Guardada" : "Guardar Configuración Económica"}
        </Button>
      </div>
    </div>
  );
}
