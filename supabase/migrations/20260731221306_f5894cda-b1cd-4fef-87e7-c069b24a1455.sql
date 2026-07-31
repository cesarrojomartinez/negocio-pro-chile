-- ============ Roles de plataforma ============
do $$ begin create type public.app_role as enum ('admin','support','user'); exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "user_roles_select_own" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or private.has_role(auth.uid(),'admin'));

-- ============ Planes ============
create table if not exists public.tax_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  max_companies int not null default 1,
  max_users int not null default 2,
  monthly_updates_included int not null default 4,
  initial_history_periods int not null default 3,
  accountant_access boolean not null default false,
  support_level text not null default 'email',
  gateway_budget_units numeric(12,2) not null default 40,
  price_clp numeric(12,2),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.tax_plans to authenticated;
grant select on public.tax_plans to anon;
grant all on public.tax_plans to service_role;
alter table public.tax_plans enable row level security;
create policy "plans_select_active" on public.tax_plans for select using (is_active);
create trigger trg_plans_updated before update on public.tax_plans for each row execute function public.set_updated_at();

insert into public.tax_plans (code,name,description,max_companies,max_users,monthly_updates_included,initial_history_periods,accountant_access,support_level,gateway_budget_units,price_clp,sort_order)
values
 ('prueba','Prueba','Explora la aplicación con datos de demostración y actualizaciones limitadas.',1,2,2,3,false,'ayuda en línea',10,null,1),
 ('basico','Básico','Para un negocio con un solo RUT y actualizaciones mensuales suficientes.',1,3,6,6,false,'correo',40,null,2),
 ('profesional','Profesional','Para negocios con contador y más movimiento mensual.',3,8,20,12,true,'correo prioritario',150,null,3)
on conflict (code) do nothing;

-- ============ Estado de cuenta y suscripciones ============
do $$ begin create type public.account_status as enum ('trial','active','payment_pending','suspended','cancelled'); exception when duplicate_object then null; end $$;

create table if not exists public.tax_company_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.tax_companies(id) on delete cascade,
  plan_id uuid not null references public.tax_plans(id) on delete restrict,
  status public.account_status not null default 'trial',
  started_at timestamptz not null default now(),
  trial_ends_at timestamptz,
  current_period_start timestamptz not null default now(),
  next_renewal_at timestamptz,
  payment_method_label text,
  payment_provider text,
  external_reference text,
  cancelled_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  usage_month text,
  updates_used int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.tax_company_subscriptions to authenticated;
grant all on public.tax_company_subscriptions to service_role;
alter table public.tax_company_subscriptions enable row level security;
create policy "subs_select_members" on public.tax_company_subscriptions for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()) or private.has_role(auth.uid(),'admin'));
create trigger trg_subs_updated before update on public.tax_company_subscriptions for each row execute function public.set_updated_at();

create table if not exists public.tax_billing_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  subscription_id uuid references public.tax_company_subscriptions(id) on delete set null,
  event_type text not null,
  amount_clp numeric(12,2),
  currency text not null default 'CLP',
  status text not null default 'registrado',
  occurred_at timestamptz not null default now(),
  reference text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_billing_company on public.tax_billing_events(company_id, occurred_at desc);
grant select on public.tax_billing_events to authenticated;
grant all on public.tax_billing_events to service_role;
alter table public.tax_billing_events enable row level security;
create policy "billing_select_members" on public.tax_billing_events for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()) or private.has_role(auth.uid(),'admin'));

-- ============ Control de costos ============
create table if not exists public.tax_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  usage_month text not null,
  category text not null,
  period text,
  requests int not null default 0,
  cache_hits int not null default 0,
  errors int not null default 0,
  new_pdfs int not null default 0,
  cost_units numeric(12,2) not null default 0,
  sync_run_id uuid,
  outside_economic_flow boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_usage_company_month on public.tax_usage_ledger(company_id, usage_month);
grant select on public.tax_usage_ledger to authenticated;
grant all on public.tax_usage_ledger to service_role;
alter table public.tax_usage_ledger enable row level security;
create policy "usage_select_members" on public.tax_usage_ledger for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()) or private.has_role(auth.uid(),'admin'));

create table if not exists public.tax_admin_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.tax_companies(id) on delete cascade,
  kind text not null,
  severity text not null default 'warning',
  message text not null,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_alerts_created on public.tax_admin_alerts(created_at desc);
grant select on public.tax_admin_alerts to authenticated;
grant all on public.tax_admin_alerts to service_role;
alter table public.tax_admin_alerts enable row level security;
create policy "admin_alerts_select_admin" on public.tax_admin_alerts for select to authenticated
  using (private.has_role(auth.uid(),'admin'));

-- ============ Invitaciones ============
create table if not exists public.tax_company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  email text not null,
  role public.app_company_role not null default 'viewer',
  token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_invitations_company on public.tax_company_invitations(company_id, status);
grant select on public.tax_company_invitations to authenticated;
grant all on public.tax_company_invitations to service_role;
alter table public.tax_company_invitations enable row level security;
create policy "invitations_select_owner" on public.tax_company_invitations for select to authenticated
  using (private.has_company_role(company_id, auth.uid(), array['owner','business_user']::public.app_company_role[]) or private.has_role(auth.uid(),'admin'));
create trigger trg_invitations_updated before update on public.tax_company_invitations for each row execute function public.set_updated_at();

-- ============ Soporte ============
create table if not exists public.tax_support_tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.tax_companies(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  period text,
  message text not null,
  sanitized_code text,
  sync_run_id uuid,
  attachment_path text,
  status text not null default 'abierto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tickets_user on public.tax_support_tickets(user_id, created_at desc);
grant select on public.tax_support_tickets to authenticated;
grant all on public.tax_support_tickets to service_role;
alter table public.tax_support_tickets enable row level security;
create policy "tickets_select_own" on public.tax_support_tickets for select to authenticated
  using (user_id = auth.uid() or private.has_role(auth.uid(),'admin'));
create trigger trg_tickets_updated before update on public.tax_support_tickets for each row execute function public.set_updated_at();

-- ============ Exportación y eliminación ============
create table if not exists public.tax_data_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.tax_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  status text not null default 'solicitada',
  reason text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.tax_data_requests to authenticated;
grant all on public.tax_data_requests to service_role;
alter table public.tax_data_requests enable row level security;
create policy "data_requests_select_members" on public.tax_data_requests for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()) or private.has_role(auth.uid(),'admin'));
create trigger trg_data_requests_updated before update on public.tax_data_requests for each row execute function public.set_updated_at();

-- Suscripción de prueba para empresas existentes
insert into public.tax_company_subscriptions (company_id, plan_id, status, trial_ends_at, next_renewal_at, usage_month)
select c.id, p.id, 'trial', now() + interval '30 days', now() + interval '30 days', to_char(now() at time zone 'America/Santiago','YYYY-MM')
from public.tax_companies c cross join public.tax_plans p
where p.code = 'prueba'
on conflict (company_id) do nothing;