ALTER TABLE public.tax_sync_plans
  ADD COLUMN IF NOT EXISTS plan_amended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS amendment_reason text,
  ADD COLUMN IF NOT EXISTS approved_additional_calls integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_additional_credit_min numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_additional_credit_max numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amendment_created_at timestamptz;

CREATE TABLE IF NOT EXISTS public.tax_sync_plan_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.tax_sync_plans(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  requested_by uuid,
  period text NOT NULL,
  new_folio text NOT NULL,
  previous_folio text,
  reason text NOT NULL,
  resource_id text NOT NULL,
  additional_calls integer NOT NULL DEFAULT 0,
  additional_credit_min numeric NOT NULL DEFAULT 0,
  additional_credit_max numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'approved',
  rejection_code text,
  rejection_detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tax_sync_plan_amendments_unico
  ON public.tax_sync_plan_amendments (plan_id, period, new_folio);
CREATE INDEX IF NOT EXISTS tax_sync_plan_amendments_company_idx
  ON public.tax_sync_plan_amendments (company_id, created_at DESC);

GRANT SELECT ON public.tax_sync_plan_amendments TO authenticated;
GRANT ALL ON public.tax_sync_plan_amendments TO service_role;

ALTER TABLE public.tax_sync_plan_amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros activos ven las ampliaciones de su empresa"
ON public.tax_sync_plan_amendments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tax_company_members m
    WHERE m.company_id = tax_sync_plan_amendments.company_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  )
);

CREATE OR REPLACE FUNCTION public.tax_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tax_sync_plan_amendments_updated_at
BEFORE UPDATE ON public.tax_sync_plan_amendments
FOR EACH ROW EXECUTE FUNCTION public.tax_touch_updated_at();