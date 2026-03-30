# Letizia AI — Setup Guide

## 1. Supabase Project

1. Go to https://supabase.com → New Project
2. Settings → API → copy **Project URL** and **anon public** key
3. Go to SQL Editor → New Query → paste contents of `supabase/schema.sql` → Run
4. Settings → Auth → uncheck "Enable email confirmations" (optional, for frictionless signup)

## 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-your-key
```

## 3. Run Locally

```bash
cd letizia-ai
npm install
npm run dev
```

Open http://localhost:3000 — you'll be redirected to /auth to sign up.

## 4. Deploy to Vercel

```bash
npx vercel
```

Add the 3 environment variables in Vercel → Project Settings → Environment Variables.

---

## Architecture Summary

- **Auth**: Supabase Auth (email + password, session cookies)
- **Database**: Supabase Postgres with Row Level Security
- **AI**: Anthropic Claude (streaming via `/api/chat` route)
- **Proxy**: `proxy.ts` guards `/dashboard` routes, redirects unauthenticated users
- **State**: Zustand (UI only) + Supabase (all persistence)
