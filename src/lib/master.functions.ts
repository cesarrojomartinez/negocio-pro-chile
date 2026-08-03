import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { envolver } from "@/lib/serverResult";
import type { EntradaComunicado, EntradaPlanMaster } from "@/lib/master.server";
import {
  actualizarTicket,
  agregarNotaInterna,
  cambiarEstadoPago,
  cambiarPlanCliente,
  comunicacionMaster,
  comunicadosParaEmpresa,
  consumoMaster,
  eliminarComunicado,
  fichaCliente,
  guardarComunicado,
  guardarPlanMaster,
  listarClientes,
  listarPlanesMaster,
  metricasMaster,
  pagosMaster,
  registrarPagoManual,
  resumenMaster,
  soporteMaster,
} from "@/lib/master.server";

export const resumenMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => envolver(() => resumenMaster(context.userId)));

export const clientesMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => envolver(() => listarClientes(context.userId)));

export const fichaClienteMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => fichaCliente(context.userId, data.companyId)),
  );

export const notaInternaMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      entidad: string;
      entidadId: string;
      companyId?: string | null;
      cuerpo: string;
    }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(() => agregarNotaInterna(context.userId, data)),
  );

export const cambiarPlanClienteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; codigoPlan: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => cambiarPlanCliente(context.userId, data)),
  );

export const pagosMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => envolver(() => pagosMaster(context.userId)));

export const registrarPagoManualFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      companyId: string;
      monto: number;
      referencia?: string | null;
      detalle?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(() => registrarPagoManual(context.userId, data)),
  );

export const cambiarEstadoPagoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventoId: string; estado: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => cambiarEstadoPago(context.userId, data)),
  );

export const planesMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => envolver(() => listarPlanesMaster(context.userId)));

export const guardarPlanMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: EntradaPlanMaster) => data)
  .handler(async ({ data, context }) =>
    envolver(() => guardarPlanMaster(context.userId, data)),
  );

export const consumoMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { mes?: string | null; companyId?: string | null; categoria?: string | null }) =>
      data,
  )
  .handler(async ({ data, context }) =>
    envolver(() => consumoMaster(context.userId, data)),
  );

export const metricasMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { desde?: string | null; hasta?: string | null; planCodigo?: string | null }) =>
      data,
  )
  .handler(async ({ data, context }) =>
    envolver(() => metricasMaster(context.userId, data)),
  );

export const comunicacionMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => envolver(() => comunicacionMaster(context.userId)));

export const guardarComunicadoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: EntradaComunicado) => data)
  .handler(async ({ data, context }) =>
    envolver(() => guardarComunicado(context.userId, data)),
  );

export const eliminarComunicadoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) =>
    envolver(() => eliminarComunicado(context.userId, data.id)),
  );

export const soporteMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => envolver(() => soporteMaster(context.userId)));

export const actualizarTicketMasterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { ticketId: string; estado?: string | null; prioridad?: string | null }) => data,
  )
  .handler(async ({ data, context }) =>
    envolver(() => actualizarTicket(context.userId, data)),
  );

export const comunicadosParaEmpresaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId?: string | null }) => data)
  .handler(async ({ data }) =>
    envolver(() => comunicadosParaEmpresa(data.companyId ?? null)),
  );
