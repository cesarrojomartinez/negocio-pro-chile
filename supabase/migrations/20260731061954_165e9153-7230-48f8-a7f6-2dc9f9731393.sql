CREATE TABLE IF NOT EXISTS public.tax_sync_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  sync_mode text NOT NULL DEFAULT 'manual_secure',
  automation_status text NOT NULL DEFAULT 'unavailable',
  authorization_method text NOT NULL DEFAULT 'none',
  authorization_reference text,
  authorization_created_at timestamptz,
  authorization_expires_at timestamptz,
  authorization_revoked_at timestamptz,
  automation_schedule text,
  automation_error_code text,
  last_automated_attempt_at timestamptz,
  last_automated_success_at timestamptz,
  reminder_enabled boolean NOT NULL DEFAULT true,
  reminder_day_of_month smallint NOT NULL DEFAULT 1,
  reminder_status text NOT NULL DEFAULT 'scheduled',
  next_reminder_at timestamptz,
  last_reminder_at timestamptz,
  reminder_dismissed_at timestamptz,
  monthly_credit_budget numeric(12,4),
  credits_used_current_month numeric(12,4) NOT NULL DEFAULT 0,
  credits_month text,
  warning_threshold_percent smallint NOT NULL DEFAULT 80,
  blocking_threshold_percent smallint NOT NULL DEFAULT 100,
  last_provider_balance numeric(12,4),
  last_provider_balance_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_sync_preferences_company_unique UNIQUE (company_id),
  CONSTRAINT tax_sync_preferences_sync_mode_check
    CHECK (sync_mode IN ('manual_secure','automated_authorized')),
  CONSTRAINT tax_sync_preferences_automation_status_check
    CHECK (automation_status IN ('unavailable','pending_setup','active','paused','error','revoked')),
  CONSTRAINT tax_sync_preferences_authorization_method_check
    CHECK (authorization_method IN ('none','digital_certificate','digital_mandate','provider_authorization','other_compatible_method')),
  CONSTRAINT tax_sync_preferences_reminder_status_check
    CHECK (reminder_status IN ('disabled','scheduled','due','dismissed','completed')),
  CONSTRAINT tax_sync_preferences_reminder_day_check
    CHECK (reminder_day_of_month BETWEEN 1 AND 28),
  CONSTRAINT tax_sync_preferences_thresholds_check
    CHECK (warning_threshold_percent BETWEEN 1 AND 100 AND blocking_threshold_percent BETWEEN 1 AND 200),
  CONSTRAINT tax_sync_preferences_reference_len_check
    CHECK (authorization_reference IS NULL OR length(authorization_reference) <= 200)
);

CREATE INDEX IF NOT EXISTS tax_sync_preferences_company_idx
  ON public.tax_sync_preferences (company_id);

-- Auditoría: impide guardar accidentalmente cualquier rastro de credenciales
-- en la referencia opaca de autorización.
CREATE OR REPLACE FUNCTION public.tax_sync_preferences_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.authorization_reference IS NOT NULL
     AND NEW.authorization_reference ~* '(clave|password|contrase|secret|pass=|pwd|tributaria)' THEN
    RAISE EXCEPTION 'authorization_reference no puede contener credenciales';
  END IF;
  -- Nunca puede activarse una automatización sin método de autorización real.
  IF NEW.automation_status = 'active' AND NEW.authorization_method = 'none' THEN
    RAISE EXCEPTION 'No se puede activar la automatizacion sin un metodo de autorizacion verificado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tax_sync_preferences_guard_trg ON public.tax_sync_preferences;
CREATE TRIGGER tax_sync_preferences_guard_trg
  BEFORE INSERT OR UPDATE ON public.tax_sync_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tax_sync_preferences_guard();

DROP TRIGGER IF EXISTS tax_sync_preferences_updated_at ON public.tax_sync_preferences;
CREATE TRIGGER tax_sync_preferences_updated_at
  BEFORE UPDATE ON public.tax_sync_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.tax_sync_preferences TO authenticated;
GRANT ALL ON public.tax_sync_preferences TO service_role;
ALTER TABLE public.tax_sync_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tax_sync_preferences_select ON public.tax_sync_preferences;
CREATE POLICY tax_sync_preferences_select ON public.tax_sync_preferences
  FOR SELECT TO authenticated
  USING (private.is_active_company_member(company_id, auth.uid()));

-- Migración de las empresas actuales al modo seguro, sin tocar sus datos.
INSERT INTO public.tax_sync_preferences (company_id)
SELECT c.id FROM public.tax_companies c
ON CONFLICT (company_id) DO NOTHING;

-- Verificación defensiva: ninguna columna de credenciales puede existir.
DO $$
DECLARE prohibida text;
BEGIN
  SELECT column_name INTO prohibida
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'tax_sync_preferences'
    AND column_name IN ('sii_password','tax_password','encrypted_password',
      'tributary_password','stored_credentials','clave_sii','clave_tributaria');
  IF prohibida IS NOT NULL THEN
    RAISE EXCEPTION 'Columna de credenciales prohibida: %', prohibida;
  END IF;
END $$;