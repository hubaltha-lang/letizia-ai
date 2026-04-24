import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isAdmin } from '@/lib/admin'
import type { PlanType } from '@/lib/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { userId, plan_type, trial_start_at, trial_end_at, plan_start_at, plan_end_at } = body as {
    userId: string
    plan_type: PlanType
    trial_start_at: string | null
    trial_end_at: string | null
    plan_start_at: string | null
    plan_end_at: string | null
  }

  if (!userId || !plan_type) {
    return NextResponse.json({ error: 'userId and plan_type required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ plan_type, trial_start_at, trial_end_at, plan_start_at, plan_end_at })
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
