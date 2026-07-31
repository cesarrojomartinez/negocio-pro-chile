CREATE TABLE public.tax_period_calculation_certainty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  tax_period_id uuid NOT NULL REFERENCES public.tax_periods(id) ON DELETE CASCADE,
  period text NOT NULL,
  run_id uuid REFERENCES public.tax_mirror_calculation_runs(id) ON DELETE SET NULL,
  engine_version text NOT NULL,
  completeness text NOT NULL,
  confidence text NOT NULL,
  can_present_total boolean NOT NULL,
  reason text,
  blocking_concepts text[] NOT NULL DEFAULT '{}',
  estimated_concepts text[] NOT NULL DEFAULT '{}',
  conflicting_concepts text[] NOT NULL DEFAULT '{}',
  unsupported_concepts text[] NOT NULL DEFAULT '{}',
  not_applicable_concepts text[] NOT NULL DEFAULT '{}',
  missing_inputs text[] NOT NULL DEFAULT '{}',
  zero_audit jsonb NOT NULL DEFAULT '[]'::jsonb,
  component_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tax_period_certainty_unique ON public.tax_period_calculation_certainty (company_id, period, engine_version);
CREATE INDEX tax_period_certainty_company_period ON public.tax_period_calculation_certainty (company_id, period);

GRANT SELECT ON public.tax_period_calculation_certainty TO authenticated;
GRANT ALL ON public.tax_period_calculation_certainty TO service_role;

ALTER TABLE public.tax_period_calculation_certainty ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mirror_certainty_select_members"
ON public.tax_period_calculation_certainty
FOR SELECT
TO authenticated
USING (private.is_active_company_member(company_id, auth.uid()));