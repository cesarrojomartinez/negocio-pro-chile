ALTER TABLE public.tax_sync_runs
  ADD COLUMN IF NOT EXISTS modules_from_cache sii_snapshot_module[] NOT NULL DEFAULT '{}'::sii_snapshot_module[];

COMMENT ON COLUMN public.tax_sync_runs.modules_from_cache IS 'Modulos que no se volvieron a consultar porque la informacion guardada seguia vigente.';