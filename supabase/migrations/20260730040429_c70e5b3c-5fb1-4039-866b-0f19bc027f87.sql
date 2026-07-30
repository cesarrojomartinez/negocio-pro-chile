-- 1. Perfiles automáticos al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'first_name'), ''), '');
  v_last  text := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'last_name'), ''), '');
  v_disp  text;
BEGIN
  v_disp := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'display_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(TRIM(v_first || ' ' || v_last), ''),
    split_part(COALESCE(NEW.email, ''), '@', 1),
    ''
  );

  INSERT INTO public.profiles (id, first_name, last_name, display_name)
  VALUES (NEW.id, v_first, v_last, v_disp)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Reparación defensiva para usuarios antiguos sin perfil
INSERT INTO public.profiles (id, first_name, last_name, display_name)
SELECT u.id,
       COALESCE(NULLIF(TRIM(u.raw_user_meta_data ->> 'first_name'), ''), ''),
       COALESCE(NULLIF(TRIM(u.raw_user_meta_data ->> 'last_name'), ''), ''),
       COALESCE(
         NULLIF(TRIM(u.raw_user_meta_data ->> 'display_name'), ''),
         split_part(COALESCE(u.email, ''), '@', 1),
         ''
       )
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 2. Último propietario protegido a nivel de base de datos
CREATE OR REPLACE FUNCTION public.enforce_last_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := COALESCE(OLD.company_id, NEW.company_id);
  v_remaining int;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.role = 'owner' AND OLD.status = 'active'
     AND (NEW.role IS DISTINCT FROM 'owner' OR NEW.status IS DISTINCT FROM 'active') THEN
    NULL;
  ELSIF TG_OP = 'DELETE' AND OLD.role = 'owner' AND OLD.status = 'active' THEN
    NULL;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Bloqueo de filas de la empresa para evitar carreras entre operaciones simultáneas
  PERFORM 1 FROM public.tax_company_members
   WHERE company_id = v_company FOR UPDATE;

  SELECT count(*) INTO v_remaining
    FROM public.tax_company_members
   WHERE company_id = v_company
     AND role = 'owner'
     AND status = 'active'
     AND id <> OLD.id;

  IF v_remaining = 0 THEN
    INSERT INTO public.tax_activity_logs (company_id, user_id, action, entity_type, metadata)
    VALUES (v_company, auth.uid(), 'member.last_owner_blocked', 'tax_company_members',
            jsonb_build_object('operacion', TG_OP));
    RAISE EXCEPTION 'La empresa debe mantener al menos un propietario activo.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_last_owner ON public.tax_company_members;
CREATE TRIGGER trg_enforce_last_owner
BEFORE UPDATE OR DELETE ON public.tax_company_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_last_owner();

-- 3. Registros de actividad restringidos por rol
CREATE OR REPLACE FUNCTION private.company_role(_company_id uuid, _user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
    FROM public.tax_company_members
   WHERE company_id = _company_id
     AND user_id = _user_id
     AND status = 'active'
   LIMIT 1
$$;

DROP POLICY IF EXISTS activity_select_members ON public.tax_activity_logs;

CREATE POLICY activity_select_by_role
ON public.tax_activity_logs
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND CASE private.company_role(company_id, auth.uid())
        WHEN 'owner' THEN true
        WHEN 'accountant' THEN (
          action LIKE 'sync.%' OR action LIKE 'period.%' OR action LIKE 'tax.%'
          OR action LIKE 'f29.%' OR action LIKE 'document.%' OR action LIKE 'calculation.%'
        )
        WHEN 'business_user' THEN user_id = auth.uid()
        ELSE false
      END
);

REVOKE INSERT, UPDATE, DELETE ON public.tax_activity_logs FROM authenticated, anon;
GRANT SELECT ON public.tax_activity_logs TO authenticated;
GRANT ALL ON public.tax_activity_logs TO service_role;

-- 4. Campos nuevos del resumen mensual
ALTER TABLE public.tax_monthly_summaries
  ADD COLUMN IF NOT EXISTS vat_credit_potential numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carryforward_source text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS ppm_rate numeric,
  ADD COLUMN IF NOT EXISTS ppm_tax_base numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ppm_source text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS withholdings_source text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS preventive_margin_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS projected_vat_debit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS projected_tax_min numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS projected_tax_max numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence_level text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS confidence_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.tax_monthly_summaries
  DROP CONSTRAINT IF EXISTS tax_monthly_summaries_carryforward_source_check;
ALTER TABLE public.tax_monthly_summaries
  ADD CONSTRAINT tax_monthly_summaries_carryforward_source_check
  CHECK (carryforward_source IN ('f29', 'previous_period', 'mock', 'unknown'));

ALTER TABLE public.tax_monthly_summaries
  DROP CONSTRAINT IF EXISTS tax_monthly_summaries_ppm_source_check;
ALTER TABLE public.tax_monthly_summaries
  ADD CONSTRAINT tax_monthly_summaries_ppm_source_check
  CHECK (ppm_source IN ('configured', 'previous_f29', 'mock', 'unknown'));

ALTER TABLE public.tax_monthly_summaries
  DROP CONSTRAINT IF EXISTS tax_monthly_summaries_withholdings_source_check;
ALTER TABLE public.tax_monthly_summaries
  ADD CONSTRAINT tax_monthly_summaries_withholdings_source_check
  CHECK (withholdings_source IN ('f29_history', 'documents', 'configured', 'mock', 'unknown'));

ALTER TABLE public.tax_monthly_summaries
  DROP CONSTRAINT IF EXISTS tax_monthly_summaries_confidence_check;
ALTER TABLE public.tax_monthly_summaries
  ADD CONSTRAINT tax_monthly_summaries_confidence_check
  CHECK (confidence_level IN ('high', 'medium', 'low', 'unknown'));

ALTER TABLE public.tax_monthly_summaries
  DROP CONSTRAINT IF EXISTS tax_monthly_summaries_margin_check;
ALTER TABLE public.tax_monthly_summaries
  ADD CONSTRAINT tax_monthly_summaries_margin_check
  CHECK (preventive_margin_percent >= 0 AND preventive_margin_percent <= 50);

ALTER TABLE public.tax_company_settings
  DROP CONSTRAINT IF EXISTS tax_company_settings_margin_check;
ALTER TABLE public.tax_company_settings
  ADD CONSTRAINT tax_company_settings_margin_check
  CHECK (preventive_margin_percent >= 0 AND preventive_margin_percent <= 50);