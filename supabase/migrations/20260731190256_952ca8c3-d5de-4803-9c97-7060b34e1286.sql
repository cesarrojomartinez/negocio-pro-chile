ALTER TABLE public.tax_mirror_calculation_runs
  DROP CONSTRAINT IF EXISTS tax_mirror_runs_mode_shadow;
ALTER TABLE public.tax_mirror_calculation_runs
  ADD CONSTRAINT tax_mirror_runs_mode_valido
  CHECK (mode IN ('shadow_only','compatibility'));