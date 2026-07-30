DROP INDEX IF EXISTS public.uq_documents_external;

CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_external
  ON public.tax_documents (company_id, source, external_id);