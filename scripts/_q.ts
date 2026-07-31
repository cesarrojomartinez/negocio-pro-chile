import { supabaseAdmin as s } from "../src/integrations/supabase/client.server";
const id="c8052d8f-8d86-48bb-a8d8-03e0f09116d3";
const per=(await s.from("tax_periods").select("id,period").eq("company_id",id).order("period")).data!;
const sum=(await s.from("tax_monthly_summaries").select("*").eq("company_id",id)).data! as any[];
for(const p of per){const r=sum.find(x=>x.tax_period_id===p.id); if(!r)continue;
console.log(p.period,"rate",r.ppm_rate,"src",r.ppm_source,"base",r.ppm_tax_base,"ppm",r.estimated_ppm);}
