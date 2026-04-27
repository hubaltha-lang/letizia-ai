#!/usr/bin/env node
/**
 * Run a SQL migration file against Supabase via Management API.
 * Usage: node supabase/scripts/run-migration.mjs <path-to-sql-file>
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env.local
const envPath = path.resolve(__dirname, '../../.env.local')
const envText = fs.readFileSync(envPath, 'utf-8')
const env = Object.fromEntries(
  envText.split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const [k, ...rest] = l.split('=')
      return [k.trim(), rest.join('=').trim()]
    })
)

const TOKEN = env.SUPABASE_MANAGEMENT_TOKEN
const PROJECT_REF = env.SUPABASE_PROJECT_REF

if (!TOKEN || !PROJECT_REF) {
  console.error('Missing SUPABASE_MANAGEMENT_TOKEN or SUPABASE_PROJECT_REF in .env.local')
  process.exit(1)
}

const file = process.argv[2]
if (!file) {
  console.error('Usage: node run-migration.mjs <sql-file>')
  process.exit(1)
}

const sql = fs.readFileSync(path.resolve(file), 'utf-8')
console.log(`Running migration: ${file}`)
console.log(`SQL length: ${sql.length} chars`)

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  }
)

const result = await res.json()

if (!res.ok) {
  console.error('✗ Migration failed:', result)
  process.exit(1)
}

console.log('✓ Migration applied successfully')
if (Array.isArray(result) && result.length > 0) {
  console.log('Result:', JSON.stringify(result, null, 2))
}
