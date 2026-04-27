#!/usr/bin/env node
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const [k, ...rest] = l.split('=')
      return [k.trim(), rest.join('=').trim()]
    })
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: today } = await sb.rpc('get_today_spend')
console.log(`Global today spend: $${Number(today ?? 0).toFixed(4)} / $50.00 cap`)

const { data: rows } = await sb
  .from('api_usage')
  .select('user_id, model, input_tokens, output_tokens, cost_usd, created_at')
  .order('created_at', { ascending: false })
  .limit(20)

console.log(`\nLast 20 requests:`)
for (const r of rows ?? []) {
  const t = new Date(r.created_at).toLocaleTimeString()
  console.log(`  ${t}  ${r.model.padEnd(28)} in=${r.input_tokens} out=${r.output_tokens}  $${Number(r.cost_usd).toFixed(4)}  user=${r.user_id?.slice(0,8)}`)
}

const recentUser = rows?.[0]?.user_id
if (recentUser) {
  const { data: userToday } = await sb.rpc('get_user_today_spend', { uid: recentUser })
  const { data: lastReq } = await sb.rpc('get_user_last_request', { uid: recentUser })
  const spend = Number(userToday ?? 0)
  let tier = '✅ Full Sonnet quality'
  if (spend >= 0.83) tier = '⏸️  Tier 2 — 4hr pause'
  else if (spend >= 0.40) tier = '⚠️  Tier 1 — Haiku-only'
  console.log(`\nMost recent user ($${spend.toFixed(4)} today): ${tier}`)
  console.log(`  last request: ${lastReq}`)
}
