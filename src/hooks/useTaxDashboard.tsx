import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { mockTaxDataService } from "@/services/mockTaxDataService";
import { obtenerPeriodoData, PERIODOS } from "@/data/mockTaxData";
import type { EscenarioId, EstadoConexionSii } from "@/types/company";
import type { DashboardData } from "@/types/tax";

interface DashboardState {
  data: DashboardData | null;
  cargando: boolean;
  error: string | null;
  actualizando: boolean;
  periodoId: string;
  escenario: EscenarioId;
  margenPorcentaje: number;
  dineroReservado: number;
  metaMensual: number;
  estadoConexion: EstadoConexionSii;
  ultimaSincronizacion: string | null;
  setPeriodo: (id: string) => void;
  setEscenario: (id: EscenarioId) => void;
  setMargenPorcentaje: (v: number) => void;
  setDineroReservado: (v: number) => void;
  setMetaMensual: (v: number) => void;
  actualizar: () => Promise<void>;
  conectarDemo: () => Promise<void>;
  desconectar: () => void;
}

const TaxDashboardContext = createContext<DashboardState | null>(null);

export function TaxDashboardProvider({ children }: { children: ReactNode }) {
  const [periodoId, setPeriodoId] = useState(PERIODOS[0].id);
  const [escenario, setEscenarioState] = useState<EscenarioId>("equilibrado");
  const [margenPorcentaje, setMargenPorcentaje] = useState(10);
  const base = obtenerPeriodoData("equilibrado", PERIODOS[0].id);
  const [dineroReservado, setDineroReservado] = useState(base.dineroReservado);
  const [metaMensual, setMetaMensual] = useState(base.metaMensual);
  const [data, setData] = useState<DashboardData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estadoConexion, setEstadoConexion] =
    useState<EstadoConexionSii>("connected");
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!ultimaSincronizacion) setUltimaSincronizacion(new Date().toISOString());
    // solo en cliente para evitar diferencias de hidratación
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await mockTaxDataService.obtenerDashboard({
        escenario,
        periodoId,
        margenPorcentaje,
        dineroReservado,
        metaMensual,
      });
      setData(resultado);
    } catch {
      setError("No pudimos cargar la información demostrativa. Intenta nuevamente.");
    } finally {
      setCargando(false);
    }
  }, [escenario, periodoId, margenPorcentaje, dineroReservado, metaMensual]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiarPeriodo = useCallback(
    (id: string) => {
      const d = obtenerPeriodoData(escenario, id);
      setPeriodoId(id);
      setDineroReservado(d.dineroReservado);
      setMetaMensual(d.metaMensual);
    },
    [escenario],
  );

  const cambiarEscenario = useCallback(
    (id: EscenarioId) => {
      const d = obtenerPeriodoData(id, periodoId);
      setEscenarioState(id);
      setDineroReservado(d.dineroReservado);
      setMetaMensual(d.metaMensual);
    },
    [periodoId],
  );

  const actualizar = useCallback(async () => {
    setActualizando(true);
    try {
      const fecha = await mockTaxDataService.sincronizar();
      setUltimaSincronizacion(fecha);
      setEstadoConexion((prev) => (prev === "disconnected" ? prev : "connected"));
      await cargar();
      toast.success("Información demostrativa actualizada", {
        description: "Los datos mostrados corresponden a una demostración.",
      });
    } finally {
      setActualizando(false);
    }
  }, [cargar]);

  const conectarDemo = useCallback(async () => {
    setEstadoConexion("connecting");
    const fecha = await mockTaxDataService.sincronizar();
    setEstadoConexion("connected");
    setUltimaSincronizacion(fecha);
    await cargar();
    toast.success("Conexión demostrativa establecida", {
      description: "Se cargaron datos ficticios. No hubo conexión real con el SII.",
    });
  }, [cargar]);

  const desconectar = useCallback(() => {
    setEstadoConexion("disconnected");
    toast("Conexión demostrativa desactivada", {
      description:
        "Mantenemos los datos demostrativos, pero quedan marcados como no sincronizados.",
    });
  }, []);

  const value = useMemo<DashboardState>(
    () => ({
      data,
      cargando,
      error,
      actualizando,
      periodoId,
      escenario,
      margenPorcentaje,
      dineroReservado,
      metaMensual,
      estadoConexion,
      ultimaSincronizacion,
      setPeriodo: cambiarPeriodo,
      setEscenario: cambiarEscenario,
      setMargenPorcentaje,
      setDineroReservado,
      setMetaMensual,
      actualizar,
      conectarDemo,
      desconectar,
    }),
    [
      data,
      cargando,
      error,
      actualizando,
      periodoId,
      escenario,
      margenPorcentaje,
      dineroReservado,
      metaMensual,
      estadoConexion,
      ultimaSincronizacion,
      cambiarPeriodo,
      cambiarEscenario,
      actualizar,
      conectarDemo,
      desconectar,
    ],
  );

  return (
    <TaxDashboardContext.Provider value={value}>
      {children}
    </TaxDashboardContext.Provider>
  );
}

export function useTaxDashboard(): DashboardState {
  const ctx = useContext(TaxDashboardContext);
  if (!ctx)
    throw new Error("useTaxDashboard debe usarse dentro de TaxDashboardProvider");
  return ctx;
}
