-- Abril 2026 de una empresa real quedó con la tasa demostrativa de 0,6%.
-- Se deja la tasa como desconocida hasta que exista un antecedente confirmado.
UPDATE public.tax_monthly_summaries s
SET ppm_rate = NULL,
    ppm_source = 'unknown',
    estimated_ppm = 0,
    estimated_tax_total = s.estimated_vat_payable + COALESCE(s.estimated_withholdings, 0),
    recommended_reserve = s.estimated_vat_payable + COALESCE(s.estimated_withholdings, 0),
    projected_tax_min = s.estimated_vat_payable + COALESCE(s.estimated_withholdings, 0),
    projected_tax_max = s.estimated_vat_payable + COALESCE(s.estimated_withholdings, 0)
FROM public.tax_periods p, public.tax_companies c
WHERE s.tax_period_id = p.id
  AND p.company_id = c.id
  AND c.rut = '779762289'
  AND c.is_demo = false
  AND p.period = '2026-04'
  AND s.ppm_source = 'configured'
  AND s.ppm_rate = 0.006;