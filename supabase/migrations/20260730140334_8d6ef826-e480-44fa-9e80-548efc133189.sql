ALTER TABLE public.tax_company_settings
  ADD COLUMN IF NOT EXISTS ppm_rate_confirmed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tax_company_settings.ppm_rate_confirmed IS
  'La tasa de PPM guardada fue confirmada por el contador o el usuario. Si es falsa, no debe usarse en empresas reales.';