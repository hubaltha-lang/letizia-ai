-- API usage tracking + daily spending cap
-- Run via: node supabase/scripts/run-migration.mjs supabase/api_usage.sql

create table if not exists public.api_usage (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  module_id text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists api_usage_created_at_idx
  on public.api_usage(created_at desc);

create index if not exists api_usage_user_id_idx
  on public.api_usage(user_id, created_at desc);

alter table public.api_usage enable row level security;

-- Users can read their own usage; service role bypasses RLS for inserts.
create policy "api_usage_own_read" on public.api_usage
  for select using (auth.uid() = user_id);

-- Sum today's spend across all users (for daily cap check)
create or replace function public.get_today_spend()
returns numeric language sql stable as $$
  select coalesce(sum(cost_usd), 0)
  from public.api_usage
  where created_at >= date_trunc('day', now() at time zone 'UTC');
$$;

-- Count requests by a user in the last hour (for per-user rate limit)
create or replace function public.get_user_hourly_requests(uid uuid)
returns int language sql stable as $$
  select count(*)::int
  from public.api_usage
  where user_id = uid
    and created_at >= now() - interval '1 hour';
$$;
