ALTER TABLE public.tax_monthly_summaries
  ADD COLUMN IF NOT EXISTS certainty_status text,
  ADD COLUMN IF NOT EXISTS legacy_fallback_count integer;