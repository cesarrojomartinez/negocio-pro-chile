update public.tax_f29_history
set declared_vat = null,
    declared_ppm = null,
    declared_withholdings = null,
    declared_total = null,
    vat_carryforward = null,
    raw_data = coalesce(raw_data, '{}'::jsonb) || jsonb_build_object('solo_listado', true)
where source in ('mock_gateway','api_gateway')
  and coalesce(declared_vat,0) = 0
  and coalesce(declared_ppm,0) = 0
  and coalesce(declared_withholdings,0) = 0
  and coalesce(declared_total,0) = 0
  and coalesce(vat_carryforward,0) = 0
  and company_id in (select id from public.tax_companies where is_demo is not true);

update public.tax_monthly_summaries s
set withholdings_source = 'unknown'
where coalesce(s.estimated_withholdings,0) = 0
  and s.withholdings_source = 'documents'
  and s.company_id in (select id from public.tax_companies where is_demo is not true);