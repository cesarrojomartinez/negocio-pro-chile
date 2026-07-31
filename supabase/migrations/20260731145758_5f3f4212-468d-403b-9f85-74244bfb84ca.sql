-- Motor Espejo SII — persistencia en modo sombra (Etapa 6.6)

create table if not exists public.tax_normalized_facts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  tax_period_id uuid references public.tax_periods(id) on delete cascade,
  period text not null,
  ledger text not null,
  scope text not null,
  document_type_code integer,
  document_count integer,
  net_amount numeric,
  vat_amount numeric,
  exempt_amount numeric,
  vat_common_use numeric,
  vat_non_recoverable numeric,
  total_amount numeric,
  tax_effect integer,
  source text not null,
  source_reference text,
  raw_hash text not null,
  normalization_version text not null,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists tax_normalized_facts_unique
  on public.tax_normalized_facts (company_id, period, ledger, scope, coalesce(document_type_code, -1), raw_hash);
create index if not exists tax_normalized_facts_period on public.tax_normalized_facts (company_id, period);

create table if not exists public.tax_mirror_calculation_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  tax_period_id uuid references public.tax_periods(id) on delete cascade,
  period text not null,
  engine_version text not null,
  rules_version text not null,
  normalization_version text not null,
  mode text not null default 'shadow_only',
  completeness text not null,
  missing_inputs text[] not null default '{}',
  total_before_surcharges numeric,
  official_declared_total numeric,
  confirmed_paid_total numeric,
  input_hash text not null,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint tax_mirror_runs_mode_shadow check (mode in ('shadow_only'))
);
create index if not exists tax_mirror_runs_period on public.tax_mirror_calculation_runs (company_id, period, calculated_at desc);

create table if not exists public.tax_component_calculations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.tax_mirror_calculation_runs(id) on delete cascade,
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  period text not null,
  concept text not null,
  amount numeric,
  status text not null,
  rule_id text not null,
  rule_version text not null,
  sources text[] not null default '{}',
  input_values jsonb not null default '{}'::jsonb,
  missing_inputs text[] not null default '{}',
  warnings text[] not null default '{}',
  confidence text not null,
  calculation_description text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists tax_component_calculations_unique on public.tax_component_calculations (run_id, concept);

create table if not exists public.tax_engine_comparisons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  tax_period_id uuid references public.tax_periods(id) on delete cascade,
  period text not null,
  run_id uuid references public.tax_mirror_calculation_runs(id) on delete set null,
  current_engine_total numeric,
  mirror_engine_total numeric,
  official_total numeric,
  current_vs_official_difference numeric,
  mirror_vs_official_difference numeric,
  comparison_status text not null,
  component_differences jsonb not null default '[]'::jsonb,
  explained_difference numeric,
  unexplained_difference numeric,
  created_at timestamptz not null default now()
);
create unique index if not exists tax_engine_comparisons_unique on public.tax_engine_comparisons (company_id, period, run_id);

grant select on public.tax_normalized_facts to authenticated;
grant select on public.tax_mirror_calculation_runs to authenticated;
grant select on public.tax_component_calculations to authenticated;
grant select on public.tax_engine_comparisons to authenticated;
grant all on public.tax_normalized_facts to service_role;
grant all on public.tax_mirror_calculation_runs to service_role;
grant all on public.tax_component_calculations to service_role;
grant all on public.tax_engine_comparisons to service_role;

alter table public.tax_normalized_facts enable row level security;
alter table public.tax_mirror_calculation_runs enable row level security;
alter table public.tax_component_calculations enable row level security;
alter table public.tax_engine_comparisons enable row level security;

create policy "facts_select_members"
  on public.tax_normalized_facts for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()));

create policy "mirror_runs_select_members"
  on public.tax_mirror_calculation_runs for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()));

create policy "mirror_components_select_members"
  on public.tax_component_calculations for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()));

create policy "mirror_comparisons_select_members"
  on public.tax_engine_comparisons for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()));