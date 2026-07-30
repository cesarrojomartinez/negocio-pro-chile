insert into public.tax_f29_history (
  company_id, tax_period_id, declaration_status,
  declared_vat, declared_ppm, declared_withholdings, declared_total,
  vat_carryforward, filed_at, source, raw_data
)
select p.company_id, p.id, 'filed',
       975229, 150500, 0, 1125729,
       0, '2026-07-12T00:00:00+00'::timestamptz, 'accountant',
       jsonb_build_object(
         'origin', 'accountant_confirmed_f29',
         'confirmation_status', 'confirmed',
         'ppm_rate', 0.025,
         'ppm_tax_base', 6020000,
         'vat_debit', 1143800,
         'vat_credit', 168571,
         'structured_from_api', false
       )
from public.tax_periods p
where p.period = '2026-06'
  and p.company_id = 'bdc659fe-ef6e-4e14-82a5-33c8e32c86ba'
on conflict (company_id, tax_period_id) do update set
  declaration_status = excluded.declaration_status,
  declared_vat = excluded.declared_vat,
  declared_ppm = excluded.declared_ppm,
  declared_withholdings = excluded.declared_withholdings,
  declared_total = excluded.declared_total,
  vat_carryforward = excluded.vat_carryforward,
  filed_at = excluded.filed_at,
  source = excluded.source,
  raw_data = excluded.raw_data;