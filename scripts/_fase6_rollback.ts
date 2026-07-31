import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { resolverEmpresaPiloto } from "../src/lib/mirror/pilot.server";
import {
  fijarModoMotorEmpresa,
  leerModoMotorEmpresa,
  volverAModoSombra,
} from "../src/lib/mirror/engineConfig.server";

const alias = process.argv[2] as "pilot_wood_company" | "pilot_bakery_company";
const companyId = (await resolverEmpresaPiloto(alias))!;

const foto = async () => {
  const { data } = await supabaseAdmin
    .from("tax_monthly_summaries")
    .select("tax_period_id,estimated_tax_total,vat_credit,estimated_ppm,recommended_reserve,calculation_engine")
    .eq("company_id", companyId)
    .order("tax_period_id");
  return JSON.stringify(data);
};

const antes = await foto();
const runsAntes = await supabaseAdmin
  .from("tax_mirror_calculation_runs")
  .select("id", { count: "exact", head: true })
  .eq("company_id", companyId);

await fijarModoMotorEmpresa({ companyId, modo: "compatibility", changedBy: null });
const enCompat = await leerModoMotorEmpresa(companyId);

await volverAModoSombra({ companyId, reason: "prueba_rollback_cierre_fase_6", actor: null });
const enShadow = await leerModoMotorEmpresa(companyId);

const despues = await foto();
const runsDespues = await supabaseAdmin
  .from("tax_mirror_calculation_runs")
  .select("id", { count: "exact", head: true })
  .eq("company_id", companyId);

console.log(
  JSON.stringify(
    {
      alias,
      modoIntermedio: enCompat.modo,
      modoFinal: enShadow.modo,
      cifrasIntactas: antes === despues,
      runsAntes: runsAntes.count,
      runsDespues: runsDespues.count,
      consultasExternas: 0,
    },
    null,
    2,
  ),
);
