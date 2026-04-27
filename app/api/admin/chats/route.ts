import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isAdmin } from '@/lib/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: sessions, error } = await admin
    .from('chat_sessions')
    .select('id, module_id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const sessionIds = (sessions ?? []).map((s) => s.id)
  const messageCounts: Record<string, number> = {}

  if (sessionIds.length > 0) {
    const { data: msgs } = await admin
      .from('messages')
      .select('session_id')
      .in('session_id', sessionIds)
      .in('role', ['user', 'assistant'])

    msgs?.forEach(({ session_id }) => {
      messageCounts[session_id] = (messageCounts[session_id] ?? 0) + 1
    })
  }

  return NextResponse.json({
    sessions: (sessions ?? []).map((s) => ({
      ...s,
      message_count: messageCounts[s.id] ?? 0,
    })),
  })
}
