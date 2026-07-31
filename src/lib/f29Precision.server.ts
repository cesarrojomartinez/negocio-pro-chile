/**
 * Lectura del historial de precisión: compara la estimación guardada antes de
 * la conciliación con el total realmente declarado en el F29.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ErrorNegocio, exigirRol } from "@/lib/companies.server";
import {
  calcularDesviacionF29,
  resumirPrecision,
  type FilaPrecision,
  type ResumenPrecision,
} from "@/lib/f29Precision";

const ROLES_LECTURA = ["owner", "business_user", "accountant", "viewer"] as const;

function numero(valor: unknown): number | null {
  if (valor == null) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export async function obtenerPrecisionEstimacion(
  userId: string,
  entrada: { companyId: string; meses?: number },
): Promise<ResumenPrecision> {
  await exigirRol(userId, entrada.companyId, [...ROLES_LECTURA]);
  const limite = Math.min(24, Math.max(3, entrada.meses ?? 12));

  const { data, error } = await supabaseAdmin
    .from("tax_monthly_summaries")
    .select(
      "declared_tax_total, estimated_tax_total, estimated_vat_payable, estimated_ppm, estimated_withholdings, pre_f29_tax_total, tax_periods!inner(period)",
    )
    .eq("company_id", entrada.companyId)
    .limit(200);

  if (error) throw new ErrorNegocio("No pudimos cargar el historial de precisión.");

  const filas: FilaPrecision[] = [];
  for (const row of data ?? []) {
    const periodo = (row as { tax_periods?: { period?: string } }).tax_periods?.period;
    if (!periodo) continue;
    const oficial = numero(row.declared_tax_total);
    if (oficial == null) continue;

    const medido = numero(row.pre_f29_tax_total);
    const reconstruido =
      (numero(row.estimated_vat_payable) ?? 0) +
      (numero(row.estimated_ppm) ?? 0) +
      (numero(row.estimated_withholdings) ?? 0);

    const estimado = medido ?? reconstruido;
    const desviacion = calcularDesviacionF29(estimado, oficial);
    if (!desviacion) continue;

    filas.push({
      periodo,
      origen: medido != null ? "medida" : "reconstruida",
      ...desviacion,
    });
  }

  filas.sort((a, b) => (a.periodo < b.periodo ? 1 : -1));
  return resumirPrecision(filas.slice(0, limite));
}
