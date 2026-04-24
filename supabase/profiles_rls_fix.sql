-- Make the profiles RLS policy explicit with both USING and WITH CHECK.
-- Some Supabase/Postgres setups don't reliably fall back to USING for WITH CHECK
-- on UPDATE, which can cause silent no-op updates.
-- Run via: node supabase/scripts/run-migration.mjs supabase/profiles_rls_fix.sql

drop policy if exists "profiles_own" on public.profiles;

-- Split into explicit policies per operation with an explicit WITH CHECK.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);
