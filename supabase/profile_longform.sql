-- Add longform profile fields used by the onboarding and settings panel.
-- Run via: node supabase/scripts/run-migration.mjs supabase/profile_longform.sql

alter table public.profiles
  add column if not exists persona  text not null default '',
  add column if not exists mission  text not null default '',
  add column if not exists services text not null default '';
