ALTER TABLE public.tax_monthly_summaries
  ADD COLUMN IF NOT EXISTS pre_f29_tax_total numeric,
  ADD COLUMN IF NOT EXISTS pre_f29_vat_payable numeric,
  ADD COLUMN IF NOT EXISTS pre_f29_ppm numeric,
  ADD COLUMN IF NOT EXISTS pre_f29_withholdings numeric,
  ADD COLUMN IF NOT EXISTS f29_deviation_amount numeric,
  ADD COLUMN IF NOT EXISTS f29_deviation_pct numeric,
  ADD COLUMN IF NOT EXISTS f29_deviation_measured_at timestamptz;

COMMENT ON COLUMN public.tax_monthly_summaries.pre_f29_tax_total IS 'Total tributario estimado por el motor antes de aplicar las cifras del F29 oficial.';
COMMENT ON COLUMN public.tax_monthly_summaries.f29_deviation_pct IS 'Desviacion porcentual de la estimacion respecto del total declarado en el F29.';