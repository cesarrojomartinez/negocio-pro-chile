import { supabaseAdmin as s } from "../src/integrations/supabase/client.server";
const id = (await s.from("tax_pilot_companies").select("company_id").eq("alias","pilot_bakery_company").maybeSingle()).data!.company_id;
for (const t of ["tax_period_ppm_overrides","tax_company_tax_parameters","tax_optional_tax_settings"]) {
  const { data } = await s.from(t as never).select("*").eq("company_id", id);
  console.log("==",t, JSON.stringify(data)?.slice(0,900));
}
