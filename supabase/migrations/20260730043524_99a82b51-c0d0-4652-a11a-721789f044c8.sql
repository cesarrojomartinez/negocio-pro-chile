-- ENUMS nuevos
DO $$ BEGIN CREATE TYPE public.sii_provider AS ENUM ('mock','api_gateway'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.sii_auth_method AS ENUM ('demo','tax_key','certificate'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.sii_snapshot_module AS ENUM (
  'rcv_sales_summary','rcv_sales_documents','rcv_purchases_registered','rcv_purchases_pending',
  'rcv_purchases_claimed','rcv_purchases_excluded','f29_periods','f29_detail','withholdings'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Conexiones SII (nunca guarda credenciales)
CREATE TABLE IF NOT EXISTS public.tax_sii_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  provider public.sii_provider NOT NULL DEFAULT 'mock',
  provider_connection_ref TEXT,
  auth_method public.sii_auth_method NOT NULL DEFAULT 'demo',
  status public.sii_connection_status NOT NULL DEFAULT 'disconnected',
  authorized_rut TEXT,
  connected_at TIMESTAMPTZ,
  session_expires_at TIMESTAMPTZ,
  last_successful_sync_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  consent_accepted_at TIMESTAMPTZ,
  consent_version TEXT,
  disconnected_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sii_connection_company_provider
  ON public.tax_sii_connections (company_id, provider);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sii_connection_active
  ON public.tax_sii_connections (company_id)
  WHERE status IN ('connecting','connected','stale');

GRANT SELECT ON public.tax_sii_connections TO authenticated;
GRANT ALL ON public.tax_sii_connections TO service_role;
ALTER TABLE public.tax_sii_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sii_connections_select ON public.tax_sii_connections;
CREATE POLICY sii_connections_select ON public.tax_sii_connections
  FOR SELECT TO authenticated
  USING (private.is_active_company_member(company_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_sii_connections_updated ON public.tax_sii_connections;
CREATE TRIGGER trg_sii_connections_updated BEFORE UPDATE ON public.tax_sii_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Snapshots del proveedor simulado
CREATE TABLE IF NOT EXISTS public.tax_provider_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  tax_period_id UUID REFERENCES public.tax_periods(id) ON DELETE CASCADE,
  sync_run_id UUID REFERENCES public.tax_sync_runs(id) ON DELETE SET NULL,
  provider public.sii_provider NOT NULL DEFAULT 'mock',
  module public.sii_snapshot_module NOT NULL,
  provider_reference TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_checksum TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  normalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_snapshots_lookup
  ON public.tax_provider_snapshots (company_id, tax_period_id, module, received_at DESC);

GRANT SELECT ON public.tax_provider_snapshots TO authenticated;
GRANT ALL ON public.tax_provider_snapshots TO service_role;
ALTER TABLE public.tax_provider_snapshots ENABLE ROW LEVEL SECURITY;

-- Solo owner y accountant pueden leer el payload bruto
DROP POLICY IF EXISTS provider_snapshots_select ON public.tax_provider_snapshots;
CREATE POLICY provider_snapshots_select ON public.tax_provider_snapshots
  FOR SELECT TO authenticated
  USING (private.has_company_role(company_id, auth.uid(), ARRAY['owner','accountant']::public.app_company_role[]));

-- 3. Ampliación del registro de sincronizaciones
ALTER TABLE public.tax_sync_runs
  ADD COLUMN IF NOT EXISTS trigger_type public.tax_sync_type,
  ADD COLUMN IF NOT EXISTS modules_requested TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS modules_completed TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS modules_failed TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider_request_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_credits NUMERIC,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS data_through_date DATE,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS triggered_by UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_runs_idempotency
  ON public.tax_sync_runs (company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Un solo proceso activo por empresa y periodo
CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_runs_running
  ON public.tax_sync_runs (company_id, tax_period_id)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_sync_runs_company_started
  ON public.tax_sync_runs (company_id, started_at DESC);

-- 4. Deduplicación por identificador externo del proveedor
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_external
  ON public.tax_documents (company_id, source, external_id)
  WHERE external_id IS NOT NULL;