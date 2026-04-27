-- pgvector + Letizia course knowledge base for general-letizia RAG
-- Run via: node supabase/scripts/run-migration.mjs supabase/letizia_rag.sql

create extension if not exists vector;

create table if not exists public.letizia_chunks (
  id bigserial primary key,
  lesson_number int not null,
  lesson_title text not null,
  module_name text not null,
  chunk_index int not null,
  chunk_text text not null,
  token_count int not null,
  embedding vector(1024) not null,
  created_at timestamptz not null default now()
);

create index if not exists letizia_chunks_embedding_idx
  on public.letizia_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

create index if not exists letizia_chunks_lesson_idx
  on public.letizia_chunks(lesson_number);

alter table public.letizia_chunks enable row level security;

-- Anyone authenticated can read (knowledge base is shared across users)
create policy "letizia_chunks_read" on public.letizia_chunks
  for select using (auth.role() = 'authenticated');

-- Similarity search RPC
create or replace function public.match_letizia_chunks(
  query_embedding vector(1024),
  match_count int default 8
) returns table (
  lesson_number int,
  lesson_title text,
  module_name text,
  chunk_text text,
  similarity float
) language sql stable as $$
  select
    lesson_number,
    lesson_title,
    module_name,
    chunk_text,
    1 - (embedding <=> query_embedding) as similarity
  from public.letizia_chunks
  order by embedding <=> query_embedding
  limit match_count;
$$;
