create type public.app_company_role as enum ('owner','business_user','accountant','viewer');
create type public.company_member_status as enum ('invited','active','suspended','removed');
create type public.sii_connection_status as enum ('disconnected','connecting','connected','stale','error');
create type public.tax_period_status as enum ('open','estimated','reviewed','closed');
create type public.tax_data_source as enum ('mock','manual','gateway','sii','accountant');
create type public.tax_confidence_level as enum ('high','medium','low','unknown');
create type public.tax_document_direction as enum ('sale','purchase');
create type public.tax_rcv_status as enum ('registered','pending','claimed','excluded','accepted','unknown');
create type public.tax_f29_status as enum ('not_available','draft','filed','rectified','observed');
create type public.tax_alert_type as enum ('reserve_insufficient','goal_at_risk','goal_achieved','pending_purchases','stale_data','high_tax_projection','positive_carryforward');
create type public.tax_alert_severity as enum ('info','success','warning','critical');
create type public.tax_sync_type as enum ('demo','manual','scheduled','login_refresh','gateway');
create type public.tax_sync_status as enum ('pending','running','success','partial','failed');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.normalize_rut(_rut text)
returns text language sql immutable set search_path = public as $$
  select upper(regexp_replace(coalesce(_rut,''), '[^0-9kK]', '', 'g'))
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  display_name text,
  phone text,
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create table public.tax_companies (
  id uuid primary key default gen_random_uuid(),
  rut text not null,
  business_name text not null,
  fantasy_name text,
  business_activity text,
  address text,
  commune text,
  region text,
  connection_status public.sii_connection_status not null default 'disconnected',
  last_sync_at timestamptz,
  active_period text,
  is_demo boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_companies_rut_normalized check (rut = public.normalize_rut(rut)),
  constraint tax_companies_unique_rut_per_creator unique (created_by, rut)
);
create trigger trg_tax_companies_updated before update on public.tax_companies for each row execute function public.set_updated_at();

create table public.tax_company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_company_role not null default 'viewer',
  status public.company_member_status not null default 'active',
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index idx_members_user on public.tax_company_members(user_id, status);
create trigger trg_members_updated before update on public.tax_company_members for each row execute function public.set_updated_at();

create or replace function public.is_active_company_member(_company_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tax_company_members m
    where m.company_id = _company_id and m.user_id = _user_id and m.status = 'active'
  )
$$;

create or replace function public.company_role_of(_company_id uuid, _user_id uuid)
returns public.app_company_role language sql stable security definer set search_path = public as $$
  select m.role from public.tax_company_members m
  where m.company_id = _company_id and m.user_id = _user_id and m.status = 'active'
$$;

create or replace function public.has_company_role(_company_id uuid, _user_id uuid, _roles public.app_company_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tax_company_members m
    where m.company_id = _company_id and m.user_id = _user_id
      and m.status = 'active' and m.role = any(_roles)
  )
$$;

grant select on public.tax_companies to authenticated;
grant all on public.tax_companies to service_role;
alter table public.tax_companies enable row level security;
create policy "companies_select_members" on public.tax_companies for select to authenticated
  using (public.is_active_company_member(id, auth.uid()));

grant select on public.tax_company_members to authenticated;
grant all on public.tax_company_members to service_role;
alter table public.tax_company_members enable row level security;
create policy "members_select_same_company" on public.tax_company_members for select to authenticated
  using (user_id = auth.uid() or public.is_active_company_member(company_id, auth.uid()));

create table public.tax_company_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.tax_companies(id) on delete cascade,
  monthly_sales_goal numeric(16,2),
  preventive_margin_percent numeric(5,2) not null default 10,
  reserved_amount numeric(16,2) not null default 0,
  estimated_ppm_rate numeric(6,4) not null default 0.006,
  currency text not null default 'CLP',
  timezone text not null default 'America/Santiago',
  alerts_enabled boolean not null default true,
  email_alerts_enabled boolean not null default false,
  weekly_summary_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.tax_company_settings to authenticated;
grant all on public.tax_company_settings to service_role;
alter table public.tax_company_settings enable row level security;
create policy "settings_select_members" on public.tax_company_settings for select to authenticated
  using (public.is_active_company_member(company_id, auth.uid()));
create trigger trg_settings_updated before update on public.tax_company_settings for each row execute function public.set_updated_at();

create table public.tax_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  period text not null,
  year int not null,
  month int not null check (month between 1 and 12),
  status public.tax_period_status not null default 'open',
  data_source public.tax_data_source not null default 'mock',
  confidence_level public.tax_confidence_level not null default 'unknown',
  last_calculated_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_periods_format check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  unique (company_id, period)
);
create index idx_periods_company on public.tax_periods(company_id, period desc);
grant select on public.tax_periods to authenticated;
grant all on public.tax_periods to service_role;
alter table public.tax_periods enable row level security;
create policy "periods_select_members" on public.tax_periods for select to authenticated
  using (public.is_active_company_member(company_id, auth.uid()));
create trigger trg_periods_updated before update on public.tax_periods for each row execute function public.set_updated_at();

create table public.tax_monthly_summaries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  tax_period_id uuid not null references public.tax_periods(id) on delete cascade,
  sales_total numeric(16,2) not null default 0,
  invoice_sales numeric(16,2) not null default 0,
  receipt_sales numeric(16,2) not null default 0,
  exempt_sales numeric(16,2) not null default 0,
  sales_credit_notes numeric(16,2) not null default 0,
  purchases_total numeric(16,2) not null default 0,
  net_purchases numeric(16,2) not null default 0,
  exempt_purchases numeric(16,2) not null default 0,
  vat_debit numeric(16,2) not null default 0,
  vat_credit numeric(16,2) not null default 0,
  previous_vat_carryforward numeric(16,2) not null default 0,
  estimated_vat_payable numeric(16,2) not null default 0,
  estimated_new_carryforward numeric(16,2) not null default 0,
  estimated_ppm numeric(16,2) not null default 0,
  estimated_withholdings numeric(16,2) not null default 0,
  estimated_tax_total numeric(16,2) not null default 0,
  preventive_margin_amount numeric(16,2) not null default 0,
  recommended_reserve numeric(16,2) not null default 0,
  reserved_amount_snapshot numeric(16,2) not null default 0,
  projected_sales numeric(16,2) not null default 0,
  source public.tax_data_source not null default 'mock',
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, tax_period_id)
);
grant select on public.tax_monthly_summaries to authenticated;
grant all on public.tax_monthly_summaries to service_role;
alter table public.tax_monthly_summaries enable row level security;
create policy "summaries_select_members" on public.tax_monthly_summaries for select to authenticated
  using (public.is_active_company_member(company_id, auth.uid()));
create trigger trg_summaries_updated before update on public.tax_monthly_summaries for each row execute function public.set_updated_at();

create table public.tax_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  tax_period_id uuid not null references public.tax_periods(id) on delete cascade,
  external_id text,
  document_direction public.tax_document_direction not null,
  document_type text not null,
  folio bigint not null,
  document_date date not null,
  counterparty_name text not null,
  counterparty_rut text,
  net_amount numeric(16,2) not null default 0,
  vat_amount numeric(16,2) not null default 0,
  exempt_amount numeric(16,2) not null default 0,
  total_amount numeric(16,2) not null default 0,
  rcv_status public.tax_rcv_status not null default 'unknown',
  source public.tax_data_source not null default 'mock',
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_documents_company_period_date on public.tax_documents(company_id, tax_period_id, document_date desc);
create unique index uq_documents_dedup on public.tax_documents(company_id, document_direction, document_type, folio, counterparty_rut);
grant select on public.tax_documents to authenticated;
grant all on public.tax_documents to service_role;
alter table public.tax_documents enable row level security;
create policy "documents_select_members" on public.tax_documents for select to authenticated
  using (public.is_active_company_member(company_id, auth.uid()));
create trigger trg_documents_updated before update on public.tax_documents for each row execute function public.set_updated_at();

create table public.tax_f29_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  tax_period_id uuid not null references public.tax_periods(id) on delete cascade,
  declaration_status public.tax_f29_status not null default 'not_available',
  declared_vat numeric(16,2),
  declared_ppm numeric(16,2),
  declared_withholdings numeric(16,2),
  declared_total numeric(16,2),
  vat_carryforward numeric(16,2),
  filed_at timestamptz,
  source public.tax_data_source not null default 'mock',
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, tax_period_id)
);
grant select on public.tax_f29_history to authenticated;
grant all on public.tax_f29_history to service_role;
alter table public.tax_f29_history enable row level security;
create policy "f29_select_members" on public.tax_f29_history for select to authenticated
  using (public.is_active_company_member(company_id, auth.uid()));
create trigger trg_f29_updated before update on public.tax_f29_history for each row execute function public.set_updated_at();

create table public.tax_sales_goals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  tax_period_id uuid not null references public.tax_periods(id) on delete cascade,
  goal_amount numeric(16,2) not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, tax_period_id)
);
grant select on public.tax_sales_goals to authenticated;
grant all on public.tax_sales_goals to service_role;
alter table public.tax_sales_goals enable row level security;
create policy "goals_select_members" on public.tax_sales_goals for select to authenticated
  using (public.is_active_company_member(company_id, auth.uid()));
create trigger trg_goals_updated before update on public.tax_sales_goals for each row execute function public.set_updated_at();

create table public.tax_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  tax_period_id uuid references public.tax_periods(id) on delete cascade,
  alert_type public.tax_alert_type not null,
  severity public.tax_alert_severity not null default 'info',
  title text not null,
  message text not null,
  is_read boolean not null default false,
  generated_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_alerts_company on public.tax_alerts(company_id, is_read, generated_at desc);
grant select, update on public.tax_alerts to authenticated;
grant all on public.tax_alerts to service_role;
alter table public.tax_alerts enable row level security;
create policy "alerts_select_members" on public.tax_alerts for select to authenticated
  using (public.is_active_company_member(company_id, auth.uid()));
create policy "alerts_mark_read" on public.tax_alerts for update to authenticated
  using (public.is_active_company_member(company_id, auth.uid()))
  with check (public.is_active_company_member(company_id, auth.uid()));

create table public.tax_sync_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  tax_period_id uuid references public.tax_periods(id) on delete set null,
  sync_type public.tax_sync_type not null default 'demo',
  status public.tax_sync_status not null default 'pending',
  source public.tax_data_source not null default 'mock',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  records_received int not null default 0,
  records_created int not null default 0,
  records_updated int not null default 0,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);
create index idx_sync_company on public.tax_sync_runs(company_id, started_at desc);
grant select on public.tax_sync_runs to authenticated;
grant all on public.tax_sync_runs to service_role;
alter table public.tax_sync_runs enable row level security;
create policy "sync_select_members" on public.tax_sync_runs for select to authenticated
  using (public.is_active_company_member(company_id, auth.uid()));

create table public.tax_activity_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.tax_companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_activity_company on public.tax_activity_logs(company_id, created_at desc);
grant select on public.tax_activity_logs to authenticated;
grant all on public.tax_activity_logs to service_role;
alter table public.tax_activity_logs enable row level security;
create policy "activity_select_members" on public.tax_activity_logs for select to authenticated
  using (company_id is not null and public.is_active_company_member(company_id, auth.uid()));