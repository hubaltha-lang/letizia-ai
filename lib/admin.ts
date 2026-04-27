import { createClient as createServiceClient } from '@supabase/supabase-js'

export const ADMIN_EMAILS = ['hub.altha@gmail.com']

export function isAdmin(email: string | undefined | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email)
}

export function createAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type PlanType = 'none' | 'trial' | 'paid_monthly' | 'paid_6month'

export const PLAN_LABELS: Record<PlanType, string> = {
  none: 'No plan',
  trial: '7-day Trial',
  paid_monthly: 'Monthly Plan',
  paid_6month: '6-Month Plan',
}

export interface AdminUser {
  id: string
  email: string
  display_name: string
  full_name: string
  created_at: string
  plan_type: PlanType
  trial_start_at: string | null
  trial_end_at: string | null
  plan_start_at: string | null
  plan_end_at: string | null
}

export interface Invite {
  id: string
  email: string
  invited_at: string
  accepted_at: string | null
  user_id: string | null
  plan_type: PlanType
  plan_start_at: string | null
  plan_end_at: string | null
}
