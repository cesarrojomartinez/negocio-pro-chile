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
  esAdministrador,
  exportarDatos,
  historialCobros,
  invitarUsuario,
  listarInvitaciones,
  listarMiembros,
  listarPlanes,
  panelMaster,
  quitarUsuario,
  reactivarSuscripcion,
  resumenCuenta,
  revisarInvitacion,
  revocarInvitacion,
  solicitarEliminacion,
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
