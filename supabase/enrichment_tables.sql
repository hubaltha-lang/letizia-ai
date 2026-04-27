-- Add enrichment columns to scrape_results table
alter table public.scrape_results
  add column if not exists company_name text,
  add column if not exists linkedin_company_url text,
  add column if not exists generic_email text,
  add column if not exists enrichment_status text default 'none' check (enrichment_status in ('none', 'basic', 'advanced'));

-- Decision makers table
create table if not exists public.decision_makers (
  id uuid primary key default gen_random_uuid(),
  scrape_result_id uuid not null references public.scrape_results(id) on delete cascade,
  apollo_id text,
  first_name text,
  last_name text,
  full_name text,
  title text,
  email text,
  linkedin_url text,
  photo_url text,
  city text,
  country text,
  reason text,
  enriched boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists decision_makers_result_id_idx on public.decision_makers(scrape_result_id);

alter table public.decision_makers enable row level security;

create policy "decision_makers_own" on public.decision_makers
  for all using (
    exists (
      select 1 from public.scrape_results sr
      join public.scrape_searches ss on ss.id = sr.search_id
      where sr.id = decision_makers.scrape_result_id and ss.user_id = auth.uid()
    )
  );
