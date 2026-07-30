import { useEffect, useState } from "react";
import { Link2, Loader2, RefreshCw, ShieldCheck, Unlink } from "lucide-react";
import { toast } from "sonner";

import { SectionCard, DataRow } from "@/components/shared/SectionCard";
import { ConnectionBadge } from "@/components/shared/Badges";
import { SimulatedDataNotice } from "@/components/shared/SimulatedDataNotice";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCompany } from "@/hooks/useCompany";
import { useTaxDashboard } from "@/hooks/useTaxDashboard";
import { siiConnectionService } from "@/services/siiConnectionService";
import type { RegistroSincronizacion } from "@/lib/siiSync.server";
import { formatFechaHora } from "@/utils/currency";
import { mensajeProveedor } from "@/utils/mensajesProveedor";

import { formatearRut } from "@/lib/rut";

const ETIQUETA_TIPO: Record<string, string> = {
  manual: "Manual",
  login_refresh: "Al ingresar",
  weekly_refresh: "Semanal",
  scheduled: "Programada",
  demo_connect: "Al conectar",
  retry: "Reintento",
  demo: "Demostrativa",
  gateway: "Proveedor",
};

const ETIQUETA_ESTADO: Record<string, string> = {
  success: "Completada",
  partial: "Parcial",
  failed: "Con problemas",
  skipped: "Sin cambios",
  running: "En curso",
};

/**
 * Panel de conexión simulada con el SII: autorización, sincronización manual
 * e historial de uso. Toda la operación ocurre en el servidor.
 */
export function SiiConnectionPanel() {
  const { empresaActiva, refrescarEmpresas, modo } = useCompany();

  const {
    estadoConexion,
    ultimaSincronizacion,
    conexionSii,
    resumenSincronizacion,
    actualizar,
    actualizando,
    conectarDemo,
    desconectar,
    soloLectura,
    periodoId,
  } = useTaxDashboard();

  const [abierto, setAbierto] = useState(false);
  const [acepta, setAcepta] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [historial, setHistorial] = useState<RegistroSincronizacion[]>([]);
  const companyId = empresaActiva?.id ?? null;

  useEffect(() => {
    if (!companyId) {
      setHistorial([]);
      return;
    }
    let vigente = true;
    void siiConnectionService
      .historial(companyId, 8)
      .then((h) => {
        if (vigente) setHistorial(h);
      })
      .catch(() => {
        if (vigente) setHistorial([]);
      });
    return () => {
      vigente = false;
    };
  }, [companyId, ultimaSincronizacion, resumenSincronizacion]);

  const conectado = estadoConexion === "connected" || estadoConexion === "stale";
  // Autorizar o cortar la conexión es una decisión del dueño de la empresa.
  const puedeAutorizar = modo === "demo" || empresaActiva?.rol === "owner";


  return (
    <div className="space-y-5">
      <SectionCard
        titulo="Conexión con el SII (demostrativa)"
        descripcion="Reproduce el flujo futuro de consulta al SII usando un proveedor simulado. No se piden ni se guardan claves."
      >
        <SimulatedDataNotice className="mb-4" />

        <div className="flex flex-wrap items-center gap-3">
          <ConnectionBadge estado={estadoConexion} />
          <span className="text-sm text-muted-foreground">
            Última sincronización: {formatFechaHora(ultimaSincronizacion)}
          </span>
        </div>

        <div className="mt-4 rounded-2xl bg-secondary/60 p-4">
          <DataRow
            label="Proveedor"
            value={conexionSii?.simulado === false ? "API Gateway" : "Proveedor simulado"}
          />
          <DataRow
            label="RUT autorizado"
            value={
              conexionSii?.rutAutorizado
                ? formatearRut(conexionSii.rutAutorizado)
                : empresaActiva
                  ? formatearRut(empresaActiva.rut)
                  : "—"
            }
          />
          <DataRow label="Método" value="Autorización demostrativa" />
          <DataRow
            label="Autorización vigente hasta"
            value={conexionSii?.expiraEn ? formatFechaHora(conexionSii.expiraEn) : "—"}
          />
          {conexionSii?.ultimoErrorMensaje && (
            <DataRow
              label="Último aviso"
              value={
                mensajeProveedor({
                  proveedor: conexionSii.simulado === false ? "api_gateway" : "mock",
                  codigo: conexionSii.ultimoErrorCodigo ?? null,
                  mensaje: conexionSii.ultimoErrorMensaje,
                  productosVerificados: true,
                }).texto
              }
            />
          )}

        </div>

        {resumenSincronizacion && (
          <p className="mt-3 rounded-xl bg-info-soft px-3 py-2 text-sm text-primary">
            {resumenSincronizacion}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setAcepta(false);
              setAbierto(true);
            }}
            disabled={soloLectura || !puedeAutorizar}
          >
            <Link2 className="h-4 w-4" aria-hidden />
            {conectado ? "Revisar autorización" : "Conectar SII (demostrativo)"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void actualizar()}
            disabled={!conectado || actualizando || soloLectura}
          >
            {actualizando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            Actualizar {periodoId}
          </Button>
          <Button
            variant="outline"
            onClick={desconectar}
            disabled={!conectado || soloLectura || !puedeAutorizar}
          >
            <Unlink className="h-4 w-4" aria-hidden />
            Desconectar
          </Button>
        </div>

        {!puedeAutorizar && (
          <p className="mt-3 text-sm text-muted-foreground">
            Solo quien figura como dueño de la empresa puede autorizar o cortar
            la conexión. Tú sí puedes actualizar la información cuando esté
            conectada.
          </p>
        )}
      </SectionCard>


      <SectionCard
        titulo="Historial de sincronizaciones"
        descripcion="Registro de cada consulta demostrativa, incluidas las que no fue necesario repetir."
      >
        {historial.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay sincronizaciones registradas para esta empresa.
          </p>
        ) : (
          <ul className="space-y-2">
            {historial.map((h) => (
              <li
                key={h.id}
                className="rounded-xl border border-border px-3 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {ETIQUETA_ESTADO[h.estado] ?? h.estado}
                    {h.periodo ? ` · ${h.periodo}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatFechaHora(h.completada ?? h.iniciada)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ETIQUETA_TIPO[h.tipo] ?? h.tipo} · {h.documentos} documentos ·{" "}
                  {h.consultas} consultas al proveedor
                  {h.desdeCache ? " · información reutilizada" : ""}
                </p>
                {h.errorMensaje && (
                  <p className="mt-1 text-xs text-destructive">{h.errorMensaje}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Autorización demostrativa</DialogTitle>
            <DialogDescription>
              Estás por activar una conexión simulada. No se solicita Clave
              Tributaria, ClaveÚnica, certificados ni ningún dato real, y no se
              establece contacto con el SII.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <SimulatedDataNotice />
            <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
              Al continuar autorizas que la aplicación consulte información
              ficticia del RUT{" "}
              <strong>
                {empresaActiva ? formatearRut(empresaActiva.rut) : "—"}
              </strong>{" "}
              para estimar tus impuestos del mes. Puedes desconectar cuando
              quieras.
            </p>
            <div className="flex items-start gap-2">
              <Checkbox
                id="consentimiento-sii"
                checked={acepta}
                onCheckedChange={(v) => setAcepta(v === true)}
              />
              <Label htmlFor="consentimiento-sii" className="text-sm leading-snug">
                Entiendo que esta conexión es demostrativa y que las cifras son
                una estimación informativa.
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setAbierto(false)}>
              Cerrar
            </Button>
            <Button
              disabled={!acepta || conectando}
              onClick={async () => {
                setConectando(true);
                try {
                  await conectarDemo();
                  await refrescarEmpresas();
                  setAbierto(false);
                } catch {
                  toast.error("No pudimos activar la conexión demostrativa");
                } finally {
                  setConectando(false);
                }
              }}
            >
              {conectando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden />
              )}
              {conectando ? "Conectando" : "Autorizar y sincronizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
