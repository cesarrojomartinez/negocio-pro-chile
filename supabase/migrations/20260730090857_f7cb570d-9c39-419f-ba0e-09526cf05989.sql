-- Mayo 2026: F29 confirmado por el contador
update public.tax_f29_history f set
  declaration_status = 'filed',
  declared_vat = 1764974,
  declared_ppm = 248957,
  declared_withholdings = 0,
  declared_total = 2013931,
  vat_carryforward = 0,
  source = 'accountant',
  raw_data = jsonb_build_object(
    'origin', 'accountant_confirmed_f29',
    'confirmation_status', 'confirmed',
    'ppm_rate', 0.025,
    'ppm_tax_base', 9958279,
    'vat_debit', 1892073,
    'vat_credit', 127099
  ),
  updated_at = now()
from public.tax_periods p
where p.id = f.tax_period_id
  and f.company_id = 'bdc659fe-ef6e-4e14-82a5-33c8e32c86ba'
  and p.period = '2026-05';

-- Junio 2026: reponer el F29 confirmado (fue sobreescrito por el proveedor simulado)
update public.tax_f29_history f set
  declaration_status = 'filed',
  declared_vat = 975229,
  declared_ppm = 150500,
  declared_withholdings = 0,
  declared_total = 1125729,
  vat_carryforward = 0,
  source = 'accountant',
  raw_data = jsonb_build_object(
    'origin', 'accountant_confirmed_f29',
    'confirmation_status', 'confirmed',
    'ppm_rate', 0.025,
    'ppm_tax_base', 6020000
  ),
  updated_at = now()
from public.tax_periods p
where p.id = f.tax_period_id
  and f.company_id = 'bdc659fe-ef6e-4e14-82a5-33c8e32c86ba'
  and p.period = '2026-06';

-- Resumen persistido de mayo recalculado con la tasa confirmada
update public.tax_monthly_summaries s set
  ppm_rate = 0.025,
  ppm_source = 'accountant_confirmed_f29',
  carryforward_source = 'accountant_confirmed_f29',
  estimated_ppm = round(s.ppm_tax_base * 0.025),
  estimated_tax_total = s.estimated_vat_payable + round(s.ppm_tax_base * 0.025) + coalesce(s.estimated_withholdings, 0),
  preventive_margin_amount = round((s.estimated_vat_payable + round(s.ppm_tax_base * 0.025) + coalesce(s.estimated_withholdings, 0)) * coalesce(s.preventive_margin_percent, 0) / 100),
  recommended_reserve = s.estimated_vat_payable + round(s.ppm_tax_base * 0.025) + coalesce(s.estimated_withholdings, 0)
    + round((s.estimated_vat_payable + round(s.ppm_tax_base * 0.025) + coalesce(s.estimated_withholdings, 0)) * coalesce(s.preventive_margin_percent, 0) / 100),
  calculated_at = now()
from public.tax_periods p
where p.id = s.tax_period_id
  and s.company_id = 'bdc659fe-ef6e-4e14-82a5-33c8e32c86ba'
  and p.period = '2026-05';