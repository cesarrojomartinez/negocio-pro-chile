CREATE TABLE public.master_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grupo text NOT NULL UNIQUE,
  clave text NOT NULL,
  valor_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  descripcion text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX master_settings_clave_key ON public.master_settings (clave);

GRANT ALL ON public.master_settings TO service_role;

ALTER TABLE public.master_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_settings sin acceso directo de usuarios"
  ON public.master_settings FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE TRIGGER master_settings_updated_at
  BEFORE UPDATE ON public.master_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();