-- Run this in your Supabase SQL editor to add hotel scraper tables

-- Scrape searches (history)
create table if not exists public.scrape_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country text not null,
  region text,
  city text,
  destination text not null,
  stars_filter text not null default '5',
  property_type text default 'none',
  sort_by text default 'bayesian_review_score',
  currency text default 'EUR',
  max_items integer default 100,
  result_count integer not null default 0,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  apify_run_id text,
  apify_dataset_id text,
  created_at timestamptz not null default now()
);

-- Scrape results (individual hotels)
create table if not exists public.scrape_results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.scrape_searches(id) on delete cascade,
  hotel_name text not null,
  hotel_chain text,
  stars integer,
  rating numeric(3,1),
  rating_label text,
  reviews integer,
  full_address text,
  city text,
  country text,
  latitude text,
  longitude text,
  url text,
  property_type text,
  has_spa boolean default false,
  facilities text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists scrape_searches_user_id_idx on public.scrape_searches(user_id);
create index if not exists scrape_searches_created_at_idx on public.scrape_searches(created_at desc);
create index if not exists scrape_results_search_id_idx on public.scrape_results(search_id);

-- Row Level Security
alter table public.scrape_searches enable row level security;
alter table public.scrape_results enable row level security;

create policy "scrape_searches_own" on public.scrape_searches
  for all using (auth.uid() = user_id);

create policy "scrape_results_own" on public.scrape_results
  for all using (
    exists (
      select 1 from public.scrape_searches
      where id = scrape_results.search_id and user_id = auth.uid()
    )
  );
