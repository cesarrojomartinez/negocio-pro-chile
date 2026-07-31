import { supabaseAdmin } from "@/integrations/supabase/client.server";

import {
  resolverConfiguracionOpcional,
  validarRegistroOpcional,
  CONFIGURACION_OPCIONAL_VACIA,
  type ConceptoOpcional,
  type ConfiguracionTributariaOpcional,
  type RegistroConfiguracionOpcional,
} from "./optionalConfig";

/**
 * Configuración tributaria opcional: lectura, historial y confirmación.
 *
 * Nunca se sobrescribe un registro: el anterior queda como `superseded` y el
 * nuevo nace con su propia vigencia. Un dato declarado no reemplaza al F29
 * oficial; solo se usa cuando el formulario no informa el antecedente.
 */

class ErrorNegocio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorNegocio";
  }
}

interface FilaConfiguracion {
  id: string;
  concept: string;
  value: number | string | null;
  value_text: string | null;
  unit: string;
  valid_from: string;
  valid_to: string | null;
  source: string;
  status: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  notes: string | null;
}

function aRegistro(fila: FilaConfiguracion): RegistroConfiguracionOpcional {
  const valor = fila.value == null ? null : Number(fila.value);
  return {
    id: fila.id,
    concept: fila.concept as ConceptoOpcional,
    value: valor == null || Number.isNaN(valor) ? null : valor,
    valueText: fila.value_text,
    unit: fila.unit as RegistroConfiguracionOpcional["unit"],
    validFrom: fila.valid_from,
    validTo: fila.valid_to,
    source: fila.source,
    status: fila.status as RegistroConfiguracionOpcional["status"],
    confirmedBy: fila.confirmed_by,
    confirmedAt: fila.confirmed_at,
    notes: fila.notes,
  };
}

async function asegurarAcceso(
  userId: string,
  companyId: string,
  escritura: boolean,
): Promise<void> {
  const { data } = await supabaseAdmin
    .from("tax_company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle<{ role: string }>();
  if (!data) throw new ErrorNegocio("No tienes acceso a esta empresa.");
  if (escritura && data.role !== "owner" && data.role !== "accountant") {
    throw new ErrorNegocio(
      "Solo la persona dueña o su contador pueden cambiar esta configuración.",
    );
  }
}

export async function listarConfiguracionOpcional(
  userId: string,
  companyId: string,
): Promise<RegistroConfiguracionOpcional[]> {
  await asegurarAcceso(userId, companyId, false);
  const { data } = await supabaseAdmin
    .from("tax_optional_tax_settings")
    .select(
      "id, concept, value, value_text, unit, valid_from, valid_to, source, status, confirmed_by, confirmed_at, notes",
    )
    .eq("company_id", companyId)
    .order("valid_from", { ascending: false })
    .returns<FilaConfiguracion[]>();
  return (data ?? []).map(aRegistro);
}

export interface CambioConfiguracionOpcional {
  companyId: string;
  concept: ConceptoOpcional;
  value?: number | null;
  valueText?: string | null;
  validFrom: string;
  validTo?: string | null;
  notes?: string | null;
}

const UNIDADES: Record<ConceptoOpcional, RegistroConfiguracionOpcional["unit"]> = {
  ppm_rate: "fraction",
  sales_type: "text",
  common_use_vat: "fraction",
  withholdings_estimate: "clp",
  vat_advance_regime: "boolean",
  vat_postponement: "boolean",
  confirmed_carryforward: "clp",
};

/** Guarda una versión nueva y deja la anterior como reemplazada. */
export async function guardarConfiguracionOpcional(
  userId: string,
  cambio: CambioConfiguracionOpcional,
): Promise<RegistroConfiguracionOpcional[]> {
  await asegurarAcceso(userId, cambio.companyId, true);

  const registro: RegistroConfiguracionOpcional = {
    concept: cambio.concept,
    value: cambio.value ?? null,
    valueText: cambio.valueText ?? null,
    unit: UNIDADES[cambio.concept],
    validFrom: `${cambio.validFrom.slice(0, 7)}-01`,
    validTo: cambio.validTo ? `${cambio.validTo.slice(0, 7)}-01` : null,
    source: "client_declared",
    status: "active",
    notes: cambio.notes ?? null,
  };

  const errores = validarRegistroOpcional(registro);
  if (errores.length > 0) throw new ErrorNegocio(errores[0].message);

  const ahora = new Date().toISOString();
  await supabaseAdmin
    .from("tax_optional_tax_settings")
    .update({ status: "superseded" })
    .eq("company_id", cambio.companyId)
    .eq("concept", cambio.concept)
    .eq("status", "active");

  const { error } = await supabaseAdmin.from("tax_optional_tax_settings").insert({
    company_id: cambio.companyId,
    concept: registro.concept,
    value: registro.value,
    value_text: registro.valueText,
    unit: registro.unit,
    valid_from: registro.validFrom,
    valid_to: registro.validTo,
    source: registro.source,
    status: "active",
    confirmed_by: userId,
    confirmed_at: ahora,
    notes: registro.notes,
  });
  if (error) throw new ErrorNegocio("No pudimos guardar el dato. Intenta nuevamente.");

  return listarConfiguracionOpcional(userId, cambio.companyId);
}

/** Deja de aplicar un dato declarado sin borrar su historial. */
export async function revocarConfiguracionOpcional(
  userId: string,
  entrada: { companyId: string; id: string },
): Promise<RegistroConfiguracionOpcional[]> {
  await asegurarAcceso(userId, entrada.companyId, true);
  await supabaseAdmin
    .from("tax_optional_tax_settings")
    .update({ status: "revoked" })
    .eq("company_id", entrada.companyId)
    .eq("id", entrada.id);
  return listarConfiguracionOpcional(userId, entrada.companyId);
}

/** Antecedentes vigentes para el periodo. Sin registros: configuración vacía. */
export async function configuracionOpcionalDePeriodo(
  companyId: string,
  period: string,
): Promise<ConfiguracionTributariaOpcional> {
  const { data } = await supabaseAdmin
    .from("tax_optional_tax_settings")
    .select(
      "id, concept, value, value_text, unit, valid_from, valid_to, source, status, confirmed_by, confirmed_at, notes",
    )
    .eq("company_id", companyId)
    .eq("status", "active")
    .returns<FilaConfiguracion[]>();
  if (!data || data.length === 0) {
    return { ...CONFIGURACION_OPCIONAL_VACIA, period };
  }
  return resolverConfiguracionOpcional(data.map(aRegistro), period);
}
