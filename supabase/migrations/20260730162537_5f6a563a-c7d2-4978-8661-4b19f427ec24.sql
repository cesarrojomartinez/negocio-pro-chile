-- 1. Trazabilidad de confirmación en los parámetros con vigencia temporal
ALTER TABLE public.tax_company_tax_parameters
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.tax_company_tax_parameters
SET confirmed_at = COALESCE(confirmed_at, created_at)
WHERE confirmed = true AND confirmed_at IS NULL;

-- Evita traslapes de vigencia para un mismo parámetro de la empresa
CREATE INDEX IF NOT EXISTS tax_company_tax_parameters_lookup
  ON public.tax_company_tax_parameters (company_id, parameter_type, effective_from DESC);

-- 2. Conciliación de remanentes entre periodos consecutivos
CREATE TABLE IF NOT EXISTS public.tax_carryforward_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  tax_period_id uuid NOT NULL REFERENCES public.tax_periods(id) ON DELETE CASCADE,
  previous_period text NOT NULL,
  calculated_previous_carryforward numeric(14,2) NOT NULL,
  declared_previous_carryforward numeric(14,2) NOT NULL,
  difference numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, tax_period_id)
);

GRANT SELECT ON public.tax_carryforward_reconciliations TO authenticated;
GRANT ALL ON public.tax_carryforward_reconciliations TO service_role;
ALTER TABLE public.tax_carryforward_reconciliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carryforward_reconciliations_select_members ON public.tax_carryforward_reconciliations;
CREATE POLICY carryforward_reconciliations_select_members
  ON public.tax_carryforward_reconciliations
  FOR SELECT TO authenticated
  USING (private.is_active_company_member(company_id, auth.uid()));

-- 3. Corrección de vigencias de la tasa de PPM de explotación de madera jmc spa
UPDATE public.tax_company_tax_parameters
SET effective_from = DATE '2026-04-01',
    notes = 'Tasa 2,5% confirmada en los F29 de abril, mayo y junio de 2026. No aplica a periodos anteriores.',
    confirmed_at = COALESCE(confirmed_at, now()),
    updated_at = now()
WHERE company_id = 'bdc659fe-ef6e-4e14-82a5-33c8e32c86ba'
  AND parameter_type = 'ppm_rate'
  AND effective_from = DATE '2026-01-01';

INSERT INTO public.tax_company_tax_parameters
  (company_id, parameter_type, value, effective_from, effective_to, confirmed, source, notes, confirmed_at)
SELECT 'bdc659fe-ef6e-4e14-82a5-33c8e32c86ba', 'ppm_rate', 0.01,
       DATE '2026-03-01', DATE '2026-03-31', true, 'accountant_confirmed',
       'Tasa 1% confirmada en el F29 de marzo de 2026 preparado por el contador.', now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tax_company_tax_parameters
  WHERE company_id = 'bdc659fe-ef6e-4e14-82a5-33c8e32c86ba'
    AND parameter_type = 'ppm_rate'
    AND effective_from = DATE '2026-03-01'
);

-- 4. F29 de marzo de 2026 confirmado por el contador
UPDATE public.tax_f29_history f
SET declaration_status = 'filed',
    source = 'accountant',
    declared_vat = 0,
    declared_ppm = 39981,
    declared_withholdings = 0,
    declared_total = 39981,
    vat_carryforward = 208968,
    raw_data = jsonb_build_object(
      'origin', 'accountant_confirmed_f29',
      'ppm_rate', 0.01,
      'ppm_tax_base', 3998100,
      'vat_debit', 759639,
      'vat_credit', 664047,
      'previous_vat_carryforward', 208968,
      'new_vat_carryforward', 113376,
      'confirmation_status', 'confirmed'
    )
FROM public.tax_periods tp
WHERE tp.id = f.tax_period_id
  AND f.company_id = 'bdc659fe-ef6e-4e14-82a5-33c8e32c86ba'
  AND tp.period = '2026-03';