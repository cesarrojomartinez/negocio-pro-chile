import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { recalculateCompanyHistory } from "../src/lib/taxRecalc.server";

const companyId = process.argv[2]!;
const campos =
  "tax_period_id,estimated_vat_payable,gross_vat_position,estimated_ppm,estimated_withholdings,estimated_tax_total,estimated_new_carryforward,calculation_engine,parity_exact,parity_differences_count";

async function foto() {
  const { data, error } = await supabaseAdmin
    .from("tax_monthly_summaries")
    .select(campos)
    .eq("company_id", companyId);
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

const { data: owner } = await supabaseAdmin
  .from("tax_company_members")
  .select("user_id")
  .eq("company_id", companyId)
  .eq("role", "owner")
  .limit(1)
  .maybeSingle<{ user_id: string }>();

const antes = await foto();
const r = await recalculateCompanyHistory(owner!.user_id, { companyId, meses: 36 });
const despues = await foto();

let diferencias = 0;
for (const a of antes) {
  const b = despues.find((x) => x["tax_period_id"] === a["tax_period_id"]);
  for (const k of Object.keys(a)) {
    if (k === "calculation_engine" || k === "parity_exact" || k === "parity_differences_count") continue;
    if (String(a[k]) !== String(b?.[k])) {
      diferencias++;
      console.log("DIFERENCIA", a["tax_period_id"], k, a[k], "->", b?.[k]);
    }
  }
}
const motores = [...new Set(despues.map((d) => d["calculation_engine"]))];
console.log(
  JSON.stringify(
    {
      recalculados: r.recalculados.length,
      conError: r.conError,
      periodos: antes.length,
      diferencias,
      motores,
      paridadExacta: despues.filter((d) => d["parity_exact"] === true).length,
    },
    null,
    2,
  ),
);
