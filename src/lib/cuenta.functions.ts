import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { envolver } from "@/lib/serverResult";
import type { EstadoCuenta } from "@/lib/cuenta";
import type { RolEmpresa } from "@/lib/permisos";
import type { CategoriaSoporte } from "@/lib/soporte";
import {
  aceptarInvitacion,
  cambiarEstadoCuenta,
  cambiarPlan,
  cambiarRolUsuario,
  cancelarSuscripcion,
  crearTicketSoporte,
  actualizarPlanMaster,
  asignarPlanClienteMaster,
  crearPlanMaster,
  esAdministrador,
  exportarDatos,
  historialCobros,
  invitarUsuario,
  actualizarSaldoCreditoIA,
  listarApiHealthMaster,
  listarInvitaciones,
  listarMetricasSaaSMaster,
  listarMiembros,
  listarMovimientosCreditosIA,
  listarPlanes,
  listarPlanesMasterAdmin,
  listarResultadosParidadMaster,
  listarSaludSiiMaster,
  listarSuscripcionesMaster,
  listarVersionesMotorMaster,
  listarWalletsIAMaster,
  obtenerConsumoIAMaster,
  obtenerDetalleClienteMaster,
  panelMaster,
  quitarUsuario,
  reactivarSuscripcion,
  resumenCuenta,
  revisarInvitacion,
  revocarInvitacion,
  solicitarEliminacion,
  toggleEstadoPlanMaster,
} from "@/lib/cuenta.server";

export const listarPlanesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => envolver(() => listarPlanes()));

export const resumenCuentaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => resumenCuenta(context.userId, data.companyId)),
  );

export const cambiarPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; codigoPlan: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => cambiarPlan(context.userId, data.companyId, data.codigoPlan)),
  );

export const cancelarSuscripcionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => cancelarSuscripcion(context.userId, data.companyId)),
  );

export const reactivarSuscripcionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => reactivarSuscripcion(context.userId, data.companyId)),
  );

export const historialCobrosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => historialCobros(context.userId, data.companyId)),
  );

export const listarMiembrosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => listarMiembros(context.userId, data.companyId)),
  );

export const listarInvitacionesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => listarInvitaciones(context.userId, data.companyId)),
  );

export const invitarUsuarioFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; correo: string; rol: RolEmpresa }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => invitarUsuario(context.userId, data)),
  );

export const revocarInvitacionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; invitacionId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => revocarInvitacion(context.userId, data)),
  );

export const revisarInvitacionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => envolver(() => revisarInvitacion(data.token)));

export const aceptarInvitacionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => aceptarInvitacion(context.userId, data.token)),
  );

export const cambiarRolUsuarioFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { companyId: string; miembroId: string; rol: RolEmpresa }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(() => cambiarRolUsuario(context.userId, data)),
  );

export const quitarUsuarioFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; miembroId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => quitarUsuario(context.userId, data)),
  );

export const crearTicketSoporteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      companyId: string | null;
      periodo: string | null;
      categoria: CategoriaSoporte;
      mensaje: string;
      syncRunId: string | null;
      codigo: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(() => crearTicketSoporte(context.userId, data)),
  );

export const exportarDatosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => exportarDatos(context.userId, data.companyId)),
  );

export const solicitarEliminacionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; motivo?: string | null }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => solicitarEliminacion(context.userId, data)),
  );

export const esAdministradorFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => envolver(() => esAdministrador(context.userId)));

export const panelMasterFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => envolver(() => panelMaster(context.userId)));

export const cambiarEstadoCuentaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { companyId: string; estado: EstadoCuenta; motivo?: string | null }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(() => cambiarEstadoCuenta(context.userId, data)),
  );

export const obtenerDetalleClienteMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => obtenerDetalleClienteMaster(context.userId, data.companyId)),
  );

export const listarPlanesMasterAdminFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    envolver(() => listarPlanesMasterAdmin(context.userId)),
  );

export const crearPlanMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => data)
  .handler(async ({ data, context }) =>
    envolver(() => crearPlanMaster(context.userId, data)),
  );

export const actualizarPlanMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planId: string; datos: any }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => actualizarPlanMaster(context.userId, data.planId, data.datos)),
  );

export const toggleEstadoPlanMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planId: string; isActive: boolean }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => toggleEstadoPlanMaster(context.userId, data.planId, data.isActive)),
  );

export const listarSuscripcionesMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    envolver(() => listarSuscripcionesMaster(context.userId)),
  );

export const asignarPlanClienteMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; planId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => asignarPlanClienteMaster(context.userId, data.companyId, data.planId)),
  );

export const listarSaludSiiMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    envolver(() => listarSaludSiiMaster(context.userId)),
  );

export const listarApiHealthMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    envolver(() => listarApiHealthMaster(context.userId)),
  );

export const listarVersionesMotorMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    envolver(() => listarVersionesMotorMaster(context.userId)),
  );

export const listarResultadosParidadMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    envolver(() => listarResultadosParidadMaster(context.userId)),
  );

export const listarWalletsIAMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    envolver(() => listarWalletsIAMaster(context.userId)),
  );

export const obtenerConsumoIAMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    envolver(() => obtenerConsumoIAMaster(context.userId)),
  );

export const listarMovimientosCreditosIAFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId?: string } | undefined) => data)
  .handler(async ({ data, context }) =>
    envolver(() => listarMovimientosCreditosIA(context.userId, data?.companyId)),
  );

export const actualizarSaldoCreditoIAFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      companyId: string;
      amount: number;
      type: "asignacion" | "consumo" | "ajuste" | "regalo";
      description: string;
    }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(() => actualizarSaldoCreditoIA(context.userId, data)),
  );

export const listarMetricasSaaSMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    envolver(() => listarMetricasSaaSMaster(context.userId)),
  );




