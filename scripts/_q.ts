import { supabaseAdmin } from "../src/integrations/supabase/client.server";
const { data, error, count } = await supabaseAdmin
  .from("tax_monthly_summaries")
  .select("period,estimated_tax_total,calculation_engine,parity_exact", { count: "exact" })
  .eq("company_id", "c8052d8f-8d86-48bb-a8d8-03e0f09116d3")
  .order("period");
console.log(error, count, data?.slice(0,20));
