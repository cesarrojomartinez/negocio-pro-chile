delete from public.tax_companies c
where not exists (select 1 from public.tax_company_members m where m.company_id = c.id);