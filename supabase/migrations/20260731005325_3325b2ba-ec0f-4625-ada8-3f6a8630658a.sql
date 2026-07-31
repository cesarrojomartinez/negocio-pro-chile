-- Antecedente oficial de enero 2026 tomado del F29 compacto del SII (folio 8801846146).
INSERT INTO public.tax_f29_history (
  company_id, tax_period_id, declaration_status, folio,
  declared_vat, declared_ppm, declared_withholdings, declared_total,
  vat_carryforward, previous_vat_carryforward, new_vat_carryforward,
  declared_ppm_rate, declared_ppm_base, source, raw_data
)
SELECT p.company_id, p.id, 'filed', '8801846146',
       574605, 42870, 0, 617475,
       0, 0, 0,
       0.01, 4287000, 'accountant',
       jsonb_build_object(
         'origin', 'accountant_confirmed_f29',
         'folio', '8801846146',
         'vat_debit', 814530,
         'vat_credit', 239925,
         'new_carryforward', 0,
         'total_determined', 617475,
         'ppm_rate', 0.01,
         'ppm_tax_base', 4287000,
         'codigos', jsonb_build_object(
           '538', 814530, '537', 239925, '89', 574605, '77', 0,
           '563', 4287000, '115', 1, '62', 42870, '595', 617475,
           '547', 617475, '91', 617475
         )
       )
FROM public.tax_periods p
JOIN public.tax_companies c ON c.id = p.company_id
WHERE c.rut = '779762289' AND p.period = '2026-01'
ON CONFLICT (company_id, tax_period_id) DO UPDATE SET
  declaration_status = EXCLUDED.declaration_status,
  folio = EXCLUDED.folio,
  declared_vat = EXCLUDED.declared_vat,
  declared_ppm = EXCLUDED.declared_ppm,
  declared_withholdings = EXCLUDED.declared_withholdings,
  declared_total = EXCLUDED.declared_total,
  vat_carryforward = EXCLUDED.vat_carryforward,
  previous_vat_carryforward = EXCLUDED.previous_vat_carryforward,
  new_vat_carryforward = EXCLUDED.new_vat_carryforward,
  declared_ppm_rate = EXCLUDED.declared_ppm_rate,
  declared_ppm_base = EXCLUDED.declared_ppm_base,
  source = EXCLUDED.source,
  raw_data = EXCLUDED.raw_data,
  updated_at = now();

-- La tasa de PPM de 1% está confirmada en los F29 oficiales de enero y marzo de 2026.
UPDATE public.tax_company_tax_parameters t
SET effective_from = DATE '2026-01-01',
    notes = 'Tasa 1% confirmada en los F29 oficiales de enero y marzo de 2026. No aplica desde abril en adelante.',
    updated_at = now()
FROM public.tax_companies c
WHERE c.id = t.company_id
  AND c.rut = '779762289'
  AND t.parameter_type = 'ppm_rate'
  AND t.value = 0.01
  AND t.effective_from = DATE '2026-03-01';