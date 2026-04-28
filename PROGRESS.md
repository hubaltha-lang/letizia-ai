# Letizia AI Dashboard — Build Progress

## Session: 2026-04-27 / 2026-04-28

### What was built

---

### 1. Paid Invite System

**Problem:** Only trial invites existed. No way to onboard paying customers directly.

**What was done:**
- Added 3 columns to the `invites` table in Supabase: `plan_type` (text, default `'trial'`), `plan_start_at` (timestamptz), `plan_end_at` (timestamptz). Migration run via Supabase Management API — already live in DB.
- New API route `POST /api/admin/invite-paid` — creates a paid invite record and sends a branded Mailgun email showing the plan type and access period (start → end date).
- Updated `claimInvite` server action: when a paid-plan invite is claimed, it sets `plan_type`, `plan_start_at`, and `plan_end_at` on the profile instead of creating a trial.
- `AuthForm` now shows a gold plan badge ("Monthly Plan" / "6-Month Plan") and the button says "Activate my account →" instead of "Activate my free trial →" for paid invites.

**Files changed:** `supabase/paid_invite_migration.sql`, `app/api/admin/invite-paid/route.ts`, `app/actions/auth.ts`, `app/auth/page.tsx`, `components/AuthForm.tsx`, `lib/admin.ts`

---

### 2. Admin Dashboard — Tab Restructure

**Problem:** Admin page was a single scrolling page. Getting crowded.

**What was done:**
- Restructured `AdminDashboard` into 4 tabs: **Users · Invites · Chats · Usage**
- **Users tab:** existing user table + plan edit modal (unchanged)
- **Invites tab:** trial invite form + paid invite form (plan type dropdown + end date picker) + invite log showing plan type per entry
- **Chats tab:** new (see below)
- **Usage tab:** new (see below)

---

### 3. Duplicate Email Guard

**Problem:** If you tried to invite an email already registered as a user, Mailgun would send the email anyway and the link would fail.

**What was done:**
- Both `POST /api/admin/invite` (trial) and `POST /api/admin/invite-paid` now call `admin.auth.admin.listUsers()` first
- If the email is already in auth.users → returns 409 with "This email is already registered as a user."
- The invite form shows this as an error. The CSV bulk sender marks it as "skipped".

---

### 4. Chat Viewer (Admin)

**Problem:** No way to see what users are saying to the AI.

**What was done:**
- New API `GET /api/admin/chats?userId=xxx` — returns all sessions for a user with message counts
- New API `GET /api/admin/chats/[sessionId]` — returns all user/assistant messages for a session
- New component `AdminChats` with a 3-panel layout:
  - Left panel: all users, click to select
  - Middle panel: their chat sessions (title, module, message count, date)
  - Right panel: full message thread, user messages in gold on the right, AI responses on the left

---

### 5. Usage Analytics (Admin)

**Problem:** No visibility into how much users are using the AI or what it costs.

**What was done:**
- New API `GET /api/admin/usage?from=YYYY-MM-DD&to=YYYY-MM-DD` — aggregates `api_usage` table per user for the given period (also counts sessions)
- New component `AdminUsage` with:
  - **Date filter bar:** Today / Last 7 days / This month / Custom (shows two date pickers + Apply button)
  - **4 summary cards:** Cost, API calls, Input tokens, Output tokens — all for the selected period
  - **Per-user table:** Sessions · API calls · Input tokens · Output tokens · Cost · Last active
  - **Totals row** at the bottom
  - Cost highlighted in yellow if above $0.50/day

---

### 6. CSV Bulk Invite

**Problem:** Needed to invite ~50 people without doing it one by one. Also needed to send slowly to protect domain reputation.

**What was done:**
- New component `AdminBulkInvite` in the Invites tab:
  - **CSV template download** — one click downloads a pre-formatted template
  - **CSV upload** — click to upload, parses client-side, validates email format
  - **Rate-limited sending** — configurable delay: 30 sec / 1 min / 2 min between sends
  - **ETA shown** based on pending count and delay
  - **Live status per row:** pending (clock) → sending (pulsing) → sent (gold checkmark) / skipped / error
  - **Start / Stop / Resume** — stop pauses between sends, resume picks up where it left off
  - Already-registered emails auto-skip (marked "Already registered", not an error)
  - Progress bar fills as emails are sent
  
**Domain status checked:** `altha-community.com` has SPF ✓ and DKIM ✓ both verified in Mailgun. Safe to send. Note: DMARC not yet added (optional but recommended — add TXT record: `v=DMARC1; p=none; rua=mailto:hello@altha-community.com`).

---

## Current git state

All changes committed and pushed to `main`. Vercel auto-deployed. Last commit: `35264c2`.

## What still needs to be done (future sessions)

- Add DMARC DNS record to `altha-community.com` for full email authentication
- Consider adding message search to the Chats viewer
- Consider adding a chart/graph view to Usage (cost over time)
