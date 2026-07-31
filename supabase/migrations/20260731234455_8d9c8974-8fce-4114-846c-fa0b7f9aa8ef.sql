ALTER TABLE public.tax_plans ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 30;

ALTER TABLE public.tax_landing_testimonials ADD COLUMN IF NOT EXISTS role_title text;
ALTER TABLE public.tax_landing_testimonials ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT true;

ALTER TABLE public.tax_support_tickets ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';
ALTER TABLE public.tax_support_tickets ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

CREATE TABLE IF NOT EXISTS public.tax_admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  company_id uuid REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tax_admin_notes TO service_role;
ALTER TABLE public.tax_admin_notes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.tax_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'aviso',
  priority text NOT NULL DEFAULT 'normal',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_visible boolean NOT NULL DEFAULT false,
  button_label text,
  button_url text,
  audience text NOT NULL DEFAULT 'todos',
  audience_plan_code text,
  audience_company_id uuid REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tax_announcements TO service_role;
ALTER TABLE public.tax_announcements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.tax_announcement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.tax_announcements(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tax_announcement_events TO service_role;
ALTER TABLE public.tax_announcement_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_notes_entity ON public.tax_admin_notes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_announcement_events_ann ON public.tax_announcement_events(announcement_id);

CREATE TRIGGER trg_admin_notes_updated BEFORE UPDATE ON public.tax_admin_notes
  FOR EACH ROW EXECUTE FUNCTION public.tax_touch_updated_at();
CREATE TRIGGER trg_announcements_updated BEFORE UPDATE ON public.tax_announcements
  FOR EACH ROW EXECUTE FUNCTION public.tax_touch_updated_at();