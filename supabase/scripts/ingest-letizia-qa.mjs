#!/usr/bin/env node
/**
 * Ingest Letizia's Q&A archive into Supabase letizia_qa.
 *
 * 1. Reads questions JSON from QA_FILE
 * 2. Skips entries where Letizia didn't reply
 * 3. Combines all letizia_replies into one answer
 * 4. Embeds question + answer together (so retrieval matches on either)
 * 5. Bulk inserts into public.letizia_qa
 *
 * Usage: node supabase/scripts/ingest-letizia-qa.mjs [--reset]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Config ---
const QA_FILE = 'C:/Users/User/Desktop/AlthaCollective_Scrape/altha_questions_slim.json'
const VOYAGE_MODEL = 'voyage-3'
const VOYAGE_BATCH_SIZE = 32       // Q&A texts are longer, keep batches under TPM
const MAX_EMBED_CHARS = 28000       // ~7K tokens, well under voyage-3's 32K limit

// --- Load env ---
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

const VOYAGE_KEY = env.VOYAGE_API_KEY
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!VOYAGE_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VOYAGE_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

const args = process.argv.slice(2)
const RESET = args.includes('--reset')

// --- Helpers ---
function deriveTopic(slug) {
  // "brand-book-brochures-and-media-kits-1" -> "Brand Book Brochures And Media Kits"
  if (!slug) return null
  return slug
    .replace(/-\d+$/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function clip(text, max) {
  return text.length <= max ? text : text.slice(0, max)
}

async function embedBatch(texts) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: texts,
      model: VOYAGE_MODEL,
      input_type: 'document',
    }),
  })

  if (!res.ok) {
    throw new Error(`Voyage API error ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  return {
    embeddings: data.data.map((d) => d.embedding),
    tokens: data.usage?.total_tokens ?? 0,
  }
}

// --- Main ---
async function main() {
  console.log(`Reading Q&A from: ${QA_FILE}`)
  const raw = JSON.parse(fs.readFileSync(QA_FILE, 'utf-8'))
  const allQuestions = raw.questions ?? []
  console.log(`Total entries in file: ${allQuestions.length}`)

  if (RESET) {
    console.log('Resetting letizia_qa table...')
    const { error } = await supabase.from('letizia_qa').delete().neq('id', 0)
    if (error) throw error
  }

  // Build rows, skip entries with no Letizia reply
  const rows = []
  let skipped = 0
  for (const q of allQuestions) {
    const replies = (q.letizia_replies ?? []).filter(Boolean)
    if (replies.length === 0) {
      skipped++
      continue
    }
    const question = (q.question ?? '').trim()
    const answer = replies.join('\n\n').trim()
    if (!question || !answer) {
      skipped++
      continue
    }
    rows.push({
      source_id: q.slug ?? String(q.idx),
      asked_by: null,
      asked_at: null,
      topic: deriveTopic(q.slug),
      question: clip(question, 8000),    // store full-ish question
      answer,                              // full answer
      // Embedding text is question + answer concatenated, clipped to keep
      // under voyage-3's per-input limits and to avoid wasting tokens.
      _embed_text: clip(`${question}\n\nLETIZIA ANSWERED:\n${answer}`, MAX_EMBED_CHARS),
    })
  }

  console.log(`Q&A pairs to embed: ${rows.length} (skipped ${skipped} without Letizia replies)`)
  const totalChars = rows.reduce((s, r) => s + r._embed_text.length, 0)
  console.log(`Total embedding chars: ${totalChars} (~${Math.round(totalChars / 4)} tokens, ~$${(totalChars / 4 * 0.06 / 1_000_000).toFixed(4)} estimated)`)

  let totalTokensBilled = 0
  for (let i = 0; i < rows.length; i += VOYAGE_BATCH_SIZE) {
    const batch = rows.slice(i, i + VOYAGE_BATCH_SIZE)
    const texts = batch.map((r) => r._embed_text)

    process.stdout.write(`  batch ${i / VOYAGE_BATCH_SIZE + 1}/${Math.ceil(rows.length / VOYAGE_BATCH_SIZE)} (${batch.length} pairs)... `)
    const { embeddings, tokens } = await embedBatch(texts)
    totalTokensBilled += tokens

    const insertRows = batch.map((r, j) => {
      const { _embed_text, ...rest } = r
      return { ...rest, embedding: embeddings[j] }
    })

    const { error } = await supabase.from('letizia_qa').insert(insertRows)
    if (error) {
      console.error('\nInsert failed:', error)
      process.exit(1)
    }
    console.log(`embedded ${tokens} tokens, inserted`)
  }

  console.log(`\n✓ Done. ${rows.length} Q&A pairs ingested, ${totalTokensBilled} Voyage tokens billed.`)
  console.log(`Estimated Voyage cost: $${(totalTokensBilled * 0.06 / 1_000_000).toFixed(4)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
