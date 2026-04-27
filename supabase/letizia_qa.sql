-- Q&A archive from Letizia's platform — separate from course chunks
-- so we can retrieve both in parallel and treat them differently.
-- Run via: node supabase/scripts/run-migration.mjs supabase/letizia_qa.sql

create extension if not exists vector;

create table if not exists public.letizia_qa (
  id bigserial primary key,
  source_id text,                  -- original ID from the platform JSON, if any
  asked_by text,                   -- name/handle if available
  asked_at timestamptz,            -- original timestamp if available
  topic text,                      -- optional topic/category tag
  question text not null,
  answer text not null,
  -- Embedding is computed from question + answer concatenated, so retrieval
  -- can match on either the question wording or the substance of the answer.
  embedding vector(1024) not null,
  created_at timestamptz not null default now()
);

create index if not exists letizia_qa_embedding_idx
  on public.letizia_qa
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

alter table public.letizia_qa enable row level security;

create policy "letizia_qa_read" on public.letizia_qa
  for select using (auth.role() = 'authenticated');

create or replace function public.match_letizia_qa(
  query_embedding vector(1024),
  match_count int default 4
) returns table (
  source_id text,
  asked_by text,
  asked_at timestamptz,
  topic text,
  question text,
  answer text,
  similarity float
) language sql stable as $$
  select
    source_id,
    asked_by,
    asked_at,
    topic,
    question,
    answer,
    1 - (embedding <=> query_embedding) as similarity
  from public.letizia_qa
  order by embedding <=> query_embedding
  limit match_count;
$$;
