CREATE TABLE public.tax_sync_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  created_by uuid,
  requested_periods text[] NOT NULL DEFAULT '{}',
  execution_mode text NOT NULL DEFAULT 'manual_secure',
  requires_credentials boolean NOT NULL DEFAULT false,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan_status text NOT NULL DEFAULT 'planned',
  in_progress boolean NOT NULL DEFAULT true,
  planned_calls integer NOT NULL DEFAULT 0,
  actual_calls integer NOT NULL DEFAULT 0,
  planned_credit_min numeric NOT NULL DEFAULT 0,
  planned_credit_max numeric NOT NULL DEFAULT 0,
  actual_credits numeric NOT NULL DEFAULT 0,
  calls_avoided_by_cache integer NOT NULL DEFAULT 0,
  unplanned_calls_blocked integer NOT NULL DEFAULT 0,
  error_code text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tax_sync_plans_lock_unico
  ON public.tax_sync_plans (company_id)
  WHERE in_progress;

CREATE INDEX tax_sync_plans_company_idx
  ON public.tax_sync_plans (company_id, started_at DESC);

GRANT SELECT ON public.tax_sync_plans TO authenticated;
GRANT ALL ON public.tax_sync_plans TO service_role;

ALTER TABLE public.tax_sync_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_plans_select_members" ON public.tax_sync_plans
  FOR SELECT TO authenticated
  USING (private.is_active_company_member(company_id, auth.uid()));