import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/shared/AppShell";
import { DataRow, SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCompany } from "@/hooks/useCompany";
import { formatCLP, formatFechaHora } from "@/utils/currency";
import { ETIQUETA_ESTADO, type Plan } from "@/lib/cuenta";
import { ETIQUETA_ROL, type RolEmpresa } from "@/lib/permisos";
import { ROLES_INVITABLES } from "@/lib/invitaciones";
import {
  cambiarPlanFn,
  cancelarSuscripcionFn,
  exportarDatosFn,
  historialCobrosFn,
  invitarUsuarioFn,
  listarInvitacionesFn,
  listarMiembrosFn,
  listarPlanesFn,
  quitarUsuarioFn,
  reactivarSuscripcionFn,
  resumenCuentaFn,
  revocarInvitacionFn,
  solicitarEliminacionFn,
  cambiarRolUsuarioFn,
} from "@/lib/cuenta.functions";
import type {
  CobroHistorico,
  InvitacionEmpresa,
  MiembroEmpresa,
  ResumenCuenta,
} from "@/lib/cuenta.server";

export const Route = createFileRoute("/cuenta")({
  head: () => ({
    meta: [
      { title: "Mi cuenta y plan | Mi Negocio al Día" },
      {
        name: "description",
        content:
          "Revisa tu plan, tus actualizaciones incluidas, los usuarios de tu empresa y el historial de cobros.",
      },
      { property: "og:title", content: "Mi cuenta y plan | Mi Negocio al Día" },
      {
        property: "og:description",
        content:
          "Plan contratado, actualizaciones incluidas, usuarios invitados y cobros de tu empresa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CuentaPage,
});

function CuentaPage() {
  const { modo, empresaActiva } = useCompany();
  const companyId = empresaActiva?.id ?? null;

  const [resumen, setResumen] = useState<ResumenCuenta | null>(null);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [miembros, setMiembros] = useState<MiembroEmpresa[]>([]);
  const [invitaciones, setInvitaciones] = useState<InvitacionEmpresa[]>([]);
  const [cobros, setCobros] = useState<CobroHistorico[]>([]);
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const [correo, setCorreo] = useState("");
  const [rol, setRol] = useState<RolEmpresa>("viewer");
  const [enlace, setEnlace] = useState<string | null>(null);
  const [confirmarEliminacion, setConfirmarEliminacion] = useState(false);

  const cargar = useCallback(async () => {
    if (!companyId) return;
    setCargando(true);
    const [r, p, m, i, c] = await Promise.all([
      resumenCuentaFn({ data: { companyId } }),
      listarPlanesFn(),
      listarMiembrosFn({ data: { companyId } }),
      listarInvitacionesFn({ data: { companyId } }).catch(() => null),
      historialCobrosFn({ data: { companyId } }),
    ]);
    if (r.ok) setResumen(r.data);
    if (p.ok) setPlanes(p.data);
    if (m.ok) setMiembros(m.data);
    if (i && i.ok) setInvitaciones(i.data);
    if (c.ok) setCobros(c.data);
    setCargando(false);
  }, [companyId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (modo !== "cloud" || !companyId) {
    return (
      <AppShell>
        <SectionCard
          titulo="Mi cuenta"
          descripcion="Inicia sesión para ver tu plan, tus usuarios y tus cobros."
        >
          <p className="text-sm text-muted-foreground">
            En modo demostración no existe una cuenta comercial asociada. Datos
            simulados para pruebas. No corresponden a información obtenida del SII.
          </p>
        </SectionCard>
      </AppShell>
    );
  }

  const accion = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setProcesando(true);
    const r = await fn();
    setProcesando(false);
    if (!r.ok) {
      toast.error(r.error ?? "No pudimos completar la operación.");
      return false;
    }
    await cargar();
    return true;
  };

  const limite = resumen?.limite;
  const suscripcion = resumen?.suscripcion;
  const puedeAdministrar = resumen?.rol === "owner";

  return (
    <AppShell>
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-bold sm:text-2xl">Mi cuenta</h1>
          <p className="text-sm text-muted-foreground">
            Tu plan, tus actualizaciones incluidas y quiénes pueden entrar a esta
            empresa.
          </p>
        </header>

        {cargando && !resumen ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Cargando tu cuenta…
          </div>
        ) : null}

        {suscripcion && limite && (
          <SectionCard
            titulo="Estado de tu cuenta"
            descripcion={resumen?.mensajeEstado}
          >
            <DataRow label="Plan" value={suscripcion.plan.nombre} strong />
            <DataRow label="Estado" value={ETIQUETA_ESTADO[suscripcion.estado]} />
            <DataRow
              label="Actualizaciones incluidas este mes"
              value={`${limite.restantes} de ${limite.incluidas} disponibles`}
              hint={limite.mensaje}
              tone={limite.restantes > 0 ? "success" : "warning"}
            />
            <DataRow
              label="Tu rol en esta empresa"
              value={ETIQUETA_ROL[resumen.rol]}
            />
            {suscripcion.finPrueba && suscripcion.estado === "trial" && (
              <DataRow
                label="Tu prueba termina el"
                value={formatFechaHora(suscripcion.finPrueba)}
              />
            )}
            {suscripcion.proximaRenovacion && suscripcion.estado === "active" && (
              <DataRow
                label="Próxima renovación"
                value={formatFechaHora(suscripcion.proximaRenovacion)}
              />
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Aunque tu cuenta esté suspendida o cancelada, tu información guardada
              sigue disponible para consulta.
            </p>
          </SectionCard>
        )}

        {resumen && (
          <SectionCard
            titulo="Consumo del mes"
            descripcion="Cuántas veces se buscó información nueva y cuántas se resolvieron con datos ya guardados."
          >
            <DataRow
              label="Actualizaciones realizadas"
              value={`${resumen.consumoMes.consultasTotales}`}
            />
            <DataRow
              label="Resueltas con información ya guardada"
              value={`${resumen.consumoMes.consultasEvitadasPorCache}`}
              tone="success"
            />
            <DataRow
              label="Documentos nuevos descargados"
              value={`${resumen.consumoMes.pdfsNuevos}`}
            />
          </SectionCard>
        )}

        <SectionCard
          titulo="Planes disponibles"
          descripcion="Puedes cambiar de plan cuando quieras. El cambio no afecta tu información guardada."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {planes.map((p) => {
              const actual = suscripcion?.plan.codigo === p.codigo;
              return (
                <div
                  key={p.id}
                  className={
                    "rounded-xl border p-4 " +
                    (actual ? "border-primary bg-primary/5" : "border-border")
                  }
                >
                  <p className="text-sm font-semibold">{p.nombre}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {p.precioClp ? `${formatCLP(p.precioClp)} / mes` : "Sin costo"}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li>{p.maxEmpresas} empresa(s)</li>
                    <li>{p.maxUsuarios} usuario(s)</li>
                    <li>{p.actualizacionesIncluidas} actualizaciones al mes</li>
                    <li>{p.periodosHistoricosIniciales} meses de historial inicial</li>
                    <li>
                      {p.accesoContador ? "Incluye acceso de contador" : "Sin contador"}
                    </li>
                  </ul>
                  <Button
                    className="mt-3 w-full"
                    variant={actual ? "outline" : "default"}
                    disabled={actual || !puedeAdministrar || procesando}
                    onClick={() =>
                      void accion(async () => {
                        const r = await cambiarPlanFn({
                          data: { companyId, codigoPlan: p.codigo },
                        });
                        if (r.ok) toast.success(`Cambiaste al plan ${p.nombre}.`);
                        return r;
                      })
                    }
                  >
                    {actual ? "Plan actual" : "Elegir este plan"}
                  </Button>
                </div>
              );
            })}
          </div>
          {!puedeAdministrar && (
            <p className="mt-3 text-xs text-muted-foreground">
              Solo el propietario de la empresa puede cambiar el plan.
            </p>
          )}
        </SectionCard>

        <SectionCard
          titulo="Usuarios de la empresa"
          descripcion="Invita a tu socio, tu asistente o tu contador con el acceso que corresponda."
          acciones={
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-4 w-4" aria-hidden /> {miembros.length} activo(s)
            </span>
          }
        >
          <div className="space-y-1">
            {miembros.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 py-2.5 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.nombre ?? "Usuario invitado"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ETIQUETA_ROL[m.rol]}
                    {m.desde ? ` · desde ${formatFechaHora(m.desde)}` : ""}
                  </p>
                </div>
                {puedeAdministrar && m.rol !== "owner" && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={m.rol}
                      onValueChange={(v) =>
                        void accion(() =>
                          cambiarRolUsuarioFn({
                            data: {
                              companyId,
                              miembroId: m.id,
                              rol: v as RolEmpresa,
                            },
                          }),
                        )
                      }
                    >
                      <SelectTrigger className="h-9 w-[170px]" aria-label="Cambiar rol">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES_INVITABLES.map((r) => (
                          <SelectItem key={r.valor} value={r.valor}>
                            {r.etiqueta}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={procesando}
                      onClick={() =>
                        void accion(() =>
                          quitarUsuarioFn({
                            data: { companyId, miembroId: m.id },
                          }),
                        )
                      }
                    >
                      Quitar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {puedeAdministrar && (
            <div className="mt-4 rounded-xl bg-secondary p-4">
              <p className="text-sm font-semibold">Invitar a alguien</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_190px_auto]">
                <div>
                  <Label htmlFor="correo-invitado" className="text-xs">
                    Correo
                  </Label>
                  <Input
                    id="correo-invitado"
                    type="email"
                    inputMode="email"
                    placeholder="persona@correo.cl"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Acceso</Label>
                  <Select value={rol} onValueChange={(v) => setRol(v as RolEmpresa)}>
                    <SelectTrigger aria-label="Tipo de acceso">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES_INVITABLES.map((r) => (
                        <SelectItem key={r.valor} value={r.valor}>
                          {r.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="self-end"
                  disabled={procesando || correo.trim().length === 0}
                  onClick={() =>
                    void accion(async () => {
                      const r = await invitarUsuarioFn({
                        data: { companyId, correo, rol },
                      });
                      if (r.ok) {
                        setCorreo("");
                        setEnlace(
                          `${window.location.origin}/invitacion?token=${r.data.token}`,
                        );
                      }
                      return r;
                    })
                  }
                >
                  Crear invitación
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {ROLES_INVITABLES.find((r) => r.valor === rol)?.detalle}
              </p>
              {enlace && (
                <div className="mt-3 rounded-lg bg-card p-3">
                  <p className="text-xs font-semibold">
                    Comparte este enlace con la persona invitada
                  </p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{enlace}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sirve una sola vez y caduca en 7 días. No lo compartas con nadie
                    más.
                  </p>
                </div>
              )}
            </div>
          )}

          {invitaciones.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold">Invitaciones enviadas</p>
              {invitaciones.map((i) => (
                <div
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{i.correo}</p>
                    <p className="text-xs text-muted-foreground">
                      {ETIQUETA_ROL[i.rol]} · {i.estado} · caduca{" "}
                      {formatFechaHora(i.caduca)}
                    </p>
                  </div>
                  {puedeAdministrar && i.estado === "pendiente" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={procesando}
                      onClick={() =>
                        void accion(() =>
                          revocarInvitacionFn({
                            data: { companyId, invitacionId: i.id },
                          }),
                        )
                      }
                    >
                      Anular
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          titulo="Cobros"
          descripcion="Historial de tu suscripción. Los montos son informativos."
        >
          {cobros.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay cobros registrados.
            </p>
          ) : (
            cobros.map((c) => (
              <DataRow
                key={c.id}
                label={c.detalle ?? c.tipo}
                hint={`${formatFechaHora(c.fecha)} · ${c.estado}`}
                value={c.monto === null ? "—" : formatCLP(c.monto)}
              />
            ))
          )}
          {puedeAdministrar && (
            <div className="mt-4 flex flex-wrap gap-2">
              {suscripcion?.estado === "cancelled" ||
              suscripcion?.estado === "suspended" ? (
                <Button
                  disabled={procesando}
                  onClick={() =>
                    void accion(async () => {
                      const r = await reactivarSuscripcionFn({ data: { companyId } });
                      if (r.ok) toast.success("Tu cuenta quedó activa nuevamente.");
                      return r;
                    })
                  }
                >
                  Reactivar mi cuenta
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={procesando}
                  onClick={() =>
                    void accion(async () => {
                      const r = await cancelarSuscripcionFn({ data: { companyId } });
                      if (r.ok)
                        toast.success(
                          "Cancelamos tu suscripción. Tu historial se conserva.",
                        );
                      return r;
                    })
                  }
                >
                  Cancelar suscripción
                </Button>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          titulo="Tu información"
          descripcion="Puedes llevarte una copia de tus resúmenes mensuales cuando quieras."
        >
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={procesando}
              onClick={async () => {
                setProcesando(true);
                const r = await exportarDatosFn({ data: { companyId } });
                setProcesando(false);
                if (!r.ok) {
                  toast.error(r.error);
                  return;
                }
                const blob = new Blob([JSON.stringify(r.data, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `mi-negocio-al-dia-${companyId}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Descargar mi información
            </Button>
            {puedeAdministrar && (
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => setConfirmarEliminacion(true)}
              >
                Solicitar eliminación de la cuenta
              </Button>
            )}
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Nunca guardamos tu Clave Tributaria ni tu Clave Única. La información
            tributaria se conserva por obligación legal aunque cierres tu cuenta.
          </p>
        </SectionCard>
      </div>

      <Dialog open={confirmarEliminacion} onOpenChange={setConfirmarEliminacion}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar eliminación de la cuenta</DialogTitle>
            <DialogDescription>
              Detendremos las actualizaciones y revocaremos los accesos invitados. Tu
              información tributaria se conserva por obligación legal y puedes
              descargarla antes de continuar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarEliminacion(false)}>
              Volver
            </Button>
            <Button
              className="text-destructive"
              variant="outline"
              disabled={procesando}
              onClick={() =>
                void accion(async () => {
                  const r = await solicitarEliminacionFn({ data: { companyId } });
                  if (r.ok) {
                    toast.success("Registramos tu solicitud. Te contactaremos.");
                    setConfirmarEliminacion(false);
                  }
                  return r;
                })
              }
            >
              Confirmar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
