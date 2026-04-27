import { createAdminClient } from '@/lib/supabase/admin'

const VOYAGE_MODEL = 'voyage-3'
const COURSE_TOP_K = 5
const QA_TOP_K = 3

interface CourseRow {
  lesson_number: number
  lesson_title: string
  module_name: string
  chunk_text: string
  similarity: number
}

interface QARow {
  source_id: string | null
  asked_by: string | null
  asked_at: string | null
  topic: string | null
  question: string
  answer: string
  similarity: number
}

async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: [text],
      model: VOYAGE_MODEL,
      input_type: 'query',
    }),
  })

  if (!res.ok) {
    throw new Error(`Voyage embed failed ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  return data.data[0].embedding
}

/**
 * Retrieve relevant context for a Letizia question by searching both
 * course chunks and the Q&A archive in parallel. One embed call total.
 *
 * Pass a refined `query` string (e.g. from a tool-use call) for best
 * retrieval quality. Falls back to combining the last 2 user messages.
 */
export async function retrieveLetiziaContext(
  messagesOrQuery:
    | { role: string; content: string }[]
    | string
): Promise<string> {
  let queryText: string
  if (typeof messagesOrQuery === 'string') {
    queryText = messagesOrQuery
  } else {
    queryText = messagesOrQuery
      .filter((m) => m.role === 'user')
      .slice(-2)
      .map((m) => m.content)
      .join('\n')
  }

  if (!queryText.trim()) return ''

  const queryEmbedding = await embedQuery(queryText)
  const supabase = createAdminClient()

  const [courseRes, qaRes] = await Promise.all([
    supabase.rpc('match_letizia_chunks', {
      query_embedding: queryEmbedding,
      match_count: COURSE_TOP_K,
    }),
    supabase.rpc('match_letizia_qa', {
      query_embedding: queryEmbedding,
      match_count: QA_TOP_K,
    }),
  ])

  if (courseRes.error) console.error('match_letizia_chunks error:', courseRes.error)
  if (qaRes.error) console.error('match_letizia_qa error:', qaRes.error)

  const courseChunks = (courseRes.data ?? []) as CourseRow[]
  const qaPairs = (qaRes.data ?? []) as QARow[]

  const sections: string[] = []

  if (courseChunks.length > 0) {
    const courseText = courseChunks
      .map(
        (c) =>
          `[Lesson ${c.lesson_number} — ${c.lesson_title} (${c.module_name})]\n${c.chunk_text}`
      )
      .join('\n\n---\n\n')
    sections.push(`## COURSE EXCERPTS\n${courseText}`)
  }

  if (qaPairs.length > 0) {
    const qaText = qaPairs
      .map((qa) => {
        const meta = [qa.topic, qa.asked_by].filter(Boolean).join(' · ')
        const header = meta ? `[Past Q&A — ${meta}]` : `[Past Q&A]`
        return `${header}\nQ: ${qa.question}\nLetizia: ${qa.answer}`
      })
      .join('\n\n---\n\n')
    sections.push(`## PAST Q&A FROM LETIZIA\n${qaText}`)
  }

  return sections.join('\n\n')
}
