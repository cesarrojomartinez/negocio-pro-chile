
ALTER TABLE public.tax_plans
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'mensual',
  ADD COLUMN IF NOT EXISTS public_features text[] NOT NULL DEFAULT '{}';

UPDATE public.tax_plans SET is_featured = true WHERE code = 'basico';
UPDATE public.tax_plans SET public_features = ARRAY['Resumen mensual de ventas y compras','IVA estimado y reserva sugerida','Hasta 2 actualizaciones al mes','Ayuda en línea']
  WHERE code = 'prueba' AND cardinality(public_features) = 0;
UPDATE public.tax_plans SET public_features = ARRAY['Todo lo del plan Prueba','Historial de tus meses anteriores','Hasta 6 actualizaciones al mes','Soporte por correo']
  WHERE code = 'basico' AND cardinality(public_features) = 0;
UPDATE public.tax_plans SET public_features = ARRAY['Todo lo del plan Básico','Acceso para tu contador','Hasta 20 actualizaciones al mes','Soporte prioritario']
  WHERE code = 'profesional' AND cardinality(public_features) = 0;

GRANT SELECT ON public.tax_plans TO anon;

CREATE POLICY "Planes publicos visibles para todos"
  ON public.tax_plans FOR SELECT TO anon, authenticated
  USING (is_active AND is_public);

CREATE TABLE IF NOT EXISTS public.tax_landing_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text NOT NULL,
  quote text NOT NULL,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tax_landing_testimonials TO anon;
GRANT SELECT ON public.tax_landing_testimonials TO authenticated;
GRANT ALL ON public.tax_landing_testimonials TO service_role;
ALTER TABLE public.tax_landing_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Testimonios visibles para todos"
  ON public.tax_landing_testimonials FOR SELECT TO anon, authenticated
  USING (is_visible);

CREATE TRIGGER tax_landing_testimonials_updated_at
  BEFORE UPDATE ON public.tax_landing_testimonials
  FOR EACH ROW EXECUTE FUNCTION public.tax_touch_updated_at();

INSERT INTO public.tax_landing_testimonials (name, industry, quote, sort_order, is_visible, is_featured)
SELECT * FROM (VALUES
  ('Laura', 'Pastelería', 'Ahora sé cuánto IVA debo pagar y cuánto guardar. Ya no me sorprenden los impuestos.', 1, true, true),
  ('Carlos', 'Taller mecánico', 'Entiendo mis números sin tener que entrar al SII. Todo en un solo lugar.', 2, true, false),
  ('Andrea', 'Servicios profesionales', 'Veo mis ventas, compras y el IVA de un vistazo. Me da tranquilidad y tiempo para crecer.', 3, true, false)
) AS t(name, industry, quote, sort_order, is_visible, is_featured)
WHERE NOT EXISTS (SELECT 1 FROM public.tax_landing_testimonials);

CREATE TABLE IF NOT EXISTS public.tax_landing_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_landing_content_status_check CHECK (status IN ('draft','published','archived'))
);

CREATE INDEX IF NOT EXISTS tax_landing_content_status_idx ON public.tax_landing_content (status, version DESC);

GRANT SELECT ON public.tax_landing_content TO anon;
GRANT SELECT ON public.tax_landing_content TO authenticated;
GRANT ALL ON public.tax_landing_content TO service_role;
ALTER TABLE public.tax_landing_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contenido publicado visible para todos"
  ON public.tax_landing_content FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE TRIGGER tax_landing_content_updated_at
  BEFORE UPDATE ON public.tax_landing_content
  FOR EACH ROW EXECUTE FUNCTION public.tax_touch_updated_at();
