-- Plan fields on profiles
alter table public.profiles
  add column if not exists plan_type text not null default 'none'
    check (plan_type in ('none', 'trial', 'paid_monthly', 'paid_6month')),
  add column if not exists trial_start_at  timestamptz,
  add column if not exists trial_end_at    timestamptz,
  add column if not exists plan_start_at   timestamptz,
  add column if not exists plan_end_at     timestamptz;

-- Invites table
create table if not exists public.invites (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null unique,
  invited_at  timestamptz not null default now(),
  token       text        not null unique default gen_random_uuid()::text,
  accepted_at timestamptz,
  user_id     uuid        references auth.users(id) on delete set null
);

alter table public.invites enable row level security;

-- Only service-role / admin can touch invites (no anon/user access)
create policy "invites_service_only" on public.invites
  for all using (false);
