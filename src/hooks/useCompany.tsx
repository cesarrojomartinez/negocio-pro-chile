import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/hooks/useAuth";
import {
  cloudTaxDataService,
  type EmpresaCloud,
  type PeriodoCloud,
} from "@/services/cloudTaxDataService";
import {
  asegurarEmpresaDemoFn,
  crearEmpresaFn,
} from "@/lib/companies.functions";

const CLAVE_EMPRESA = "mnad.empresa-activa";

export type ModoApp = "demo" | "cloud";

interface CompanyState {
  modo: ModoApp;
  empresas: EmpresaCloud[];
  empresaActiva: EmpresaCloud | null;
  periodos: PeriodoCloud[];
  cargandoEmpresas: boolean;
  errorEmpresas: string | null;
  necesitaOnboarding: boolean;
  seleccionarEmpresa: (id: string) => void;
  refrescarEmpresas: () => Promise<void>;
  crearEmpresa: (entrada: {
    rut: string;
    razonSocial: string;
    nombreFantasia?: string;
    actividad?: string;
  }) => Promise<{ error: string | null }>;
  crearEmpresaDemo: () => Promise<{ error: string | null }>;
}

const CompanyContext = createContext<CompanyState | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { session, cargandoSesion } = useAuth();
  const [empresas, setEmpresas] = useState<EmpresaCloud[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoCloud[]>([]);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [cargandoEmpresas, setCargandoEmpresas] = useState(false);
  const [errorEmpresas, setErrorEmpresas] = useState<string | null>(null);
  const [inicializado, setInicializado] = useState(false);

  const modo: ModoApp = session ? "cloud" : "demo";

  const cargarEmpresas = useCallback(async () => {
    if (!session) {
      setEmpresas([]);
      setPeriodos([]);
      setEmpresaId(null);
      setInicializado(true);
      return;
    }
    setCargandoEmpresas(true);
    setErrorEmpresas(null);
    try {
      const lista = await cloudTaxDataService.getCompanies();
      setEmpresas(lista);
      setEmpresaId((actual) => {
        if (actual && lista.some((e) => e.id === actual)) return actual;
        const guardada =
          typeof window !== "undefined" ? localStorage.getItem(CLAVE_EMPRESA) : null;
        if (guardada && lista.some((e) => e.id === guardada)) return guardada;
        return lista[0]?.id ?? null;
      });
    } catch (error) {
      console.error("[empresas]", error);
      setErrorEmpresas("No pudimos cargar la información de tu empresa. Intenta nuevamente.");
    } finally {
      setCargandoEmpresas(false);
      setInicializado(true);
    }
  }, [session]);

  useEffect(() => {
    if (cargandoSesion) return;
    void cargarEmpresas();
  }, [cargandoSesion, cargarEmpresas]);

  useEffect(() => {
    if (!empresaId) {
      setPeriodos([]);
      return;
    }
    let vigente = true;
    void cloudTaxDataService
      .getPeriods(empresaId)
      .then((p) => {
        if (vigente) setPeriodos(p);
      })
      .catch((error) => {
        console.error("[periodos]", error);
        if (vigente) setPeriodos([]);
      });
    return () => {
      vigente = false;
    };
  }, [empresaId]);

  const seleccionarEmpresa = useCallback((id: string) => {
    setEmpresaId(id);
    if (typeof window !== "undefined") localStorage.setItem(CLAVE_EMPRESA, id);
  }, []);

  const crearEmpresa = useCallback<CompanyState["crearEmpresa"]>(
    async (entrada) => {
      const r = await crearEmpresaFn({ data: entrada });
      if (!r.ok) return { error: r.error };
      await cargarEmpresas();
      seleccionarEmpresa(r.data.id);
      return { error: null };
    },
    [cargarEmpresas, seleccionarEmpresa],
  );

  const crearEmpresaDemo = useCallback<CompanyState["crearEmpresaDemo"]>(async () => {
    const r = await asegurarEmpresaDemoFn();
    if (!r.ok) return { error: r.error };
    await cargarEmpresas();
    seleccionarEmpresa(r.data.id);
    return { error: null };
  }, [cargarEmpresas, seleccionarEmpresa]);

  const empresaActiva = useMemo(
    () => empresas.find((e) => e.id === empresaId) ?? null,
    [empresas, empresaId],
  );

  const value = useMemo<CompanyState>(
    () => ({
      modo,
      empresas,
      empresaActiva,
      periodos,
      cargandoEmpresas,
      errorEmpresas,
      necesitaOnboarding:
        modo === "cloud" && inicializado && !cargandoEmpresas && empresas.length === 0,
      seleccionarEmpresa,
      refrescarEmpresas: cargarEmpresas,
      crearEmpresa,
      crearEmpresaDemo,
    }),
    [
      modo,
      empresas,
      empresaActiva,
      periodos,
      cargandoEmpresas,
      errorEmpresas,
      inicializado,
      seleccionarEmpresa,
      cargarEmpresas,
      crearEmpresa,
      crearEmpresaDemo,
    ],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany(): CompanyState {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany debe usarse dentro de CompanyProvider");
  return ctx;
}
