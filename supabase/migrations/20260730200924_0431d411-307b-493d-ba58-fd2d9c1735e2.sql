ALTER TABLE public.tax_sii_connections
  ADD COLUMN IF NOT EXISTS sync_mode text NOT NULL DEFAULT 'manual_secure',
  ADD COLUMN IF NOT EXISTS automation_status text NOT NULL DEFAULT 'unavailable',
  ADD COLUMN IF NOT EXISTS automation_reason text,
  ADD COLUMN IF NOT EXISTS authorization_method text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS sync_mode_updated_at timestamptz;

ALTER TABLE public.tax_sii_connections
  DROP CONSTRAINT IF EXISTS tax_sii_connections_sync_mode_check;
ALTER TABLE public.tax_sii_connections
  ADD CONSTRAINT tax_sii_connections_sync_mode_check
  CHECK (sync_mode IN ('manual_secure','advanced_automation'));
ALTER TABLE public.tax_sii_connections
  DROP CONSTRAINT IF EXISTS tax_sii_connections_automation_status_check;
ALTER TABLE public.tax_sii_connections
  ADD CONSTRAINT tax_sii_connections_automation_status_check
  CHECK (automation_status IN ('unavailable','requested','pending_authorization','active','revoked','error'));
ALTER TABLE public.tax_sii_connections
  DROP CONSTRAINT IF EXISTS tax_sii_connections_authorization_method_check;
ALTER TABLE public.tax_sii_connections
  ADD CONSTRAINT tax_sii_connections_authorization_method_check
  CHECK (authorization_method IN ('none','manual_key_in_memory','delegated_representative','digital_certificate'));

CREATE TABLE IF NOT EXISTS public.tax_period_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  tax_period_id uuid NOT NULL REFERENCES public.tax_periods(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mock',
  last_successful_sync_at timestamptz,
  last_attempt_at timestamptz,
  last_provider_request_at timestamptz,
  last_cache_hit_at timestamptz,
  last_sync_run_id uuid,
  last_trigger_type text,
  data_through_date date,
  freshness_status text NOT NULL DEFAULT 'never_synced',
  next_recommended_sync_at timestamptz,
  provider_request_count integer NOT NULL DEFAULT 0,
  cache_hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_period_sync_state_unique UNIQUE (company_id, tax_period_id, provider),
  CONSTRAINT tax_period_sync_state_freshness_check
    CHECK (freshness_status IN ('never_synced','fresh','stale','outdated','closed_period'))
);

CREATE INDEX IF NOT EXISTS tax_period_sync_state_company_idx
  ON public.tax_period_sync_state (company_id, tax_period_id);

GRANT SELECT ON public.tax_period_sync_state TO authenticated;
GRANT ALL ON public.tax_period_sync_state TO service_role;
ALTER TABLE public.tax_period_sync_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS period_sync_state_select ON public.tax_period_sync_state;
CREATE POLICY period_sync_state_select ON public.tax_period_sync_state
  FOR SELECT TO authenticated
  USING (private.is_active_company_member(company_id, auth.uid()));

DROP TRIGGER IF EXISTS tax_period_sync_state_updated_at ON public.tax_period_sync_state;
CREATE TRIGGER tax_period_sync_state_updated_at
  BEFORE UPDATE ON public.tax_period_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tax_periods
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_by uuid,
  ADD COLUMN IF NOT EXISTS reopen_reason text,
  ADD COLUMN IF NOT EXISTS review_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_requested_by uuid;

CREATE TABLE IF NOT EXISTS public.tax_period_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  tax_period_id uuid NOT NULL REFERENCES public.tax_periods(id) ON DELETE CASCADE,
  estimated_vat numeric(14,2) NOT NULL DEFAULT 0,
  declared_vat numeric(14,2) NOT NULL DEFAULT 0,
  estimated_ppm numeric(14,2) NOT NULL DEFAULT 0,
  declared_ppm numeric(14,2) NOT NULL DEFAULT 0,
  estimated_withholdings numeric(14,2) NOT NULL DEFAULT 0,
  declared_withholdings numeric(14,2) NOT NULL DEFAULT 0,
  estimated_total numeric(14,2) NOT NULL DEFAULT 0,
  declared_total numeric(14,2) NOT NULL DEFAULT 0,
  difference_total numeric(14,2) NOT NULL DEFAULT 0,
  difference_percent numeric(8,4),
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_period_comparisons_unique UNIQUE (company_id, tax_period_id)
);

GRANT SELECT ON public.tax_period_comparisons TO authenticated;
GRANT ALL ON public.tax_period_comparisons TO service_role;
ALTER TABLE public.tax_period_comparisons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS period_comparisons_select ON public.tax_period_comparisons;
CREATE POLICY period_comparisons_select ON public.tax_period_comparisons
  FOR SELECT TO authenticated
  USING (private.is_active_company_member(company_id, auth.uid()));

DROP TRIGGER IF EXISTS tax_period_comparisons_updated_at ON public.tax_period_comparisons;
CREATE TRIGGER tax_period_comparisons_updated_at
  BEFORE UPDATE ON public.tax_period_comparisons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tax_f29_history
  ADD COLUMN IF NOT EXISTS previous_vat_carryforward numeric(14,2),
  ADD COLUMN IF NOT EXISTS new_vat_carryforward numeric(14,2),
  ADD COLUMN IF NOT EXISTS declared_ppm_rate numeric(8,4),
  ADD COLUMN IF NOT EXISTS declared_ppm_base numeric(14,2),
  ADD COLUMN IF NOT EXISTS folio text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

ALTER TABLE public.tax_alerts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS action_label text,
  ADD COLUMN IF NOT EXISTS action_route text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.tax_alerts DROP CONSTRAINT IF EXISTS tax_alerts_status_check;
ALTER TABLE public.tax_alerts
  ADD CONSTRAINT tax_alerts_status_check CHECK (status IN ('open','resolved','dismissed'));
CREATE UNIQUE INDEX IF NOT EXISTS tax_alerts_open_unique
  ON public.tax_alerts (company_id, tax_period_id, alert_type)
  WHERE status = 'open';

ALTER TABLE public.tax_company_settings
  ADD COLUMN IF NOT EXISTS weekly_sync_reminder_enabled boolean NOT NULL DEFAULT true;