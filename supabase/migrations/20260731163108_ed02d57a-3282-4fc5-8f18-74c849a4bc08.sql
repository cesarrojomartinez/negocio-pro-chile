ALTER TABLE public.tax_monthly_summaries
  ADD COLUMN IF NOT EXISTS calculation_engine TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS unified_engine_mode TEXT NOT NULL DEFAULT 'shadow',
  ADD COLUMN IF NOT EXISTS unified_engine_version TEXT,
  ADD COLUMN IF NOT EXISTS compatibility_projection_version TEXT,
  ADD COLUMN IF NOT EXISTS calculation_run_id UUID,
  ADD COLUMN IF NOT EXISTS calculation_input_hash TEXT,
  ADD COLUMN IF NOT EXISTS calculation_run_status TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS parity_exact BOOLEAN,
  ADD COLUMN IF NOT EXISTS parity_differences_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.tax_engine_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  unified_engine_mode TEXT NOT NULL DEFAULT 'shadow',
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rollback_reason TEXT,
  rolled_back_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

GRANT SELECT ON public.tax_engine_settings TO authenticated;
GRANT ALL ON public.tax_engine_settings TO service_role;
ALTER TABLE public.tax_engine_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros activos ven el motor de su empresa"
ON public.tax_engine_settings FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tax_company_members m
    WHERE m.company_id = tax_engine_settings.company_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  )
);

CREATE TABLE IF NOT EXISTS public.tax_engine_promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  promotion_status TEXT NOT NULL,
  from_mode TEXT NOT NULL,
  to_mode TEXT NOT NULL,
  periods_validated INTEGER NOT NULL DEFAULT 0,
  differences_found INTEGER NOT NULL DEFAULT 0,
  golden_cases_passed INTEGER NOT NULL DEFAULT 0,
  golden_cases_total INTEGER NOT NULL DEFAULT 0,
  visual_snapshots_approved BOOLEAN NOT NULL DEFAULT false,
  blocking_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tax_engine_promotions TO authenticated;
GRANT ALL ON public.tax_engine_promotions TO service_role;
ALTER TABLE public.tax_engine_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dueno y contador ven las promociones de motor"
ON public.tax_engine_promotions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tax_company_members m
    WHERE m.company_id = tax_engine_promotions.company_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('owner', 'accountant')
  )
);

CREATE INDEX IF NOT EXISTS tax_engine_promotions_empresa_idx
  ON public.tax_engine_promotions (company_id, created_at DESC);