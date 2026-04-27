import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isAdmin } from '@/lib/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const [{ data: usageRows }, { data: sessionRows }] = await Promise.all([
    admin
      .from('api_usage')
      .select('user_id, input_tokens, output_tokens, cost_usd, created_at')
      .order('created_at', { ascending: false }),
    admin.from('chat_sessions').select('user_id'),
  ])

  const sessionsByUser: Record<string, number> = {}
  sessionRows?.forEach(({ user_id }) => {
    sessionsByUser[user_id] = (sessionsByUser[user_id] ?? 0) + 1
  })

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const byUser: Record<string, {
    user_id: string
    input_tokens: number
    output_tokens: number
    cost_usd: number
    cost_today: number
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
        cost_today: 0,
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
    if (new Date(row.created_at) >= todayStart) u.cost_today += Number(row.cost_usd)
  }

  return NextResponse.json({
    byUser: Object.values(byUser).sort((a, b) => b.cost_usd - a.cost_usd),
  })
}
