#!/usr/bin/env node
/**
 * Wipe today's api_usage rows (UTC day) for a single user.
 * Usage: node supabase/scripts/reset-my-spend.mjs <userId>
 * Or omit userId to reset the most recent user.
 */

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

let userId = process.argv[2]
if (!userId) {
  const { data } = await sb
    .from('api_usage')
    .select('user_id')
    .order('created_at', { ascending: false })
    .limit(1)
  userId = data?.[0]?.user_id
}

if (!userId) {
  console.error('No user found')
  process.exit(1)
}

// UTC day boundary
const now = new Date()
const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

const { data: before } = await sb.rpc('get_user_today_spend', { uid: userId })
const { error } = await sb
  .from('api_usage')
  .delete()
  .eq('user_id', userId)
  .gte('created_at', utcMidnight.toISOString())

if (error) {
  console.error('Delete failed:', error)
  process.exit(1)
}

const { data: after } = await sb.rpc('get_user_today_spend', { uid: userId })
console.log(`User ${userId.slice(0, 8)}: today's spend reset`)
console.log(`  before: $${Number(before ?? 0).toFixed(4)}`)
console.log(`  after:  $${Number(after ?? 0).toFixed(4)}`)
