alter table public.tax_companies alter column created_by drop not null;
alter table public.tax_companies drop constraint tax_companies_created_by_fkey;
alter table public.tax_companies
  add constraint tax_companies_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;