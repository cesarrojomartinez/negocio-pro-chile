update public.tax_monthly_summaries s
set recommended_reserve = 1125729,
    preventive_margin_amount = 0,
    projected_sales = 7163800,
    projected_vat_debit = 1143800,
    projected_tax_min = 1125729,
    projected_tax_max = 1125729,
    updated_at = now()
from public.tax_periods p
where p.id = s.tax_period_id
  and p.period = '2026-06'
  and s.company_id = 'bdc659fe-ef6e-4e14-82a5-33c8e32c86ba';