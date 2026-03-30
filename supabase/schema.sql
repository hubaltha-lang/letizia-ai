-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New Query)

-- Profiles table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- Chat sessions
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Indexes for fast queries
create index if not exists chat_sessions_user_id_idx on public.chat_sessions(user_id);
create index if not exists chat_sessions_updated_at_idx on public.chat_sessions(updated_at desc);
create index if not exists messages_session_id_idx on public.messages(session_id);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.messages enable row level security;

-- Profiles: users can only read/write their own profile
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id);

-- Chat sessions: users can only access their own
create policy "sessions_own" on public.chat_sessions
  for all using (auth.uid() = user_id);

-- Messages: users can access messages in their own sessions
create policy "messages_own" on public.messages
  for all using (
    exists (
      select 1 from public.chat_sessions
      where id = messages.session_id and user_id = auth.uid()
    )
  );

-- Auto-create profile on new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
