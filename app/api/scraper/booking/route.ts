import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ACTOR_ID = 'voyager~booking-scraper'
const APIFY_TOKEN = process.env.APIFY_API_TOKEN!

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: 'Apify token not configured on server' }, { status: 500 })
  }

  const { scrapeConfig } = await req.json()

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scrapeConfig),
    }
  )

  if (!runRes.ok) {
    const err = await runRes.text()
    return NextResponse.json({ error: `Apify error: ${err}` }, { status: runRes.status })
  }

  const runData = await runRes.json()
  return NextResponse.json({
    runId: runData.data.id,
    datasetId: runData.data.defaultDatasetId,
    status: runData.data.status,
  })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: 'Apify token not configured on server' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const runId = searchParams.get('runId')
  const datasetId = searchParams.get('datasetId')

  if (datasetId && !runId) {
    const res = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json`
    )
    const items = await res.json()
    return NextResponse.json({ items })
  }

  if (runId) {
    const res = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    )
    const data = await res.json()
    return NextResponse.json({
      status: data.data.status,
      datasetId: data.data.defaultDatasetId,
    })
  }

  return NextResponse.json({ error: 'runId or datasetId required' }, { status: 400 })
}
