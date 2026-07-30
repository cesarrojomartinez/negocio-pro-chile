import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { envolver } from "@/lib/serverResult";
import {
  cambiarRecordatorioSemanal,
  cerrarPeriodo,
  confirmarAntecedentesF29,
  elegirModoActualizacion,
  obtenerModoActualizacion,
  obtenerResumenPeriodo,
  reabrirPeriodo,
  solicitarRevisionContador,
  type EntradaConfirmacionF29,
  type ModoActualizacion,
} from "@/lib/periodLifecycle.server";

export const obtenerModoActualizacionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => obtenerModoActualizacion(context.userId, data.companyId)),
  );

export const elegirModoActualizacionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; modo: ModoActualizacion }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => elegirModoActualizacion(context.userId, data)),
  );

export const cambiarRecordatorioSemanalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; activo: boolean }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => cambiarRecordatorioSemanal(context.userId, data)),
  );

export const obtenerResumenPeriodoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; periodo: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => obtenerResumenPeriodo(context.userId, data)),
  );

export const solicitarRevisionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; periodo: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => solicitarRevisionContador(context.userId, data)),
  );

export const confirmarF29Fn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: EntradaConfirmacionF29) => data)
  .handler(async ({ data, context }) =>
    envolver(() => confirmarAntecedentesF29(context.userId, data)),
  );

export const cerrarPeriodoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; periodo: string }) => data)
  .handler(async ({ data, context }) => envolver(() => cerrarPeriodo(context.userId, data)));

export const reabrirPeriodoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; periodo: string; motivo: string }) => data)
  .handler(async ({ data, context }) => envolver(() => reabrirPeriodo(context.userId, data)));
