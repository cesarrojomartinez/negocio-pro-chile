import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  actualizarConfiguracion,
  actualizarEmpresa,
  asegurarEmpresaDemo,
  cambiarConexionDemo,
  cambiarRolMiembro,
  crearEmpresa,
  guardarTasaPpmPeriodo,
  registrarSincronizacionDemo,
} from "@/lib/companies.server";
import { recalculateTaxPeriod } from "@/lib/taxRecalc.server";
import { envolver } from "@/lib/serverResult";

export const crearEmpresaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      rut: string;
      razonSocial: string;
      nombreFantasia?: string | null;
      actividad?: string | null;
      esDemo?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(() => crearEmpresa(context.userId, data)),
  );

export const asegurarEmpresaDemoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => envolver(() => asegurarEmpresaDemo(context.userId)));

export const actualizarConfiguracionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      companyId: string;
      periodo?: string | null;
      metaMensual?: number | null;
      dineroReservado?: number | null;
      margenPorcentaje?: number | null;
      tasaPpm?: number | null;
      alertasActivas?: boolean | null;
    }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(() => actualizarConfiguracion(context.userId, data)),
  );

export const registrarSincronizacionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; periodo?: string | null }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => registrarSincronizacionDemo(context.userId, data)),
  );

export const cambiarConexionDemoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; conectar: boolean }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => cambiarConexionDemo(context.userId, data)),
  );

export const actualizarEmpresaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      companyId: string;
      razonSocial?: string;
      nombreFantasia?: string | null;
      actividad?: string | null;
      direccion?: string | null;
      comuna?: string | null;
      region?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(() => actualizarEmpresa(context.userId, data)),
  );

export const cambiarRolMiembroFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      companyId: string;
      memberId: string;
      rol?: "owner" | "business_user" | "accountant" | "viewer" | null;
      estado?: "active" | "suspended" | "removed" | null;
    }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(() => cambiarRolMiembro(context.userId, data)),
  );

/** Recálculo oficial del periodo: valida permisos y persiste el resultado. */
export const recalcularPeriodoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; periodo: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => recalculateTaxPeriod(context.userId, data)),
  );

export const guardarTasaPpmPeriodoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { companyId: string; periodo: string; tasaPpm: number | null }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(() => guardarTasaPpmPeriodo(context.userId, data)),
  );
