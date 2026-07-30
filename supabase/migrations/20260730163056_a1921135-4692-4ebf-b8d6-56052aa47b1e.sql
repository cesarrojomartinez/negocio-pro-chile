UPDATE public.tax_monthly_summaries s
SET previous_vat_carryforward = 208968,
    carryforward_source = 'accountant_confirmed_f29',
    carryforward_known = true,
    total_vat_credits = 873015,
    gross_vat_position = -113376,
    estimated_vat_payable = 0,
    estimated_new_carryforward = 113376,
    ppm_rate = 0.01,
    ppm_tax_base = 3998100,
    ppm_source = 'accountant_confirmed_f29',
    estimated_ppm = 39981,
    estimated_withholdings = 0,
    estimated_tax_total = 39981,
    declared_tax_total = 39981,
    calculation_status = 'closed',
    confidence_level = 'high',
    preventive_margin_amount = ROUND(39981 * s.preventive_margin_percent / 100),
    recommended_reserve = 39981 + ROUND(39981 * s.preventive_margin_percent / 100),
    calculated_at = now()
FROM public.tax_periods tp
WHERE tp.id = s.tax_period_id
  AND s.company_id = 'bdc659fe-ef6e-4e14-82a5-33c8e32c86ba'
  AND tp.period = '2026-03';