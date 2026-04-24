import Anthropic from '@anthropic-ai/sdk'
import { getModule } from '@/lib/modules'
import type { ModuleId } from '@/lib/modules'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/admin'
import { retrieveLetiziaContext } from '@/lib/letizia-retrieval'
import { checkBudget, logUsage, type ModelName } from '@/lib/spending-cap'
import { checkAccess } from '@/lib/access'

export const runtime = 'nodejs'

const SONNET: ModelName = 'claude-sonnet-4-6'
const HAIKU: ModelName = 'claude-haiku-4-5-20251001'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Tool definition: Haiku decides when to call this. We want it called only
// when the user has provided enough context (Outcome + Context + Why) to
// merit a substantive grounded answer.
const RETRIEVE_TOOL: Anthropic.Messages.Tool = {
  name: 'retrieve_letizia_knowledge',
  description:
    'Search Letizia\'s course transcripts and her past 1:1 Q&A archive for material relevant to the current conversation. ' +
    '\n\n**CALL THIS TOOL AGGRESSIVELY.** You should call it whenever the user touches on ANY topic Letizia has taught about: ' +
    'pricing, brand books, niching, positioning, corporate pitching, hospitality pitching, mindset, visibility blocks, ' +
    'sound healing, scaling, offers, packages, Instagram, LinkedIn, sales calls, discovery calls, retreats, events, ' +
    'partnerships, commission structures, media kits, brochures, proposals, email templates, social media strategy, ' +
    'self-hypnosis, rejection, or any business/coaching question. ' +
    '\n\n**The ONLY times to NOT call this tool are:** ' +
    '(1) a pure greeting like "hi" with no substance, ' +
    '(2) a casual acknowledgment like "thank you" or "ok great", ' +
    '(3) the user is venting feelings without asking anything, ' +
    '(4) the user is answering a qualifying question you just asked and you need one more piece before answering. ' +
    '\n\n**If in doubt, CALL THE TOOL.** Retrieval is cheap; flying blind produces weak answers. ' +
    'Even during the qualifying flow, if the user has given you enough substance (a clear topic + some context), ' +
    'call the tool so your next reply is grounded — you can still ask a final clarifying question after retrieval if needed. ' +
    '\n\nRefine the user\'s message into a clean topical query when calling (e.g. "pricing recurring sound bath at yoga studio" ' +
    'rather than "idk how much should i charge her").',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'A focused topical search query summarizing what to retrieve. ' +
          'Refine the user\'s rambling message into a clean topical query. ' +
          'Examples: "pricing recurring sound bath sessions at yoga studios", "brand book identity corporate positioning", ' +
          '"first pitch email to luxury hospitality spa director".',
      },
    },
    required: ['query'],
  },
}

export async function POST(req: Request) {
  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Access check (trial / plan expiry)
  const admin = createAdminClient()
  const { data: planRow } = await admin
    .from('profiles')
    .select('plan_type, trial_end_at, plan_end_at')
    .eq('id', user.id)
    .single()

  const access = checkAccess({
    plan_type: planRow?.plan_type ?? 'none',
    trial_end_at: planRow?.trial_end_at ?? null,
    plan_end_at: planRow?.plan_end_at ?? null,
  })
  if (!access.allowed) {
    return new Response('trial_expired', { status: 403 })
  }

  // Budget check (global cap, per-user Tier 1 / Tier 2)
  const budget = await checkBudget(user.id)
  if (!budget.allow) {
    return new Response(budget.reason, { status: 429 })
  }

  const { messages, moduleId, profileContext } = await req.json()
  const module = getModule(moduleId as ModuleId)
  const systemPrompt = profileContext
    ? profileContext + module.systemPrompt
    : module.systemPrompt

  const apiMessages = messages.map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const isLetiziaGeneral = moduleId === 'general-letizia'
  const encoder = new TextEncoder()

  // -------------------------------------------------------------------------
  // Path A: NOT general-letizia → keep the legacy single-Sonnet flow
  // -------------------------------------------------------------------------
  if (!isLetiziaGeneral) {
    return streamSingleCall({
      model: SONNET,
      maxTokens: 1024,
      systemPrompt,
      apiMessages,
      userId: user.id,
      moduleId,
      encoder,
    })
  }

  // -------------------------------------------------------------------------
  // Path B: general-letizia — tool-use architecture
  //   1) Haiku routes (text response = qualifying, tool_use = needs RAG)
  //   2) If tool fires: run retrieval, then Sonnet (or Haiku if degraded) answers
  // -------------------------------------------------------------------------
  const answerModel: ModelName = budget.degradeToHaiku ? HAIKU : SONNET

  // Step 1 — Haiku router (non-streaming so we can branch cleanly)
  let routerResponse: Anthropic.Messages.Message
  try {
    routerResponse = await client.messages.create({
      model: HAIKU,
      max_tokens: 250,
      system: systemPrompt,
      tools: [RETRIEVE_TOOL],
      messages: apiMessages,
    })
  } catch (err) {
    console.error('Haiku router error:', err)
    return new Response('I apologize — something went wrong. Please try again.', { status: 500 })
  }

  // Log router usage
  logUsage({
    userId: user.id,
    moduleId,
    model: HAIKU,
    inputTokens: routerResponse.usage.input_tokens,
    outputTokens: routerResponse.usage.output_tokens,
  }).catch((e) => console.error('logUsage(router) failed:', e))

  const toolUseBlock = routerResponse.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
  )

  // -------------------------------------------------------------------------
  // Branch B1: Haiku responded with text (qualifying turn) — send as stream
  // -------------------------------------------------------------------------
  if (!toolUseBlock) {
    const text = routerResponse.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text || ''))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  // -------------------------------------------------------------------------
  // Branch B2: Haiku called the tool — run retrieval, then answer model streams
  // -------------------------------------------------------------------------
  const queryArg = (toolUseBlock.input as { query?: string })?.query ?? ''
  let knowledge = ''
  try {
    knowledge = await retrieveLetiziaContext(queryArg || apiMessages)
  } catch (err) {
    console.error('Retrieval failed:', err)
    knowledge = '' // continue without grounding rather than failing
  }

  const knowledgeBlock = knowledge
    ? `# RETRIEVED FROM LETIZIA'S KNOWLEDGE BASE\n` +
      `The sections below were pulled from Letizia's actual material. Use them to ground your reply in her voice and frameworks.\n` +
      `- COURSE EXCERPTS are her teaching content. Cite as (Lesson 12 — Niche Like a Pro) when you draw from them.\n` +
      `- PAST Q&A is how she has actually answered similar questions. Use them as voice/style reference and substance precedent.\n` +
      `If the retrieved material doesn't fully cover the question, draw on broader knowledge and note that you're going beyond the source.\n\n` +
      knowledge
    : 'No retrieval results matched the query. Answer from broader knowledge and gently note that to the user.'

  const answerMessages: Anthropic.Messages.MessageParam[] = [
    ...apiMessages,
    { role: 'assistant', content: routerResponse.content },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseBlock.id,
          content: knowledgeBlock,
        },
      ],
    },
  ]

  let answerInputTokens = 0
  let answerOutputTokens = 0

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await client.messages.create({
          model: answerModel,
          max_tokens: 300,
          system: systemPrompt,
          tools: [RETRIEVE_TOOL], // tool must be defined for tool_result to be valid
          messages: answerMessages,
          stream: true,
        })

        for await (const event of response) {
          if (event.type === 'message_start') {
            answerInputTokens = event.message.usage?.input_tokens ?? 0
          } else if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          } else if (event.type === 'message_delta') {
            answerOutputTokens = event.usage?.output_tokens ?? answerOutputTokens
          }
        }

        controller.close()

        logUsage({
          userId: user.id,
          moduleId,
          model: answerModel,
          inputTokens: answerInputTokens,
          outputTokens: answerOutputTokens,
        }).catch((e) => console.error('logUsage(answer) failed:', e))
      } catch (err) {
        console.error('Answer model error:', err)
        controller.enqueue(
          encoder.encode('I apologize — something went wrong. Please try again.')
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

// -------------------------------------------------------------------------
// Helper for non-Letizia modules — single streaming Sonnet call
// -------------------------------------------------------------------------
function streamSingleCall(opts: {
  model: ModelName
  maxTokens: number
  systemPrompt: string
  apiMessages: Anthropic.Messages.MessageParam[]
  userId: string
  moduleId: string
  encoder: TextEncoder
}) {
  let inputTokens = 0
  let outputTokens = 0

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await client.messages.create({
          model: opts.model,
          max_tokens: opts.maxTokens,
          system: opts.systemPrompt,
          messages: opts.apiMessages,
          stream: true,
        })

        for await (const event of response) {
          if (event.type === 'message_start') {
            inputTokens = event.message.usage?.input_tokens ?? 0
          } else if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(opts.encoder.encode(event.delta.text))
          } else if (event.type === 'message_delta') {
            outputTokens = event.usage?.output_tokens ?? outputTokens
          }
        }

        controller.close()

        logUsage({
          userId: opts.userId,
          moduleId: opts.moduleId,
          model: opts.model,
          inputTokens,
          outputTokens,
        }).catch((e) => console.error('logUsage failed:', e))
      } catch (err) {
        console.error('Claude API error:', err)
        controller.enqueue(
          opts.encoder.encode('I apologize — something went wrong. Please try again.')
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
