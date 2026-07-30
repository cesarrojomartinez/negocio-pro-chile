DROP TRIGGER IF EXISTS trg_enforce_last_owner ON public.tax_company_members;
CREATE TRIGGER trg_enforce_last_owner
BEFORE UPDATE OR DELETE ON public.tax_company_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_last_owner();