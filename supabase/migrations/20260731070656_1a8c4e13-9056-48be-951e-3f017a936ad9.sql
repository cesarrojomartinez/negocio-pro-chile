create table public.tax_period_ppm_overrides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  tax_period_id uuid not null references public.tax_periods(id) on delete cascade,
  ppm_rate numeric(6,4) not null check (ppm_rate > 0 and ppm_rate <= 1),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, tax_period_id)
);

grant select on public.tax_period_ppm_overrides to authenticated;
grant all on public.tax_period_ppm_overrides to service_role;

alter table public.tax_period_ppm_overrides enable row level security;

create policy "ppm_override_select_members" on public.tax_period_ppm_overrides
  for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()));

create trigger update_tax_period_ppm_overrides_updated_at
  before update on public.tax_period_ppm_overrides
  for each row execute function public.set_updated_at();