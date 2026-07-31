create table if not exists public.tax_real_gateway_allowlist (
  company_id uuid primary key references public.tax_companies(id) on delete cascade,
  enabled boolean not null default true,
  authorized_by uuid references auth.users(id) on delete set null,
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.tax_real_gateway_allowlist to authenticated;
grant all on public.tax_real_gateway_allowlist to service_role;

alter table public.tax_real_gateway_allowlist enable row level security;

create policy "real_gateway_allowlist_select_members"
  on public.tax_real_gateway_allowlist for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()));

create trigger set_updated_at_tax_real_gateway_allowlist
  before update on public.tax_real_gateway_allowlist
  for each row execute function public.set_updated_at();