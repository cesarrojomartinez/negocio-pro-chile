revoke all on all tables in schema public from anon, authenticated;

grant select on public.tax_companies, public.tax_company_members,
  public.tax_company_settings, public.tax_periods, public.tax_monthly_summaries,
  public.tax_documents, public.tax_f29_history, public.tax_sales_goals,
  public.tax_alerts, public.tax_sync_runs, public.tax_activity_logs
  to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant update on public.tax_alerts to authenticated;

grant all on all tables in schema public to service_role;