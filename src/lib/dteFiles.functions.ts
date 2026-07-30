import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { envolver } from "@/lib/serverResult";

const periodo = z.string().regex(/^\d{4}-\d{2}$/);
const tipoArchivo = z.enum(["pdf", "xml"]);

const entradaListado = z.object({
  companyId: z.string().uuid(),
  periodo,
});

const credenciales = {
  rutUsuario: z.string().min(8),
  claveTributaria: z.string().min(4),
  consentimiento: z.literal(true),
};

const entradaDescarga = z.object({
  companyId: z.string().uuid(),
  periodo,
  documentoId: z.string().uuid(),
  tipoArchivo,
  ...credenciales,
});

const entradaLote = z.object({
  companyId: z.string().uuid(),
  periodo,
  documentoIds: z.array(z.string().uuid()).min(1).max(20),
  tipoArchivo,
  ...credenciales,
});

const entradaArchivo = z.object({
  companyId: z.string().uuid(),
  archivoId: z.string().uuid(),
});

export const listarDocumentosPeriodoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entradaListado.parse(data))
  .handler(async ({ data, context }) => {
    return envolver(async () => {
      const { listarDocumentosPeriodo } = await import("@/lib/dteFiles.server");
      return listarDocumentosPeriodo(context.userId, data);
    });
  });

export const descargarArchivoDteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entradaDescarga.parse(data))
  .handler(async ({ data, context }) => {
    return envolver(async () => {
      const { descargarArchivoDte } = await import("@/lib/dteFiles.server");
      return descargarArchivoDte(context.userId, data);
    });
  });

export const descargarLoteArchivosDteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entradaLote.parse(data))
  .handler(async ({ data, context }) => {
    return envolver(async () => {
      const { descargarLoteArchivosDte } = await import("@/lib/dteFiles.server");
      return descargarLoteArchivosDte(context.userId, data);
    });
  });

export const urlFirmadaArchivoDteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entradaArchivo.parse(data))
  .handler(async ({ data, context }) => {
    return envolver(async () => {
      const { urlFirmadaArchivoDte } = await import("@/lib/dteFiles.server");
      return urlFirmadaArchivoDte(context.userId, data);
    });
  });
