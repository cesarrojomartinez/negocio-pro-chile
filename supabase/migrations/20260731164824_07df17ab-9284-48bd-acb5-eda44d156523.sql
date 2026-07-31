-- Etapa 6.8.2 — validación piloto del núcleo unificado.
-- Todas las tablas son de uso exclusivo del servidor: sin GRANT a anon/authenticated.

CREATE TABLE IF NOT EXISTS public.tax_pilot_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alias TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);
GRANT ALL ON public.tax_pilot_companies TO service_role;
ALTER TABLE public.tax_pilot_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pilot_companies_service_only" ON public.tax_pilot_companies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.tax_parity_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  company_alias TEXT NOT NULL,
  period TEXT NOT NULL,
  calculation_input_hash TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  projection_version TEXT NOT NULL,
  visible_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  visible_sources JSONB NOT NULL DEFAULT '{}'::jsonb,
  visible_states JSONB NOT NULL DEFAULT '{}'::jsonb,
  main_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  has_official_f29 BOOLEAN NOT NULL DEFAULT false,
  official_reference_hash TEXT,
  period_state TEXT NOT NULL,
  provider_called BOOLEAN NOT NULL DEFAULT false,
  credits_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (company_id, period, calculation_input_hash)
);
GRANT ALL ON public.tax_parity_snapshots TO service_role;
ALTER TABLE public.tax_parity_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parity_snapshots_service_only" ON public.tax_parity_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.tax_parity_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  company_alias TEXT NOT NULL,
  period TEXT NOT NULL,
  field TEXT NOT NULL,
  legacy_value TEXT,
  unified_raw_value TEXT,
  compatibility_value TEXT,
  official_value TEXT,
  legacy_vs_compatibility_difference NUMERIC,
  unified_vs_official_difference NUMERIC,
  difference_category TEXT NOT NULL,
  explanation TEXT NOT NULL,
  blocking BOOLEAN NOT NULL DEFAULT false,
  calculation_input_hash TEXT NOT NULL,
  validated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (company_id, period, field, calculation_input_hash)
);
GRANT ALL ON public.tax_parity_results TO service_role;
ALTER TABLE public.tax_parity_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parity_results_service_only" ON public.tax_parity_results
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.tax_pilot_validation_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  company_alias TEXT NOT NULL,
  period_from TEXT,
  period_to TEXT,
  periods_found INTEGER NOT NULL DEFAULT 0,
  periods_validated INTEGER NOT NULL DEFAULT 0,
  periods_exact INTEGER NOT NULL DEFAULT 0,
  compatibility_differences INTEGER NOT NULL DEFAULT 0,
  official_differences INTEGER NOT NULL DEFAULT 0,
  compatibility_fallbacks INTEGER NOT NULL DEFAULT 0,
  unknown_components INTEGER NOT NULL DEFAULT 0,
  unsupported_components INTEGER NOT NULL DEFAULT 0,
  runs_reused INTEGER NOT NULL DEFAULT 0,
  calculation_ms INTEGER NOT NULL DEFAULT 0,
  provider_calls INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  blocking_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  promotion_ready BOOLEAN NOT NULL DEFAULT false,
  engine_version TEXT NOT NULL,
  projection_version TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.tax_pilot_validation_reports TO service_role;
ALTER TABLE public.tax_pilot_validation_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pilot_reports_service_only" ON public.tax_pilot_validation_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.tax_engine_promotions
  ADD COLUMN IF NOT EXISTS engine_version TEXT,
  ADD COLUMN IF NOT EXISTS projection_version TEXT,
  ADD COLUMN IF NOT EXISTS approval_reason TEXT,
  ADD COLUMN IF NOT EXISTS validation_report_id UUID REFERENCES public.tax_pilot_validation_reports(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS update_tax_pilot_companies_updated_at ON public.tax_pilot_companies;
CREATE TRIGGER update_tax_pilot_companies_updated_at
  BEFORE UPDATE ON public.tax_pilot_companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS update_tax_parity_snapshots_updated_at ON public.tax_parity_snapshots;
CREATE TRIGGER update_tax_parity_snapshots_updated_at
  BEFORE UPDATE ON public.tax_parity_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS update_tax_pilot_validation_reports_updated_at ON public.tax_pilot_validation_reports;
CREATE TRIGGER update_tax_pilot_validation_reports_updated_at
  BEFORE UPDATE ON public.tax_pilot_validation_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();