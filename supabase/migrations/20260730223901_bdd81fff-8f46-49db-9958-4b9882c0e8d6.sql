
ALTER TYPE public.sii_snapshot_module ADD VALUE IF NOT EXISTS 'f29_compact_pdf';
ALTER TYPE public.tax_data_source ADD VALUE IF NOT EXISTS 'f29_pdf_extracted';

CREATE TABLE IF NOT EXISTS public.tax_f29_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  tax_period_id uuid REFERENCES public.tax_periods(id) ON DELETE SET NULL,
  period text NOT NULL,
  folio text NOT NULL,
  declaration_date date,
  declaration_status text,
  is_rectification boolean NOT NULL DEFAULT false,
  supersedes_folio text,
  superseded boolean NOT NULL DEFAULT false,
  pdf_storage_path text,
  pdf_sha256 text,
  pdf_page_count integer,
  parser_version text NOT NULL,
  extraction_status text NOT NULL DEFAULT 'pending',
  confidence_level text NOT NULL DEFAULT 'unknown',
  code_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'f29_pdf_extracted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_f29_extractions_company_folio_key UNIQUE (company_id, folio),
  CONSTRAINT tax_f29_extractions_status_check CHECK (
    extraction_status IN ('pending','success','partial','failed','needs_review','ambiguous_declaration')
  ),
  CONSTRAINT tax_f29_extractions_confidence_check CHECK (
    confidence_level IN ('high','medium','low','unknown')
  ),
  CONSTRAINT tax_f29_extractions_period_check CHECK (period ~ '^[0-9]{4}-[0-9]{2}$')
);

CREATE INDEX IF NOT EXISTS tax_f29_extractions_company_period_idx
  ON public.tax_f29_extractions (company_id, period);
CREATE INDEX IF NOT EXISTS tax_f29_extractions_sha_idx
  ON public.tax_f29_extractions (company_id, pdf_sha256);

GRANT SELECT ON public.tax_f29_extractions TO authenticated;
GRANT ALL ON public.tax_f29_extractions TO service_role;

ALTER TABLE public.tax_f29_extractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS f29_extractions_select_members ON public.tax_f29_extractions;
CREATE POLICY f29_extractions_select_members
  ON public.tax_f29_extractions FOR SELECT TO authenticated
  USING (private.is_active_company_member(company_id, auth.uid()));

DROP TRIGGER IF EXISTS set_updated_at_tax_f29_extractions ON public.tax_f29_extractions;
CREATE TRIGGER set_updated_at_tax_f29_extractions
  BEFORE UPDATE ON public.tax_f29_extractions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "f29 pdfs readable by owner and accountant" ON storage.objects;
CREATE POLICY "f29 pdfs readable by owner and accountant"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tax-f29-pdfs'
    AND private.has_company_role(
      NULLIF((storage.foldername(name))[1], '')::uuid,
      auth.uid(),
      ARRAY['owner'::app_company_role, 'accountant'::app_company_role]
    )
  );
