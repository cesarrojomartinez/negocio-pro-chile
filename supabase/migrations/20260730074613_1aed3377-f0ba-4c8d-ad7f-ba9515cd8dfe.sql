ALTER TABLE public.tax_sync_runs
  ADD COLUMN IF NOT EXISTS summary_documents_reported integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS detail_documents_received integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documents_persisted integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documents_rejected integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejection_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS summary_totals jsonb;

ALTER TABLE public.tax_monthly_summaries
  ADD COLUMN IF NOT EXISTS totals_source text NOT NULL DEFAULT 'documents';

ALTER TABLE public.tax_monthly_summaries
  DROP CONSTRAINT IF EXISTS tax_monthly_summaries_totals_source_check;

ALTER TABLE public.tax_monthly_summaries
  ADD CONSTRAINT tax_monthly_summaries_totals_source_check
  CHECK (totals_source IN ('documents', 'rcv_summary'));

ALTER TABLE public.tax_periods
  ADD COLUMN IF NOT EXISTS rcv_summary jsonb,
  ADD COLUMN IF NOT EXISTS rcv_summary_updated_at timestamptz;