import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { apiGatewayService } from "@/services/apiGatewayService";
import { mensajeProveedor } from "@/utils/mensajesProveedor";
import { normalizarPeriodo } from "@/lib/periodo";

/** Códigos que indican sesión vencida del proveedor (no clave incorrecta). */
const CODIGOS_SESION_VENCIDA = ["SESSION_INVALID", "SESSION_EXPIRED", "AUTH_EXPIRED"];

export type EstadoPeriodoActualizacion =
  | "pendiente"
  | "en_curso"
  | "listo"
  | "aviso"
  | "error";

export interface ItemActualizacion {
  periodo: string;
  estado: EstadoPeriodoActualizacion;
  mensaje?: string;
  f29?: string;
  /** Créditos consumidos por este periodo ante el proveedor. */
  creditos?: number;
}

interface SolicitudActualizacion {
  companyId: string;
  rutUsuario: string;
  claveTributaria: string;
  periodos: string[];
  /** Descarga también el detalle documento por documento del RCV. */
  incluirDetalle?: boolean;
}

interface ActualizacionMasivaState {
  items: ItemActualizacion[];
  enCurso: boolean;
  /** El trabajo terminó y aún no se cierra el aviso flotante. */
  terminado: boolean;
  /** El aviso flotante está visible. */
  visible: boolean;
  periodoActual: string | null;
  totales: { listos: number; avisos: number; errores: number; total: number };
  /** Créditos consumidos en este trabajo y saldo informado por el proveedor. */
  creditosUsados: number;
  creditosDisponibles: number | null;
  iniciar: (solicitud: SolicitudActualizacion) => void;
  cerrar: () => void;
  /** Se incrementa al terminar cada periodo, para refrescar el panel. */
  version: number;
}

const Ctx = createContext<ActualizacionMasivaState | null>(null);

export function ActualizacionMasivaProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemActualizacion[]>([]);
  const [enCurso, setEnCurso] = useState(false);
  const [terminado, setTerminado] = useState(false);
  const [visible, setVisible] = useState(false);
  const [periodoActual, setPeriodoActual] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [creditosDisponibles, setCreditosDisponibles] = useState<number | null>(null);
  /** La clave vive solo en memoria mientras dura el trabajo. */
  const claveRef = useRef<string | null>(null);
  const trabajando = useRef(false);

  const marcar = useCallback((periodo: string, cambio: Partial<ItemActualizacion>) => {
    setItems((prev) =>
      prev.map((i) => (i.periodo === periodo ? { ...i, ...cambio } : i)),
    );
  }, []);

  const iniciar = useCallback(
    (solicitud: SolicitudActualizacion) => {
      if (trabajando.current) return;
      const periodos = Array.from(
        new Set(
          solicitud.periodos
            .map((p) => normalizarPeriodo(p))
            .filter((p): p is string => !!p),
        ),
      ).sort();
      if (periodos.length === 0) return;

      trabajando.current = true;
      claveRef.current = solicitud.claveTributaria;
      setItems(periodos.map((periodo) => ({ periodo, estado: "pendiente" })));
      setEnCurso(true);
      setTerminado(false);
      setVisible(true);
      setPeriodoActual(null);
      setCreditosDisponibles(null);

      void (async () => {
        try {
          let sesionNueva = false;
          for (const periodo of periodos) {
            setPeriodoActual(periodo);
            marcar(periodo, { estado: "en_curso" });
            try {
              const r = await apiGatewayService.ejecutarPrueba({
                companyId: solicitud.companyId,
                periodo,
                rutUsuario: solicitud.rutUsuario,
                claveTributaria: claveRef.current ?? "",
                sesionNueva,
                incluirDetalle: solicitud.incluirDetalle === true,
              });
              sesionNueva = CODIGOS_SESION_VENCIDA.includes(r.errorCodigo ?? "");
              const m = mensajeProveedor({
                proveedor: "api_gateway",
                codigo: r.errorCodigo,
                mensaje: r.mensaje,
                productosVerificados: true,
              });
              marcar(periodo, {
                estado:
                  m.tono === "error"
                    ? "error"
                    : m.tono === "warning" || r.f29.estado === "revisar"
                      ? "aviso"
                      : "listo",
                mensaje: m.texto,
                f29: r.f29.mensaje,
                creditos: r.creditosConsumidos,
              });
              if (r.creditosDisponibles != null)
                setCreditosDisponibles(r.creditosDisponibles);
            } catch (error) {
              marcar(periodo, {
                estado: "error",
                mensaje:
                  error instanceof Error
                    ? error.message
                    : "No pudimos completar la actualización.",
              });
            }
            setVersion((n) => n + 1);
          }
        } finally {
          // La clave se descarta siempre, incluso ante un fallo inesperado.
          claveRef.current = null;
          setPeriodoActual(null);
          setEnCurso(false);
          setTerminado(true);
          trabajando.current = false;
        }
      })();

    },
    [marcar],
  );

  const cerrar = useCallback(() => {
    setVisible(false);
    if (!trabajando.current) {
      setItems([]);
      setTerminado(false);
    }
  }, []);

  // Aviso del navegador si se intenta cerrar la pestaña con trabajo en curso.
  useEffect(() => {
    if (!enCurso) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enCurso]);

  const totales = useMemo(
    () => ({
      total: items.length,
      listos: items.filter((i) => i.estado === "listo").length,
      avisos: items.filter((i) => i.estado === "aviso").length,
      errores: items.filter((i) => i.estado === "error").length,
    }),
    [items],
  );

  const creditosUsados = useMemo(
    () => items.reduce((s, i) => s + (i.creditos ?? 0), 0),
    [items],
  );

  const value = useMemo<ActualizacionMasivaState>(
    () => ({
      items,
      creditosUsados,
      creditosDisponibles,
      enCurso,
      terminado,
      visible,
      periodoActual,
      totales,
      iniciar,
      cerrar,
      version,
    }),
    [
      items,
      enCurso,
      terminado,
      visible,
      periodoActual,
      totales,
      iniciar,
      cerrar,
      version,
      creditosUsados,
      creditosDisponibles,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActualizacionMasiva(): ActualizacionMasivaState {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error(
      "useActualizacionMasiva debe usarse dentro de ActualizacionMasivaProvider",
    );
  return ctx;
}
