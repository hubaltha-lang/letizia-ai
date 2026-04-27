-- Add columns to scrape_searches for background execution
alter table public.scrape_searches
  add column if not exists enrichment_level text default 'none' check (enrichment_level in ('none', 'basic', 'advanced')),
  add column if not exists enrichment_log text default '',
  add column if not exists enrichment_progress jsonb default '{"phase": "", "current": 0, "total": 0}'::jsonb,
  add column if not exists apollo_credits_used integer default 0;
