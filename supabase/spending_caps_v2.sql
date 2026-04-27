-- v2 spending cap helpers: per-user daily spend + most-recent activity
-- Run via: node supabase/scripts/run-migration.mjs supabase/spending_caps_v2.sql

-- Per-user spend today (UTC day) — drives the Haiku-fallback and 4hr pause tiers.
create or replace function public.get_user_today_spend(uid uuid)
returns numeric language sql stable as $$
  select coalesce(sum(cost_usd), 0)
  from public.api_usage
  where user_id = uid
    and created_at >= date_trunc('day', now() at time zone 'UTC');
$$;

-- Timestamp of the user's last request (for the rolling 4-hour pause window).
create or replace function public.get_user_last_request(uid uuid)
returns timestamptz language sql stable as $$
  select max(created_at)
  from public.api_usage
  where user_id = uid;
$$;
