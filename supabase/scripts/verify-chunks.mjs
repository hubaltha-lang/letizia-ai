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

const { count } = await sb
  .from('letizia_chunks')
  .select('*', { count: 'exact', head: true })

const { data: rows } = await sb
  .from('letizia_chunks')
  .select('lesson_number, lesson_title, module_name')
  .order('lesson_number')

const uniqLessons = [...new Map(rows.map((l) => [l.lesson_number, l])).values()]

console.log(`Total chunks: ${count}`)
console.log(`Lessons indexed: ${uniqLessons.length}`)
console.log(`Modules:`)
const byModule = {}
for (const l of uniqLessons) {
  byModule[l.module_name] = (byModule[l.module_name] ?? 0) + 1
}
for (const [m, c] of Object.entries(byModule)) {
  console.log(`  ${m}: ${c} lessons`)
}
