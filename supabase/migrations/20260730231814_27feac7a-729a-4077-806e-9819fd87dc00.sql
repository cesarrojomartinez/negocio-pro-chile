CREATE TABLE IF NOT EXISTS public.tax_validation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  tax_period_id uuid REFERENCES public.tax_periods(id) ON DELETE SET NULL,
  period text NOT NULL,
  validation_type text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  stage text,
  f29_found boolean NOT NULL DEFAULT false,
  f29_folio text,
  f29_pdf_archived boolean NOT NULL DEFAULT false,
  f29_extraction_status text,
  f29_confidence text,
  codes_found jsonb NOT NULL DEFAULT '[]'::jsonb,
  codes_missing jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_total numeric,
  declared_total numeric,
  difference numeric,
  difference_percentage numeric,
  explanation_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  document_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider_requests integer NOT NULL DEFAULT 0,
  cache_hits integer NOT NULL DEFAULT 0,
  prevented_provider_calls integer NOT NULL DEFAULT 0,
  actual_credits numeric NOT NULL DEFAULT 0,
  credits_balance numeric,
  calls jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_code text,
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_validation_runs_period_check CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT tax_validation_runs_type_check CHECK (validation_type IN ('f29','f29_sale','f29_purchase','f29_both')),
  CONSTRAINT tax_validation_runs_status_check CHECK (status IN ('running','success','partial','failed'))
);

CREATE INDEX IF NOT EXISTS tax_validation_runs_company_created_idx
  ON public.tax_validation_runs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tax_validation_runs_company_period_idx
  ON public.tax_validation_runs (company_id, period);

GRANT SELECT ON public.tax_validation_runs TO authenticated;
GRANT ALL ON public.tax_validation_runs TO service_role;

ALTER TABLE public.tax_validation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS validation_runs_select_members ON public.tax_validation_runs;
CREATE POLICY validation_runs_select_members
  ON public.tax_validation_runs FOR SELECT TO authenticated
  USING (private.is_active_company_member(company_id, auth.uid()));

DROP TRIGGER IF EXISTS set_updated_at_tax_validation_runs ON public.tax_validation_runs;
CREATE TRIGGER set_updated_at_tax_validation_runs
  BEFORE UPDATE ON public.tax_validation_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();