-- 1. Contexto tributario por concepto en los resúmenes mensuales
ALTER TABLE public.tax_monthly_summaries
  ADD COLUMN IF NOT EXISTS sales_source text,
  ADD COLUMN IF NOT EXISTS vat_debit_source text,
  ADD COLUMN IF NOT EXISTS vat_credit_source text,
  ADD COLUMN IF NOT EXISTS ppm_base_source text,
  ADD COLUMN IF NOT EXISTS special_adjustments_source text,
  ADD COLUMN IF NOT EXISTS carryforward_known boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS other_vat_debits numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_vat_credits numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS special_debits numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS special_credits numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_vat_credits numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_vat_position numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS declared_tax_total numeric,
  ADD COLUMN IF NOT EXISTS calculation_status text NOT NULL DEFAULT 'incomplete',
  ADD COLUMN IF NOT EXISTS missing_components jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.tax_monthly_summaries
  DROP CONSTRAINT IF EXISTS tax_monthly_summaries_calculation_status_check;
ALTER TABLE public.tax_monthly_summaries
  ADD CONSTRAINT tax_monthly_summaries_calculation_status_check
  CHECK (calculation_status IN ('complete','estimated_complete','incomplete','confirmed','closed'));

-- 2. Parámetros tributarios vigentes de la empresa
CREATE TABLE IF NOT EXISTS public.tax_company_tax_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  parameter_type text NOT NULL CHECK (parameter_type IN ('ppm_rate','usual_withholdings','preventive_margin','taxpayer_regime')),
  value numeric NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  source text NOT NULL DEFAULT 'accountant_confirmed',
  confirmed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS tax_company_tax_parameters_vigencia_idx
  ON public.tax_company_tax_parameters (company_id, parameter_type, effective_from);

GRANT SELECT ON public.tax_company_tax_parameters TO authenticated;
GRANT ALL ON public.tax_company_tax_parameters TO service_role;

ALTER TABLE public.tax_company_tax_parameters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tax_parameters_select_members ON public.tax_company_tax_parameters;
CREATE POLICY tax_parameters_select_members
  ON public.tax_company_tax_parameters
  FOR SELECT TO authenticated
  USING (private.is_active_company_member(company_id, auth.uid()));

-- 3. F29 de abril 2026 confirmado por el contador
UPDATE public.tax_f29_history
SET declaration_status = 'filed',
    declared_vat = 713997,
    declared_ppm = 150000,
    declared_withholdings = 0,
    declared_total = 863997,
    vat_carryforward = 114353,
    source = 'accountant',
    raw_data = jsonb_build_object(
      'origin', 'accountant_confirmed_f29',
      'confirmation_status', 'confirmed',
      'ppm_rate', 0.025,
      'ppm_tax_base', 6000000,
      'vat_debit', 1140000,
      'vat_credit', 311650
    )
WHERE company_id = 'bdc659fe-ef6e-4e14-82a5-33c8e32c86ba'
  AND tax_period_id = '7b9fad93-20ca-47f7-9134-32bd3b1040d9';

-- 4. Tasa de PPM vigente de la empresa
INSERT INTO public.tax_company_tax_parameters
  (company_id, parameter_type, value, effective_from, source, confirmed, notes)
VALUES
  ('bdc659fe-ef6e-4e14-82a5-33c8e32c86ba', 'ppm_rate', 0.025, '2026-01-01', 'accountant_confirmed', true,
   'Tasa confirmada en los formularios 29 preparados por el contador.')
ON CONFLICT (company_id, parameter_type, effective_from) DO UPDATE
  SET value = EXCLUDED.value, confirmed = true, source = EXCLUDED.source, updated_at = now();