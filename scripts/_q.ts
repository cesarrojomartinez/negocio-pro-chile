import { supabaseAdmin as s } from "../src/integrations/supabase/client.server";
const id = "bdc659fe-ef6e-4e14-82a5-33c8e32c86ba";
const per = (await s.from("tax_periods").select("id,period").eq("company_id",id).order("period")).data!;
const f = (await s.from("tax_f29_history").select("*").eq("company_id",id)).data!;
for (const x of f as any[]) console.log("F29", per.find(p=>p.id===x.tax_period_id)?.period, JSON.stringify({st:x.declaration_status,src:x.source,vat:x.declared_vat,ppm:x.declared_ppm,wh:x.declared_withholdings,tot:x.declared_total,cf:x.vat_carryforward,raw:x.raw_data}));
