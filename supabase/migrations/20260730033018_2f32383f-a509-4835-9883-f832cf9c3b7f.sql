create schema if not exists private;
revoke all on schema private from anon, authenticated;

create or replace function private.is_active_company_member(_company_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tax_company_members m
    where m.company_id = _company_id and m.user_id = _user_id and m.status = 'active'
  )
$$;

create or replace function private.company_role_of(_company_id uuid, _user_id uuid)
returns public.app_company_role language sql stable security definer set search_path = public as $$
  select m.role from public.tax_company_members m
  where m.company_id = _company_id and m.user_id = _user_id and m.status = 'active'
$$;

create or replace function private.has_company_role(_company_id uuid, _user_id uuid, _roles public.app_company_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tax_company_members m
    where m.company_id = _company_id and m.user_id = _user_id
      and m.status = 'active' and m.role = any(_roles)
  )
$$;

drop policy "companies_select_members" on public.tax_companies;
drop policy "members_select_same_company" on public.tax_company_members;
drop policy "settings_select_members" on public.tax_company_settings;
drop policy "periods_select_members" on public.tax_periods;
drop policy "summaries_select_members" on public.tax_monthly_summaries;
drop policy "documents_select_members" on public.tax_documents;
drop policy "f29_select_members" on public.tax_f29_history;
drop policy "goals_select_members" on public.tax_sales_goals;
drop policy "alerts_select_members" on public.tax_alerts;
drop policy "alerts_mark_read" on public.tax_alerts;
drop policy "sync_select_members" on public.tax_sync_runs;
drop policy "activity_select_members" on public.tax_activity_logs;

drop function public.is_active_company_member(uuid, uuid);
drop function public.company_role_of(uuid, uuid);
drop function public.has_company_role(uuid, uuid, public.app_company_role[]);

create policy "companies_select_members" on public.tax_companies for select to authenticated
  using (private.is_active_company_member(id, auth.uid()));
create policy "members_select_same_company" on public.tax_company_members for select to authenticated
  using (user_id = auth.uid() or private.is_active_company_member(company_id, auth.uid()));
create policy "settings_select_members" on public.tax_company_settings for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()));
create policy "periods_select_members" on public.tax_periods for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()));
create policy "summaries_select_members" on public.tax_monthly_summaries for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()));
create policy "documents_select_members" on public.tax_documents for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()));
create policy "f29_select_members" on public.tax_f29_history for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()));
create policy "goals_select_members" on public.tax_sales_goals for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()));
create policy "alerts_select_members" on public.tax_alerts for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()));
create policy "alerts_mark_read" on public.tax_alerts for update to authenticated
  using (private.is_active_company_member(company_id, auth.uid()))
  with check (private.is_active_company_member(company_id, auth.uid()));
create policy "sync_select_members" on public.tax_sync_runs for select to authenticated
  using (private.is_active_company_member(company_id, auth.uid()));
create policy "activity_select_members" on public.tax_activity_logs for select to authenticated
  using (company_id is not null and private.is_active_company_member(company_id, auth.uid()));