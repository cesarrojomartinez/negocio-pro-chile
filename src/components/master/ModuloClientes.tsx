import { useState } from "react";
import { toast } from "sonner";

import { SectionCard, DataRow } from "@/components/shared/SectionCard";
import {
  BotonCsv,
  CargandoMaster,
  ErrorMaster,
  EtiquetaEstado,
  TablaMaster,
  useRecursoMaster,
} from "@/components/master/MasterUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ETIQUETA_ESTADO, type EstadoCuenta } from "@/lib/cuenta";
import {
  cambiarPlanClienteFn,
  clientesMasterFn,
  fichaClienteMasterFn,
  notaInternaMasterFn,
  planesMasterFn,
} from "@/lib/master.functions";
import { cambiarEstadoCuentaFn } from "@/lib/cuenta.functions";
import type { ClienteMaster, FichaClienteMaster } from "@/lib/master.server";
import { formatCLP, formatFechaHora, formatNumero } from "@/utils/currency";

const TONO_ESTADO: Record<string, "success" | "primary" | "warning" | "danger"> = {
  active: "success",
  trial: "primary",
  payment_pending: "warning",
  suspended: "danger",
  cancelled: "danger",
};

export function ModuloClientes() {
  const { datos, error, cargando, recargar } = useRecursoMaster<ClienteMaster[]>(() =>
    clientesMasterFn(),
  );
  const [filtro, setFiltro] = useState("");
  const [estado, setEstado] = useState("todos");
  const [ficha, setFicha] = useState<FichaClienteMaster | null>(null);
  const [abriendo, setAbriendo] = useState(false);

  const abrirFicha = async (companyId: string) => {
    setAbriendo(true);
    const r = await fichaClienteMasterFn({ data: { companyId } });
    setAbriendo(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setFicha(r.data);
  };

  if (cargando) return <CargandoMaster texto="Cargando clientes…" />;
  if (error || !datos) return <ErrorMaster mensaje={error ?? "Sin información."} />;

  const texto = filtro.trim().toLowerCase();
  const lista = datos.filter(
    (c) =>
      (estado === "todos" || c.estadoCuenta === estado) &&
      `${c.empresa} ${c.rut} ${c.correo ?? ""}`.toLowerCase().includes(texto),
  );

  return (
    <div className="space-y-5">
      <SectionCard
        titulo="Clientes"
        descripcion="Listado de empresas registradas, su plan, su consumo y su estado."
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-9 w-[200px]"
              placeholder="Buscar por nombre, RUT o correo"
              aria-label="Buscar cliente"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger className="h-9 w-[160px]" aria-label="Filtrar por estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {(
                  ["active", "trial", "payment_pending", "suspended", "cancelled"] as const
                ).map((e) => (
                  <SelectItem key={e} value={e}>
                    {ETIQUETA_ESTADO[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <BotonCsv
              nombre="clientes"
              cabeceras={[
                "Empresa",
                "RUT",
                "Plan",
                "Estado",
                "Usuarios",
                "Consultas mes",
                "Unidades mes",
                "Errores",
              ]}
              filas={lista.map((c) => [
                c.empresa,
                c.rut,
                c.plan,
                ETIQUETA_ESTADO[c.estadoCuenta],
                c.usuarios,
                c.consultasMes,
                c.unidadesMes,
                c.erroresRecientes,
              ])}
            />
          </div>
        }
      >
        <TablaMaster
          cabeceras={[
            "Empresa",
            "Plan",
            "Estado",
            "Usuarios",
            "Consumo del mes",
            "Última actualización",
            "",
          ]}
          vacio="No hay clientes que coincidan con la búsqueda."
          filas={lista.map((c) => ({
            clave: c.companyId,
            celdas: [
              <span key="e">
                <span className="font-medium">{c.empresa}</span>
                {c.esDemo && (
                  <span className="ml-2 text-xs text-muted-foreground">Demostración</span>
                )}
                <span className="block text-xs text-muted-foreground">
                  RUT {c.rut}
                  {c.correo ? ` · ${c.correo}` : ""}
                </span>
              </span>,
              c.plan,
              <EtiquetaEstado
                key="s"
                texto={ETIQUETA_ESTADO[c.estadoCuenta]}
                tono={TONO_ESTADO[c.estadoCuenta] ?? "default"}
              />,
              formatNumero(c.usuarios),
              <span key="c">
                {formatNumero(c.consultasMes)} consultas
                <span className="block text-xs text-muted-foreground">
                  {formatNumero(c.unidadesMes)} unidades · {formatNumero(c.cacheMes)} con
                  caché
                </span>
              </span>,
              c.ultimaActualizacion
                ? formatFechaHora(c.ultimaActualizacion)
                : "Por confirmar",
              <Button
                key="b"
                size="sm"
                variant="outline"
                disabled={abriendo}
                onClick={() => void abrirFicha(c.companyId)}
              >
                Ver ficha
              </Button>,
            ],
          }))}
        />
      </SectionCard>

      <FichaCliente
        ficha={ficha}
        onCerrar={() => setFicha(null)}
        onCambio={async () => {
          await recargar();
          if (ficha) await abrirFicha(ficha.cliente.companyId);
        }}
      />
    </div>
  );
}

function FichaCliente({
  ficha,
  onCerrar,
  onCambio,
}: {
  ficha: FichaClienteMaster | null;
  onCerrar: () => void;
  onCambio: () => Promise<void>;
}) {
  const [nota, setNota] = useState("");
  const [plan, setPlan] = useState("");
  const { datos: planes } = useRecursoMaster(() => planesMasterFn());

  if (!ficha) return null;
  const c = ficha.cliente;

  const guardarNota = async () => {
    const r = await notaInternaMasterFn({
      data: {
        entidad: "cliente",
        entidadId: c.companyId,
        companyId: c.companyId,
        cuerpo: nota,
      },
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setNota("");
    toast.success("Observación guardada.");
    await onCambio();
  };

  const cambiarEstado = async (estado: EstadoCuenta) => {
    const r = await cambiarEstadoCuentaFn({ data: { companyId: c.companyId, estado } });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Estado actualizado.");
    await onCambio();
  };

  const cambiarPlan = async () => {
    if (!plan) return;
    const r = await cambiarPlanClienteFn({
      data: { companyId: c.companyId, codigoPlan: plan },
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Plan actualizado.");
    await onCambio();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{c.empresa}</DialogTitle>
          <DialogDescription>
            Modo soporte de solo lectura. No se muestran claves ni credenciales de
            ningún tipo y cada acceso queda auditado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <DataRow label="RUT" value={c.rut} />
            <DataRow label="Contacto" value={c.correo ?? c.contacto ?? "—"} />
            <DataRow label="Plan" value={c.plan} />
            <DataRow label="Estado" value={ETIQUETA_ESTADO[c.estadoCuenta]} />
            <DataRow label="Registro" value={formatFechaHora(c.registro)} />
            <DataRow
              label="Actualizaciones usadas"
              value={`${ficha.suscripcion?.actualizacionesUsadas ?? 0}`}
            />
            <DataRow
              label="Consumo del mes"
              value={`${formatNumero(ficha.consumo.unidadesTotales)} unidades`}
              hint={`${formatNumero(ficha.consumo.consultasTotales)} consultas · ${formatNumero(ficha.consumo.consultasEvitadasPorCache)} evitadas con caché`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void cambiarEstado("active")}>
              Activar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void cambiarEstado("suspended")}
            >
              Suspender
            </Button>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger className="h-9 w-[170px]" aria-label="Elegir plan">
                <SelectValue placeholder="Cambiar de plan" />
              </SelectTrigger>
              <SelectContent>
                {(planes ?? []).map((p) => (
                  <SelectItem key={p.codigo} value={p.codigo}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={!plan} onClick={() => void cambiarPlan()}>
              Aplicar plan
            </Button>
          </div>

          <Bloque titulo="Usuarios de la empresa">
            <TablaMaster
              cabeceras={["Nombre", "Correo", "Rol", "Estado"]}
              filas={ficha.miembros.map((m, i) => ({
                clave: `${m.correo ?? i}`,
                celdas: [m.nombre ?? "—", m.correo ?? "—", m.rol, m.estado],
              }))}
            />
          </Bloque>

          <Bloque titulo="Pagos registrados">
            <TablaMaster
              cabeceras={["Fecha", "Tipo", "Monto", "Estado"]}
              filas={ficha.pagos.slice(0, 10).map((p) => ({
                clave: p.id,
                celdas: [
                  formatFechaHora(p.fecha),
                  p.tipo,
                  p.monto == null ? "—" : formatCLP(p.monto),
                  p.estado,
                ],
              }))}
            />
          </Bloque>

          <Bloque titulo="Periodos con información">
            <TablaMaster
              cabeceras={["Periodo", "Estado", "Fuente", "Actualizado"]}
              filas={ficha.periodos.slice(0, 12).map((p) => ({
                clave: p.periodo,
                celdas: [
                  p.periodo,
                  p.estado,
                  p.fuente,
                  p.actualizado ? formatFechaHora(p.actualizado) : "—",
                ],
              }))}
            />
          </Bloque>

          <Bloque titulo="Actividad reciente">
            <TablaMaster
              cabeceras={["Fecha", "Acción"]}
              filas={ficha.actividad.slice(0, 15).map((a, i) => ({
                clave: `${a.fecha}-${i}`,
                celdas: [formatFechaHora(a.fecha), a.accion],
              }))}
            />
          </Bloque>

          <Bloque titulo="Observaciones internas">
            <div className="space-y-2">
              <Textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Anota aquí el contexto del cliente (solo lo ve el equipo)."
                rows={3}
              />
              <Button size="sm" disabled={nota.trim().length < 3} onClick={() => void guardarNota()}>
                Guardar observación
              </Button>
              {ficha.notas.map((n) => (
                <p key={n.id} className="rounded-lg bg-secondary px-3 py-2 text-sm">
                  {n.cuerpo}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {n.autor ?? "Equipo"} · {formatFechaHora(n.fecha)}
                  </span>
                </p>
              ))}
            </div>
          </Bloque>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="mb-2 text-sm font-semibold">{titulo}</p>
      {children}
    </div>
  );
}
