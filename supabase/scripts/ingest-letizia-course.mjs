#!/usr/bin/env node
/**
 * Ingest Letizia's course transcripts into Supabase letizia_chunks.
 *
 * 1. Reads all .txt files from LESSONS_DIR
 * 2. Parses lesson number, title, module from filename + header
 * 3. Chunks each transcript (~500 tokens, ~50 token overlap)
 * 4. Embeds chunks via Voyage AI (voyage-3, 1024 dims)
 * 5. Bulk inserts into public.letizia_chunks
 *
 * Usage: node supabase/scripts/ingest-letizia-course.mjs
 *
 * Optional flags:
 *   --reset       Truncate letizia_chunks before inserting
 *   --lesson <n>  Only ingest lesson with this number (for testing)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Config ---
const LESSONS_DIR = 'C:/Users/User/Desktop/NewProjects/AlthaCourse/lessons'
const VOYAGE_MODEL = 'voyage-3'
const VOYAGE_BATCH_SIZE = 64           // Voyage allows up to 128 per call
const CHUNK_CHAR_TARGET = 2000         // ~500 tokens
const CHUNK_CHAR_OVERLAP = 200         // ~50 tokens
const VOYAGE_DIM = 1024

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

// --- CLI args ---
const args = process.argv.slice(2)
const RESET = args.includes('--reset')
const lessonFlagIdx = args.indexOf('--lesson')
const ONLY_LESSON = lessonFlagIdx >= 0 ? parseInt(args[lessonFlagIdx + 1]) : null

// --- Parse a lesson file ---
function parseLessonFile(filename, content) {
  // Filename: 05_Module_1_-_Mindset_The_Programming.txt
  const numMatch = filename.match(/^(\d+)_/)
  const lessonNumber = numMatch ? parseInt(numMatch[1]) : 0

  // Header lines
  const titleMatch = content.match(/^Title:\s*(.+)$/m)
  const sectionMatch = content.match(/^Section:\s*(.+)$/m)

  const lessonTitle = titleMatch ? titleMatch[1].trim() : filename.replace(/\.txt$/, '')
  const moduleName = sectionMatch ? sectionMatch[1].trim() : 'Unknown'

  // Strip header, keep only transcript
  const transcriptStart = content.indexOf('=== TRANSCRIPT ===')
  const transcript = transcriptStart >= 0
    ? content.slice(transcriptStart + '=== TRANSCRIPT ==='.length).trim()
    : content.trim()

  return { lessonNumber, lessonTitle, moduleName, transcript }
}

// --- Chunk a transcript into ~500-token chunks with overlap ---
function chunkText(text) {
  // Split on paragraph breaks, keep paragraph integrity
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const chunks = []
  let current = ''

  for (const p of paragraphs) {
    if (current.length === 0) {
      current = p
    } else if (current.length + p.length + 2 <= CHUNK_CHAR_TARGET) {
      current += '\n\n' + p
    } else {
      chunks.push(current)
      // Carry the tail of previous chunk for overlap
      const tail = current.slice(-CHUNK_CHAR_OVERLAP)
      current = tail + '\n\n' + p
    }
  }
  if (current.trim().length > 0) chunks.push(current)
  return chunks
}

// --- Embed via Voyage AI ---
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
    const err = await res.text()
    throw new Error(`Voyage API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return {
    embeddings: data.data.map((d) => d.embedding),
    tokens: data.usage?.total_tokens ?? 0,
  }
}

// --- Main ---
async function main() {
  console.log(`Reading lessons from: ${LESSONS_DIR}`)
  const files = fs.readdirSync(LESSONS_DIR)
    .filter((f) => f.endsWith('.txt'))
    .sort()
  console.log(`Found ${files.length} lesson files`)

  if (RESET) {
    console.log('Resetting letizia_chunks table...')
    const { error } = await supabase.from('letizia_chunks').delete().neq('id', 0)
    if (error) throw error
  }

  // Parse + chunk all lessons first
  const allChunks = []
  for (const filename of files) {
    const content = fs.readFileSync(path.join(LESSONS_DIR, filename), 'utf-8')
    const { lessonNumber, lessonTitle, moduleName, transcript } = parseLessonFile(filename, content)

    if (ONLY_LESSON !== null && lessonNumber !== ONLY_LESSON) continue
    if (transcript.length < 100) {
      console.log(`  skip lesson ${lessonNumber} (${lessonTitle}) — transcript too short (${transcript.length} chars)`)
      continue
    }

    const pieces = chunkText(transcript)
    pieces.forEach((chunk_text, chunk_index) => {
      allChunks.push({
        lesson_number: lessonNumber,
        lesson_title: lessonTitle,
        module_name: moduleName,
        chunk_index,
        chunk_text,
        token_count: Math.ceil(chunk_text.length / 4),
      })
    })
  }

  console.log(`Total chunks to embed: ${allChunks.length}`)
  const totalChars = allChunks.reduce((s, c) => s + c.chunk_text.length, 0)
  console.log(`Total chars: ${totalChars} (~${Math.round(totalChars / 4)} tokens, ~$${(totalChars / 4 * 0.06 / 1_000_000).toFixed(4)} embedding cost)`)

  // Embed + insert in batches
  let totalTokensBilled = 0
  for (let i = 0; i < allChunks.length; i += VOYAGE_BATCH_SIZE) {
    const batch = allChunks.slice(i, i + VOYAGE_BATCH_SIZE)
    const texts = batch.map((c) => c.chunk_text)

    process.stdout.write(`  batch ${i / VOYAGE_BATCH_SIZE + 1}/${Math.ceil(allChunks.length / VOYAGE_BATCH_SIZE)} (${batch.length} chunks)... `)
    const { embeddings, tokens } = await embedBatch(texts)
    totalTokensBilled += tokens

    const rows = batch.map((c, j) => ({ ...c, embedding: embeddings[j] }))
    const { error } = await supabase.from('letizia_chunks').insert(rows)
    if (error) {
      console.error('\nInsert failed:', error)
      process.exit(1)
    }
    console.log(`embedded ${tokens} tokens, inserted`)
  }

  console.log(`\n✓ Done. Embedded ${allChunks.length} chunks, ${totalTokensBilled} Voyage tokens billed.`)
  console.log(`Estimated Voyage cost: $${(totalTokensBilled * 0.06 / 1_000_000).toFixed(4)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
