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
import { cloudTaxDataService } from "@/services/cloudTaxDataService";
import { obtenerPeriodoData, PERIODOS } from "@/data/mockTaxData";
import { useCompany } from "@/hooks/useCompany";
import type { EscenarioId, EstadoConexionSii } from "@/types/company";
import type { DashboardData } from "@/types/tax";

interface OpcionPeriodo {
  id: string;
  etiqueta: string;
}

interface DashboardState {
  modo: "demo" | "cloud";
  data: DashboardData | null;
  cargando: boolean;
  error: string | null;
  actualizando: boolean;
  periodoId: string;
  periodosDisponibles: OpcionPeriodo[];
  escenario: EscenarioId;
  margenPorcentaje: number;
  dineroReservado: number;
  metaMensual: number;
  soloLectura: boolean;
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
  const { modo, empresaActiva, periodos, cargandoEmpresas, refrescarEmpresas } =
    useCompany();

  const [periodoId, setPeriodoId] = useState(PERIODOS[0].id);
  const [escenario, setEscenarioState] = useState<EscenarioId>("equilibrado");
  const [margenPorcentaje, setMargenPorcentajeState] = useState(10);
  const base = obtenerPeriodoData("equilibrado", PERIODOS[0].id);
  const [dineroReservado, setDineroReservadoState] = useState(base.dineroReservado);
  const [metaMensual, setMetaMensualState] = useState(base.metaMensual);
  const [data, setData] = useState<DashboardData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estadoConexionDemo, setEstadoConexionDemo] =
    useState<EstadoConexionSii>("connected");
  const [ultimaSincronizacionDemo, setUltimaSincronizacionDemo] = useState<
    string | null
  >(null);
  const [ajustesCargados, setAjustesCargados] = useState(false);

  const esCloud = modo === "cloud";
  const companyId = empresaActiva?.id ?? null;
  const soloLectura = esCloud && empresaActiva?.rol === "viewer";

  const periodosDisponibles = useMemo<OpcionPeriodo[]>(
    () =>
      esCloud
        ? periodos.map((p) => ({ id: p.periodo, etiqueta: p.etiqueta }))
        : PERIODOS.map((p) => ({ id: p.id, etiqueta: p.etiqueta })),
    [esCloud, periodos],
  );

  useEffect(() => {
    if (!ultimaSincronizacionDemo)
      setUltimaSincronizacionDemo(new Date().toISOString());
    // solo en cliente para evitar diferencias de hidratación
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza el periodo activo con los periodos de la empresa en modo Cloud.
  useEffect(() => {
    if (!esCloud || periodosDisponibles.length === 0) return;
    if (!periodosDisponibles.some((p) => p.id === periodoId)) {
      setPeriodoId(periodosDisponibles[0].id);
    }
  }, [esCloud, periodosDisponibles, periodoId]);

  // Carga los ajustes guardados de la empresa (meta, reserva, margen).
  useEffect(() => {
    if (!esCloud || !companyId) {
      setAjustesCargados(!esCloud);
      return;
    }
    let vigente = true;
    setAjustesCargados(false);
    void cloudTaxDataService
      .getSettings(companyId)
      .then((s) => {
        if (!vigente || !s) return;
        setMargenPorcentajeState(s.margenPorcentaje);
        setDineroReservadoState(s.dineroReservado);
        if (s.metaMensual != null) setMetaMensualState(s.metaMensual);
      })
      .catch((e) => console.error("[ajustes]", e))
      .finally(() => {
        if (vigente) setAjustesCargados(true);
      });
    return () => {
      vigente = false;
    };
  }, [esCloud, companyId]);

  const cargar = useCallback(async () => {
    if (esCloud && (!companyId || !ajustesCargados)) {
      setCargando(cargandoEmpresas || !!companyId);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const servicio = esCloud ? cloudTaxDataService : mockTaxDataService;
      const resultado = await servicio.obtenerDashboard({
        escenario,
        periodoId,
        margenPorcentaje,
        dineroReservado,
        metaMensual,
        companyId,
      });
      setData(resultado);
    } catch {
      setError(
        esCloud
          ? "No pudimos cargar la información de tu empresa. Intenta nuevamente."
          : "No pudimos cargar la información demostrativa. Intenta nuevamente.",
      );
    } finally {
      setCargando(false);
    }
  }, [
    esCloud,
    companyId,
    ajustesCargados,
    cargandoEmpresas,
    escenario,
    periodoId,
    margenPorcentaje,
    dineroReservado,
    metaMensual,
  ]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiarPeriodo = useCallback(
    (id: string) => {
      setPeriodoId(id);
      if (esCloud) return;
      const d = obtenerPeriodoData(escenario, id);
      setDineroReservadoState(d.dineroReservado);
      setMetaMensualState(d.metaMensual);
    },
    [escenario, esCloud],
  );

  const cambiarEscenario = useCallback(
    (id: EscenarioId) => {
      if (esCloud) return;
      const d = obtenerPeriodoData(id, periodoId);
      setEscenarioState(id);
      setDineroReservadoState(d.dineroReservado);
      setMetaMensualState(d.metaMensual);
    },
    [periodoId, esCloud],
  );

  const guardarCloud = useCallback(
    async (accion: () => Promise<void>) => {
      try {
        await accion();
      } catch {
        toast.error("No pudimos guardar el cambio", {
          description: "Revisa tu conexión e intenta nuevamente.",
        });
      }
    },
    [],
  );

  const cambiarMargen = useCallback(
    (v: number) => {
      setMargenPorcentajeState(v);
      if (esCloud && companyId && !soloLectura)
        void guardarCloud(() =>
          cloudTaxDataService.updatePreventiveMargin(companyId, v),
        );
    },
    [esCloud, companyId, soloLectura, guardarCloud],
  );

  const cambiarReservado = useCallback(
    (v: number) => {
      setDineroReservadoState(v);
      if (esCloud && companyId && !soloLectura)
        void guardarCloud(() =>
          cloudTaxDataService.updateReservedAmount(companyId, v),
        );
    },
    [esCloud, companyId, soloLectura, guardarCloud],
  );

  const cambiarMeta = useCallback(
    (v: number) => {
      setMetaMensualState(v);
      if (esCloud && companyId && !soloLectura)
        void guardarCloud(() =>
          cloudTaxDataService.updateGoal(companyId, periodoId, v),
        );
    },
    [esCloud, companyId, periodoId, soloLectura, guardarCloud],
  );

  const actualizar = useCallback(async () => {
    setActualizando(true);
    try {
      if (esCloud && companyId) {
        await cloudTaxDataService.sincronizar(companyId, periodoId);
        await refrescarEmpresas();
      } else {
        const fecha = await mockTaxDataService.sincronizar();
        setUltimaSincronizacionDemo(fecha);
        setEstadoConexionDemo((prev) =>
          prev === "disconnected" ? prev : "connected",
        );
      }
      await cargar();
      toast.success("Información actualizada", {
        description: "Los datos mostrados son una estimación informativa.",
      });
    } catch {
      toast.error("No pudimos actualizar la información", {
        description: "Intenta nuevamente en unos segundos.",
      });
    } finally {
      setActualizando(false);
    }
  }, [cargar, esCloud, companyId, periodoId, refrescarEmpresas]);

  const conectarDemo = useCallback(async () => {
    if (esCloud && companyId) {
      try {
        await cloudTaxDataService.connectDemo(companyId);
        await refrescarEmpresas();
        await cargar();
        toast.success("Conexión demostrativa establecida", {
          description: "No hubo conexión real con el SII.",
        });
      } catch {
        toast.error("No pudimos activar la conexión demostrativa");
      }
      return;
    }
    setEstadoConexionDemo("connecting");
    const fecha = await mockTaxDataService.sincronizar();
    setEstadoConexionDemo("connected");
    setUltimaSincronizacionDemo(fecha);
    await cargar();
    toast.success("Conexión demostrativa establecida", {
      description: "Se cargaron datos ficticios. No hubo conexión real con el SII.",
    });
  }, [cargar, esCloud, companyId, refrescarEmpresas]);

  const desconectar = useCallback(() => {
    if (esCloud && companyId) {
      void cloudTaxDataService
        .disconnectDemo(companyId)
        .then(() => refrescarEmpresas())
        .then(() =>
          toast("Conexión demostrativa desactivada", {
            description: "Los datos quedan marcados como no sincronizados.",
          }),
        )
        .catch(() => toast.error("No pudimos desactivar la conexión demostrativa"));
      return;
    }
    setEstadoConexionDemo("disconnected");
    toast("Conexión demostrativa desactivada", {
      description:
        "Mantenemos los datos demostrativos, pero quedan marcados como no sincronizados.",
    });
  }, [esCloud, companyId, refrescarEmpresas]);

  const estadoConexion: EstadoConexionSii = esCloud
    ? (empresaActiva?.estadoConexion ?? "disconnected")
    : estadoConexionDemo;
  const ultimaSincronizacion = esCloud
    ? (empresaActiva?.ultimaSincronizacion ?? null)
    : ultimaSincronizacionDemo;

  const value = useMemo<DashboardState>(
    () => ({
      modo,
      data,
      cargando,
      error,
      actualizando,
      periodoId,
      periodosDisponibles,
      escenario,
      margenPorcentaje,
      dineroReservado,
      metaMensual,
      soloLectura,
      estadoConexion,
      ultimaSincronizacion,
      setPeriodo: cambiarPeriodo,
      setEscenario: cambiarEscenario,
      setMargenPorcentaje: cambiarMargen,
      setDineroReservado: cambiarReservado,
      setMetaMensual: cambiarMeta,
      actualizar,
      conectarDemo,
      desconectar,
    }),
    [
      modo,
      data,
      cargando,
      error,
      actualizando,
      periodoId,
      periodosDisponibles,
      escenario,
      margenPorcentaje,
      dineroReservado,
      metaMensual,
      soloLectura,
      estadoConexion,
      ultimaSincronizacion,
      cambiarPeriodo,
      cambiarEscenario,
      cambiarMargen,
      cambiarReservado,
      cambiarMeta,
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
