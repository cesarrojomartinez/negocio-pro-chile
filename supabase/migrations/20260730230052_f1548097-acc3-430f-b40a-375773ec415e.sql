CREATE TABLE IF NOT EXISTS public.tax_document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.tax_companies(id) ON DELETE CASCADE,
  tax_document_id uuid REFERENCES public.tax_documents(id) ON DELETE SET NULL,
  period text NOT NULL,
  direction public.tax_document_direction NOT NULL,
  dte_code integer NOT NULL,
  folio bigint NOT NULL,
  counterparty_rut text NOT NULL DEFAULT '',
  file_kind text NOT NULL,
  storage_path text,
  sha256 text,
  byte_size integer,
  content_type text,
  source_endpoint text NOT NULL,
  credits_used numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'stored',
  error_code text,
  xml_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  requested_by uuid,
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_document_files_kind_check CHECK (file_kind IN ('pdf','xml')),
  CONSTRAINT tax_document_files_status_check CHECK (status IN ('stored','failed','unavailable')),
  CONSTRAINT tax_document_files_period_check CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT tax_document_files_unique UNIQUE (company_id, direction, dte_code, folio, counterparty_rut, file_kind)
);

CREATE INDEX IF NOT EXISTS tax_document_files_company_period_idx
  ON public.tax_document_files (company_id, period);
CREATE INDEX IF NOT EXISTS tax_document_files_document_idx
  ON public.tax_document_files (tax_document_id);

GRANT SELECT ON public.tax_document_files TO authenticated;
GRANT ALL ON public.tax_document_files TO service_role;

ALTER TABLE public.tax_document_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_files_select_members ON public.tax_document_files;
CREATE POLICY document_files_select_members
  ON public.tax_document_files FOR SELECT TO authenticated
  USING (private.is_active_company_member(company_id, auth.uid()));

DROP TRIGGER IF EXISTS set_updated_at_tax_document_files ON public.tax_document_files;
CREATE TRIGGER set_updated_at_tax_document_files
  BEFORE UPDATE ON public.tax_document_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "dte files readable by owner and accountant" ON storage.objects;
CREATE POLICY "dte files readable by owner and accountant"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tax-dte-files'
    AND private.has_company_role(
      NULLIF((storage.foldername(name))[1], '')::uuid,
      auth.uid(),
      ARRAY['owner'::app_company_role, 'accountant'::app_company_role]
    )
  );