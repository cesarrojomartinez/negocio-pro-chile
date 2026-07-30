ALTER TABLE public.tax_sync_runs
  ADD COLUMN IF NOT EXISTS actual_credits numeric(12,4),
  ADD COLUMN IF NOT EXISTS credits_balance numeric(12,4),
  ADD COLUMN IF NOT EXISTS proxy_used boolean,
  ADD COLUMN IF NOT EXISTS pages_requested integer NOT NULL DEFAULT 0;