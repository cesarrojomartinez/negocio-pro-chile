insert into public.tax_pilot_companies (alias, company_id, notes)
values
  ('pilot_wood_company', 'bdc659fe-ef6e-4e14-82a5-33c8e32c86ba', 'Piloto Fase 6'),
  ('pilot_bakery_company', 'c8052d8f-8d86-48bb-a8d8-03e0f09116d3', 'Piloto Fase 6')
on conflict (alias) do update set company_id = excluded.company_id, updated_at = now();

create table if not exists public.tax_optional_tax_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  concept text not null,
  value numeric,
  value_text text,
  unit text not null default 'none',
  valid_from date not null,
  valid_to date,
  source text not null default 'client_declared',
  confirmed_by uuid,
  confirmed_at timestamptz,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_optional_tax_settings_status_check
    check (status in ('active','expired','superseded','pending_confirmation','revoked')),
  constraint tax_optional_tax_settings_concept_check
    check (concept in ('ppm_rate','sales_type','common_use_vat','withholdings_estimate','vat_advance_regime','vat_postponement','confirmed_carryforward')),
  constraint tax_optional_tax_settings_range_check
    check (valid_to is null or valid_to >= valid_from)
);

create index if not exists tax_optional_tax_settings_lookup
  on public.tax_optional_tax_settings (company_id, concept, valid_from desc);

grant select, insert, update on public.tax_optional_tax_settings to authenticated;
grant all on public.tax_optional_tax_settings to service_role;

alter table public.tax_optional_tax_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='tax_optional_tax_settings' and policyname='optional_settings_select_members') then
    create policy optional_settings_select_members on public.tax_optional_tax_settings
      for select to authenticated
      using (private.is_active_company_member(company_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='tax_optional_tax_settings' and policyname='optional_settings_insert_authorized') then
    create policy optional_settings_insert_authorized on public.tax_optional_tax_settings
      for insert to authenticated
      with check (private.has_company_role(company_id, auth.uid(), array['owner','accountant']::app_company_role[]));
  end if;
  if not exists (select 1 from pg_policies where tablename='tax_optional_tax_settings' and policyname='optional_settings_update_authorized') then
    create policy optional_settings_update_authorized on public.tax_optional_tax_settings
      for update to authenticated
      using (private.has_company_role(company_id, auth.uid(), array['owner','accountant']::app_company_role[]))
      with check (private.has_company_role(company_id, auth.uid(), array['owner','accountant']::app_company_role[]));
  end if;
end $$;

drop trigger if exists tax_optional_tax_settings_touch on public.tax_optional_tax_settings;
create trigger tax_optional_tax_settings_touch
  before update on public.tax_optional_tax_settings
  for each row execute function public.set_updated_at();