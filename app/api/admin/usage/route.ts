import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isAdmin } from '@/lib/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from') // ISO date string, e.g. "2026-04-01"
  const to = searchParams.get('to')     // ISO date string, e.g. "2026-04-27"

  const admin = createAdminClient()

  let usageQuery = admin
    .from('api_usage')
    .select('user_id, input_tokens, output_tokens, cost_usd, created_at')
    .order('created_at', { ascending: false })

  if (from) usageQuery = usageQuery.gte('created_at', `${from}T00:00:00.000Z`)
  if (to)   usageQuery = usageQuery.lte('created_at', `${to}T23:59:59.999Z`)

  let sessionQuery = admin.from('chat_sessions').select('user_id')
  if (from) sessionQuery = sessionQuery.gte('created_at', `${from}T00:00:00.000Z`)
  if (to)   sessionQuery = sessionQuery.lte('created_at', `${to}T23:59:59.999Z`)

  const [{ data: usageRows }, { data: sessionRows }] = await Promise.all([
    usageQuery,
    sessionQuery,
  ])

  const sessionsByUser: Record<string, number> = {}
  sessionRows?.forEach(({ user_id }) => {
    sessionsByUser[user_id] = (sessionsByUser[user_id] ?? 0) + 1
  })

  const byUser: Record<string, {
    user_id: string
    input_tokens: number
    output_tokens: number
    cost_usd: number
    api_calls: number
    sessions: number
    last_at: string | null
  }> = {}

  for (const row of usageRows ?? []) {
    if (!byUser[row.user_id]) {
      byUser[row.user_id] = {
        user_id: row.user_id,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        api_calls: 0,
        sessions: sessionsByUser[row.user_id] ?? 0,
        last_at: null,
      }
    }
    const u = byUser[row.user_id]
    u.input_tokens += row.input_tokens
    u.output_tokens += row.output_tokens
    u.cost_usd += Number(row.cost_usd)
    u.api_calls += 1
    if (!u.last_at || row.created_at > u.last_at) u.last_at = row.created_at
  }

  // Include users with sessions but zero api_usage in the period
  Object.entries(sessionsByUser).forEach(([uid, count]) => {
    if (!byUser[uid]) {
      byUser[uid] = {
        user_id: uid,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        api_calls: 0,
        sessions: count,
        last_at: null,
      }
    }
  })

  return NextResponse.json({
    byUser: Object.values(byUser).sort((a, b) => b.cost_usd - a.cost_usd),
  })
}
