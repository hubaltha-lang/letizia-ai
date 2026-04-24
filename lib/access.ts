import type { PlanType } from '@/lib/admin'

export type AccessStatus =
  | { allowed: true }
  | { allowed: false; reason: 'trial_expired' | 'no_plan' }

export function checkAccess(plan: {
  plan_type: PlanType
  trial_end_at: string | null
  plan_end_at: string | null
}): AccessStatus {
  const now = Date.now()

  if (plan.plan_type === 'paid_monthly' || plan.plan_type === 'paid_6month') {
    // Monthly plan: no end date means it's a rolling renewal — always allowed
    if (!plan.plan_end_at) return { allowed: true }
    if (new Date(plan.plan_end_at).getTime() >= now) return { allowed: true }
    return { allowed: false, reason: 'no_plan' }
  }

  if (plan.plan_type === 'trial') {
    if (plan.trial_end_at && new Date(plan.trial_end_at).getTime() >= now) {
      return { allowed: true }
    }
    return { allowed: false, reason: 'trial_expired' }
  }

  return { allowed: false, reason: 'no_plan' }
}
