DROP INDEX IF EXISTS public.tax_sync_plan_amendments_unico;

CREATE UNIQUE INDEX IF NOT EXISTS tax_sync_plan_amendments_aprobada_unica
  ON public.tax_sync_plan_amendments (plan_id, period, new_folio)
  WHERE status = 'approved';

DROP POLICY IF EXISTS "Miembros activos ven las ampliaciones de su empresa" ON public.tax_sync_plan_amendments;

CREATE POLICY "Dueno y contador ven las ampliaciones de su empresa"
ON public.tax_sync_plan_amendments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tax_company_members m
    WHERE m.company_id = tax_sync_plan_amendments.company_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('owner', 'accountant')
  )
);