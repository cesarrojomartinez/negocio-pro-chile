alter table public.tax_monthly_summaries
  drop constraint if exists tax_monthly_summaries_carryforward_source_check,
  drop constraint if exists tax_monthly_summaries_ppm_source_check,
  drop constraint if exists tax_monthly_summaries_withholdings_source_check;

alter table public.tax_monthly_summaries
  add constraint tax_monthly_summaries_carryforward_source_check
    check (carryforward_source in ('accountant_confirmed_f29','f29','previous_period','mock','unknown')),
  add constraint tax_monthly_summaries_ppm_source_check
    check (ppm_source in ('accountant_confirmed_f29','configured','previous_f29','mock','unknown')),
  add constraint tax_monthly_summaries_withholdings_source_check
    check (withholdings_source in ('accountant_confirmed_f29','f29_history','documents','configured','mock','unknown'));

update public.tax_monthly_summaries s
set sales_total = 7163800,
    sales_credit_notes = 5735800,
    vat_debit = 1143800,
    vat_credit = 168571,
    previous_vat_carryforward = 0,
    carryforward_source = 'accountant_confirmed_f29',
    estimated_vat_payable = 975229,
    estimated_new_carryforward = 0,
    ppm_rate = 0.025,
    ppm_tax_base = 6020000,
    estimated_ppm = 150500,
    ppm_source = 'accountant_confirmed_f29',
    estimated_withholdings = 0,
    withholdings_source = 'accountant_confirmed_f29',
    estimated_tax_total = 1125729,
    calculated_at = now(),
    updated_at = now()
from public.tax_periods p
where p.id = s.tax_period_id
  and p.period = '2026-06'
  and s.company_id = 'bdc659fe-ef6e-4e14-82a5-33c8e32c86ba';