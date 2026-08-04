CREATE OR REPLACE FUNCTION public.enforce_last_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid := COALESCE(OLD.company_id, NEW.company_id);
  v_remaining int;
BEGIN
  -- Si la empresa ya no existe (borrado en cascada), no aplicar la regla
  IF NOT EXISTS (SELECT 1 FROM public.tax_companies WHERE id = v_company) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.role = 'owner' AND OLD.status = 'active'
     AND (NEW.role IS DISTINCT FROM 'owner' OR NEW.status IS DISTINCT FROM 'active') THEN
    NULL;
  ELSIF TG_OP = 'DELETE' AND OLD.role = 'owner' AND OLD.status = 'active' THEN
    NULL;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

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
$function$;

DELETE FROM public.tax_companies
WHERE id NOT IN (
  SELECT company_id FROM public.tax_company_members
  WHERE user_id IN ('25d123da-07fa-4e9c-a878-cf2ee2e46289','b0fc5eb3-c415-492c-95c5-61d7f5de03f0')
);