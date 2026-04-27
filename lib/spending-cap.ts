import { createAdminClient } from '@/lib/supabase/admin'

// --- Configuration ---
export const DAILY_BUDGET_USD = 50            // Global hard cap (~60 active users)
export const USER_TIER1_USD = 0.40            // Switch user to Haiku-only
export const USER_TIER2_USD = 0.83            // Hard pause user for 4 hours
export const USER_PAUSE_HOURS = 4

// Pricing (per token)
export const PRICING = {
  'claude-sonnet-4-6': { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  'claude-haiku-4-5-20251001': { input: 1 / 1_000_000, output: 5 / 1_000_000 },
} as const

export type ModelName = keyof typeof PRICING

export function estimateCost(
  model: ModelName,
  inputTokens: number,
  outputTokens: number
): number {
  const p = PRICING[model]
  return inputTokens * p.input + outputTokens * p.output
}

export type BudgetStatus =
  | { allow: true; degradeToHaiku: false }
  | { allow: true; degradeToHaiku: true }
  | { allow: false; reason: string }

/**
 * Check budgets and decide whether the request can proceed and at what quality.
 *
 * Order of checks (cheapest fail first):
 * 1. Global daily cap — protects total spend across all users
 * 2. Per-user daily Tier 2 (hard pause) — within last `USER_PAUSE_HOURS` of last activity
 * 3. Per-user daily Tier 1 (Haiku fallback)
 */
export async function checkBudget(userId: string): Promise<BudgetStatus> {
  const supabase = createAdminClient()

  // 1. Global daily cap
  const { data: globalSpend, error: gErr } = await supabase.rpc('get_today_spend')
  if (gErr) {
    console.error('get_today_spend failed:', gErr)
    return { allow: true, degradeToHaiku: false } // fail open on monitoring errors
  }
  const today = Number(globalSpend ?? 0)
  if (today >= DAILY_BUDGET_USD) {
    return {
      allow: false,
      reason: `We've reached today's overall capacity. Please come back tomorrow 🤍`,
    }
  }

  // 2 + 3. Per-user spend today
  const { data: userSpend, error: uErr } = await supabase.rpc('get_user_today_spend', {
    uid: userId,
  })
  if (uErr) {
    console.error('get_user_today_spend failed:', uErr)
    return { allow: true, degradeToHaiku: false }
  }
  const userToday = Number(userSpend ?? 0)

  // Tier 2 — hard pause if hit AND within rolling 4-hour window from last request
  if (userToday >= USER_TIER2_USD) {
    const { data: lastTs } = await supabase.rpc('get_user_last_request', { uid: userId })
    if (lastTs) {
      const last = new Date(lastTs as string).getTime()
      const elapsedMs = Date.now() - last
      const pauseMs = USER_PAUSE_HOURS * 60 * 60 * 1000
      if (elapsedMs < pauseMs) {
        const hoursLeft = Math.ceil((pauseMs - elapsedMs) / (60 * 60 * 1000))
        return {
          allow: false,
          reason: `Take a beautiful pause 🤍 — come back to me in about ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}.`,
        }
      }
    }
  }

  // Tier 1 — degrade to Haiku
  if (userToday >= USER_TIER1_USD) {
    return { allow: true, degradeToHaiku: true }
  }

  return { allow: true, degradeToHaiku: false }
}

export async function logUsage(params: {
  userId: string
  moduleId: string
  model: ModelName
  inputTokens: number
  outputTokens: number
}): Promise<void> {
  const cost = estimateCost(params.model, params.inputTokens, params.outputTokens)
  const supabase = createAdminClient()
  const { error } = await supabase.from('api_usage').insert({
    user_id: params.userId,
    module_id: params.moduleId,
    model: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    cost_usd: cost,
  })
  if (error) {
    console.error('api_usage insert failed:', error)
  }
}
