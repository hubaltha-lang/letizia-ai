-- Add structured "About You" fields to profiles.
-- Run via: node supabase/scripts/run-migration.mjs supabase/profile_basics.sql

alter table public.profiles
  add column if not exists full_name text not null default '',
  add column if not exists age int,
  add column if not exists location text not null default '',
  add column if not exists modalities text not null default '',
  add column if not exists practice_status text not null default '';
