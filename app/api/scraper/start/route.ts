import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

export const maxDuration = 300

const APIFY_TOKEN = process.env.APIFY_API_TOKEN!
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY!
const APOLLO_KEY = process.env.APOLLO_API_KEY!
const HUNTER_KEY = process.env.HUNTER_API_KEY!
const TRIPADVISOR_ACTOR = 'maxcopell~tripadvisor'

/* ═══════════ Types ═══════════ */

interface HotelData {
  hotel_name: string
  hotel_chain: string | null
  stars: number
  rating: number
  rating_label: string | null
  reviews: number
  full_address: string | null
  city: string | null
  country: string | null
  url: string
  property_type: string | null
  has_spa: boolean
  facilities: string | null
  // Pre-enriched fields from TripAdvisor (skip Perplexity for these)
  property_website: string | null
  generic_email: string | null
}

/* ═══════════ Helpers ═══════════ */

async function appendLog(admin: SupabaseClient, searchId: string, line: string) {
  const time = new Date().toISOString().slice(11, 19)
  const entry = `[${time}] ${line}\n`
  // Fetch current log, append, write back (race-safe enough for a single worker)
  const { data } = await admin.from('scrape_searches').select('enrichment_log').eq('id', searchId).single()
  const newLog = (data?.enrichment_log || '') + entry
  await admin.from('scrape_searches').update({ enrichment_log: newLog }).eq('id', searchId)
  console.log(`[${searchId.slice(0,8)}] ${line}`)
}

async function setProgress(admin: SupabaseClient, searchId: string, phase: string, current: number, total: number) {
  await admin.from('scrape_searches').update({
    enrichment_progress: { phase, current, total }
  }).eq('id', searchId)
}

async function setStatus(admin: SupabaseClient, searchId: string, status: 'running' | 'succeeded' | 'failed', extra: Record<string, unknown> = {}) {
  await admin.from('scrape_searches').update({ status, ...extra }).eq('id', searchId)
}

/* ═══════════ Booking.com Scrape ═══════════ */

function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '') || null
  } catch {
    return null
  }
}

async function runTripAdvisorScrape(
  admin: SupabaseClient,
  searchId: string,
  query: string,
  starsFilter: string,
  maxItems: number
): Promise<HotelData[]> {
  await appendLog(admin, searchId, `── PHASE: TripAdvisor Scrape ──`)
  await appendLog(admin, searchId, `Destination: ${query} | Stars: ${starsFilter}`)
  await setProgress(admin, searchId, 'Scraping TripAdvisor', 0, 0)

  // TripAdvisor doesn't have a server-side stars filter, so we pull more results
  // and filter client-side to hit the user's target maxItems
  const overFetch = starsFilter === 'any' ? maxItems : Math.min(maxItems * 5, 200)
  const targetStarFloat = starsFilter === 'any' ? null : parseFloat(starsFilter)

  const input = {
    query,
    includeHotels: true,
    includeRestaurants: false,
    includeAttractions: false,
    includeVacationRentals: false,
    includeTags: false,
    maxItemsPerQuery: overFetch,
    language: 'en',
    currency: 'EUR',
  }

  await appendLog(admin, searchId, `Pulling up to ${overFetch} hotels (will filter for ${starsFilter}-star)`)

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${TRIPADVISOR_ACTOR}/runs?token=${APIFY_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
  )
  if (!startRes.ok) throw new Error(`Apify start failed: ${await startRes.text()}`)

  const startData = await startRes.json()
  const runId = startData.data.id
  const datasetId = startData.data.defaultDatasetId

  await admin.from('scrape_searches').update({ apify_run_id: runId, apify_dataset_id: datasetId }).eq('id', searchId)
  await appendLog(admin, searchId, `Apify run started: ${runId}`)

  // Poll
  let status = 'RUNNING'
  while (status === 'RUNNING' || status === 'READY') {
    await new Promise((r) => setTimeout(r, 5000))
    const pollRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
    const pollData = await pollRes.json()
    status = pollData.data.status
  }

  if (status !== 'SUCCEEDED') throw new Error(`Apify run ${status}`)

  const dataRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json`)
  const items = await dataRes.json()

  await appendLog(admin, searchId, `Scraped ${items.length} hotels (raw)`)

  // Extract + filter by stars
  const allHotels: HotelData[] = (items || []).map((item: Record<string, unknown>): HotelData => {
    const addrObj = (item.addressObj || {}) as Record<string, string>
    const amenities = (item.amenities || []) as string[]
    const hasSpa = amenities.some((a) => /spa|wellness|sauna|massage|steam|hammam|jacuzzi|hot tub|thermal/i.test(a))
    const hotelClass = item.hotelClass ? parseFloat(item.hotelClass as string) : 0

    return {
      hotel_name: (item.name as string) || (item.localName as string) || '',
      hotel_chain: null,
      stars: hotelClass,
      rating: (item.rating as number) || 0,
      rating_label: null,
      reviews: (item.numberOfReviews as number) || 0,
      full_address: (item.address as string) || null,
      city: addrObj.city || null,
      country: (addrObj.country || '').toUpperCase() || null,
      url: (item.webUrl as string) || '',
      property_type: (item.category as string) || null,
      has_spa: hasSpa,
      facilities: amenities.join(', ') || null,
      property_website: extractDomain(item.website as string),
      generic_email: (item.email as string) || null,
    }
  }).filter((h: HotelData) => {
    if (!h.hotel_name) return false
    // TripAdvisor mostly returns "hotel" category; just ensure no non-hotels slip in
    if (h.property_type && h.property_type !== 'hotel') return false
    // Star filter (client-side since TripAdvisor API has no star filter)
    if (targetStarFloat !== null && h.stars !== targetStarFloat) return false
    return true
  })

  // Cap at user's requested max
  const hotels = allHotels.slice(0, maxItems)

  await appendLog(admin, searchId, `✓ ${hotels.length} hotels match ${starsFilter}-star filter`)

  // Save to Supabase
  if (hotels.length > 0) {
    const rows = hotels.map((h) => ({
      search_id: searchId,
      hotel_name: h.hotel_name,
      hotel_chain: h.hotel_chain,
      stars: h.stars,
      rating: h.rating,
      rating_label: h.rating_label,
      reviews: h.reviews,
      full_address: h.full_address,
      city: h.city,
      country: h.country,
      url: h.url,
      property_type: h.property_type,
      has_spa: h.has_spa,
      facilities: h.facilities,
      // TripAdvisor gives us website + email directly — pre-fill basic enrichment
      property_website: h.property_website,
      generic_email: h.generic_email,
      enrichment_status: (h.property_website || h.generic_email) ? 'basic' : 'none',
    }))
    await admin.from('scrape_results').insert(rows)
  }
  await admin.from('scrape_searches').update({ result_count: hotels.length }).eq('id', searchId)

  return hotels
}

/* ═══════════ Basic Enrichment (Perplexity) ═══════════ */

async function enrichBasic(hotel: { hotel_name: string; city: string | null; country: string | null }) {
  const prompt = `You are a data enrichment assistant. Given a hotel, return ONLY a valid JSON object with no other text.

Hotel: ${hotel.hotel_name}
City: ${hotel.city}
Country: ${hotel.country}

Return this exact JSON structure:
{"company_name": "...", "property_website": "...", "chain_website": "...", "linkedin_url": "...", "generic_email": "..."}

CRITICAL RULES:
company_name: The SPECIFIC PROPERTY name as it appears on LinkedIn, NOT the parent corporation.
- Example: for "The Signature at MGM Grand" → "MGM Grand Las Vegas", NOT "MGM Resorts International"
property_website: The WEBSITE DOMAIN for THIS specific property (just the domain, no https://, no www.).
- Example: "mgmgrand.com", "grandhoteltremezzo.com". Null if no unique domain.
chain_website: The PARENT CHAIN domain. Example: "mgmresorts.com", "hilton.com". Null if independent.
linkedin_url: LinkedIn company page for THIS property. Null if not found.
generic_email: Public contact email (info@, reservations@, spa@). Null if not found.

Do NOT wrap in markdown. ONLY return the JSON object.`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'perplexity/sonar', messages: [{ role: 'user', content: prompt }], max_tokens: 300 }),
  })
  const data = await res.json()
  const empty = { company_name: null, property_website: null, chain_website: null, linkedin_url: null, generic_email: null }
  if (data.error) return empty
  const content = data.choices?.[0]?.message?.content || '{}'
  try {
    const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const cleanDomain = (d: string | null) => d?.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').trim() || null
    parsed.property_website = cleanDomain(parsed.property_website)
    parsed.chain_website = cleanDomain(parsed.chain_website)
    return parsed
  } catch {
    return empty
  }
}

async function runBasicEnrichment(admin: SupabaseClient, searchId: string, hotels: Array<{ id: string; hotel_name: string; city: string | null; country: string | null; property_website?: string | null; generic_email?: string | null }>) {
  await appendLog(admin, searchId, ``)
  await appendLog(admin, searchId, `── PHASE: Company Enrichment (Perplexity) ──`)
  const total = hotels.length

  for (let i = 0; i < total; i++) {
    const hotel = hotels[i]
    await setProgress(admin, searchId, 'Company Enrichment', i + 1, total)
    await appendLog(admin, searchId, `[${i + 1}/${total}] ${hotel.hotel_name}`)

    try {
      const data = await enrichBasic(hotel)
      if (!data.company_name) {
        await appendLog(admin, searchId, `  ✗ Company not found`)
      } else {
        // Prefer TripAdvisor's website/email if already set; only fall back to Perplexity
        const finalPropertyWebsite = hotel.property_website || data.property_website
        const finalEmail = hotel.generic_email || data.generic_email
        await appendLog(admin, searchId, `  ✓ ${data.company_name}${finalPropertyWebsite ? ` | ${finalPropertyWebsite}` : ''}`)
        await admin.from('scrape_results').update({
          company_name: data.company_name,
          property_website: finalPropertyWebsite,
          chain_website: data.chain_website,
          linkedin_company_url: data.linkedin_url,
          generic_email: finalEmail,
          enrichment_status: 'basic',
        }).eq('id', hotel.id)
      }
    } catch (e) {
      await appendLog(admin, searchId, `  ✗ Error: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }
}

/* ═══════════ Advanced Enrichment (Apollo + AI) ═══════════ */

async function findOrganizationByDomain(domain: string) {
  const res = await fetch(
    `https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`,
    { headers: { 'X-Api-Key': APOLLO_KEY } }
  )
  const data = await res.json()
  const org = data.organization
  if (!org || !org.id) return null
  return { id: org.id, name: org.name, linkedin_url: org.linkedin_url || null }
}

async function findOrganizationByName(companyName: string) {
  const res = await fetch('https://api.apollo.io/api/v1/mixed_companies/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify({ q_organization_keyword_tags: [companyName], page: 1, per_page: 5 }),
  })
  const data = await res.json()
  const orgs = data.organizations || []
  if (orgs.length === 0) return null
  const withLI = orgs.find((o: { linkedin_url?: string }) => o.linkedin_url) || orgs[0]
  return { id: withLI.id, name: withLI.name, linkedin_url: withLI.linkedin_url || null }
}

async function searchApolloPeople(org: { id: string }) {
  const res = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify({ organization_ids: [org.id], page: 1, per_page: 50 }),
  })
  const data = await res.json()
  return (data.people || []).map((p: Record<string, unknown>) => ({
    id: p.id, first_name: p.first_name, last_name_obfuscated: p.last_name_obfuscated, title: p.title,
  }))
}

async function pickDecisionMakers(employees: Array<{ first_name: string; last_name_obfuscated: string; title: string }>, hotelName: string) {
  const employeeList = employees.map((e, i) => `${i + 1}. ${e.first_name} ${e.last_name_obfuscated} - ${e.title}`).join('\n')
  const prompt = `You are a B2B sales strategist for corporate wellness services (sound healing, breathwork, meditation).

Employees at "${hotelName}":
${employeeList}

Pick the TOP 3 people most likely to approve a corporate wellness partnership. Consider: spa directors, wellness managers, general managers, directors of operations, F&B directors, event/guest experience managers.

Return ONLY a valid JSON array:
[{"index": 1, "reason": "..."}, ...]

index = employee number in the list. Return fewer than 3 if not enough relevant people exist. ONLY return the JSON array.`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'anthropic/claude-haiku-4-5', messages: [{ role: 'user', content: prompt }], max_tokens: 400 }),
  })
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || '[]'
  try {
    return JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
  } catch {
    return []
  }
}

/* Hunter.io fallback - 1 credit per domain search, returns up to 10 people with emails */
async function hunterDomainSearch(domain: string) {
  const res = await fetch(
    `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${HUNTER_KEY}&limit=10`
  )
  const data = await res.json()
  if (data.errors) return { emails: [], organization: null }
  const emails = (data.data?.emails || []).map((e: Record<string, unknown>) => ({
    email: e.value,
    first_name: e.first_name,
    last_name: e.last_name,
    position: e.position,
    department: e.department,
    seniority: e.seniority,
    linkedin: e.linkedin,
    confidence: e.confidence,
    type: e.type, // 'personal' or 'generic'
  }))
  return { emails, organization: data.data?.organization }
}

async function enrichPerson(personId: string) {
  const res = await fetch('https://api.apollo.io/api/v1/people/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify({ id: personId, reveal_personal_emails: false, reveal_phone_number: false }),
  })
  const data = await res.json()
  const p = data.person || {}
  return {
    first_name: p.first_name || '',
    last_name: p.last_name || '',
    full_name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
    title: p.title || '',
    email: p.email || null,
    linkedin_url: p.linkedin_url || null,
    photo_url: p.photo_url || null,
  }
}

/* Hunter.io fallback flow - takes a domain, returns decision makers with emails */
async function hunterFallback(
  admin: SupabaseClient,
  searchId: string,
  hotel: { id: string; hotel_name: string; property_website: string | null; chain_website: string | null }
): Promise<Array<Record<string, unknown>>> {
  const domain = hotel.property_website || hotel.chain_website
  if (!domain) {
    await appendLog(admin, searchId, `  ✗ No domain available for Hunter.io fallback`)
    return []
  }

  await appendLog(admin, searchId, `  → Fallback: Hunter.io domain search (${domain}) [1 Hunter credit]`)
  const { emails, organization } = await hunterDomainSearch(domain)

  if (emails.length === 0) {
    await appendLog(admin, searchId, `  ✗ Hunter.io: no emails found for ${domain}`)
    return []
  }

  await appendLog(admin, searchId, `  ✓ Hunter.io found ${emails.length} emails at ${organization || domain}`)

  // Only use personal emails (not generic info@, reservations@)
  const personalEmails = emails.filter((e: Record<string, unknown>) => e.type === 'personal' && e.first_name && e.last_name)
  if (personalEmails.length === 0) {
    await appendLog(admin, searchId, `  ✗ Hunter.io: only generic emails, no named contacts`)
    return []
  }

  // AI picks top 3 from Hunter's results
  const employeeList = personalEmails.map((e: Record<string, unknown>, i: number) =>
    `${i + 1}. ${e.first_name} ${e.last_name} - ${e.position || 'unknown'}`
  ).join('\n')

  const prompt = `You are a B2B sales strategist for corporate wellness services. Pick the TOP 3 decision makers for approving a corporate wellness partnership.

Employees at "${hotel.hotel_name}":
${employeeList}

Return ONLY valid JSON array: [{"index": 1, "reason": "..."}]. Return fewer if not enough relevant people.`

  const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'anthropic/claude-haiku-4-5', messages: [{ role: 'user', content: prompt }], max_tokens: 400 }),
  })
  const aiData = await aiRes.json()
  let picks: Array<{ index: number; reason: string }> = []
  try {
    picks = JSON.parse((aiData.choices?.[0]?.message?.content || '[]').replace(/```json?\n?/g, '').replace(/```/g, '').trim())
  } catch {}

  if (picks.length === 0) {
    await appendLog(admin, searchId, `  ✗ AI found no suitable decision makers from Hunter results`)
    return []
  }

  const decisionMakers = []
  for (const pick of picks) {
    const person = personalEmails[pick.index - 1] as Record<string, unknown> | undefined
    if (!person) continue
    const fullName = `${person.first_name} ${person.last_name}`.trim()
    await appendLog(admin, searchId, `    ✓ ${fullName} | ${person.email} | via Hunter.io`)
    decisionMakers.push({
      scrape_result_id: hotel.id,
      apollo_id: null,
      first_name: person.first_name,
      last_name: person.last_name,
      full_name: fullName,
      title: person.position || '',
      email: person.email,
      linkedin_url: person.linkedin || null,
      photo_url: null,
      reason: pick.reason,
      enriched: true,
    })
  }

  return decisionMakers
}

async function runAdvancedEnrichment(admin: SupabaseClient, searchId: string) {
  await appendLog(admin, searchId, ``)
  await appendLog(admin, searchId, `── PHASE: Decision Makers (Apollo + AI) ──`)

  // Fetch all results with company_name now set
  const { data: hotels } = await admin
    .from('scrape_results')
    .select('id, hotel_name, company_name, property_website, chain_website')
    .eq('search_id', searchId)
    .not('company_name', 'is', null)

  if (!hotels || hotels.length === 0) {
    await appendLog(admin, searchId, `No enriched hotels available`)
    return
  }

  let creditsUsed = 0
  const total = hotels.length

  for (let i = 0; i < total; i++) {
    const hotel = hotels[i]
    await setProgress(admin, searchId, 'Finding Decision Makers', i + 1, total)
    await appendLog(admin, searchId, `[${i + 1}/${total}] ${hotel.hotel_name}`)

    try {
      // Priority: property domain → chain domain → name
      let org = hotel.property_website ? await findOrganizationByDomain(hotel.property_website) : null
      if (!org && hotel.chain_website) {
        await appendLog(admin, searchId, `  → Trying chain domain: ${hotel.chain_website}`)
        org = await findOrganizationByDomain(hotel.chain_website)
      }
      if (!org && hotel.company_name) {
        await appendLog(admin, searchId, `  → Fallback to name search`)
        org = await findOrganizationByName(hotel.company_name)
      }

      if (!org) {
        await appendLog(admin, searchId, `  ✗ Organization not found on Apollo`)
        const hunterDMs = await hunterFallback(admin, searchId, hotel)
        if (hunterDMs.length > 0) {
          await admin.from('decision_makers').insert(hunterDMs)
          await admin.from('scrape_results').update({ enrichment_status: 'advanced' }).eq('id', hotel.id)
        }
        continue
      }

      await appendLog(admin, searchId, `  ✓ Apollo org: ${org.name}`)

      // Search employees
      const people = await searchApolloPeople(org)
      if (people.length === 0) {
        await appendLog(admin, searchId, `  ✗ No employees found on Apollo`)
        const hunterDMs = await hunterFallback(admin, searchId, hotel)
        if (hunterDMs.length > 0) {
          await admin.from('decision_makers').insert(hunterDMs)
          await admin.from('scrape_results').update({ enrichment_status: 'advanced' }).eq('id', hotel.id)
        }
        continue
      }
      await appendLog(admin, searchId, `  ✓ Found ${people.length} employees`)

      // AI picks top 3
      const picks = await pickDecisionMakers(people, hotel.hotel_name)
      if (picks.length === 0) {
        await appendLog(admin, searchId, `  ✗ AI found no suitable decision makers on Apollo`)
        const hunterDMs = await hunterFallback(admin, searchId, hotel)
        if (hunterDMs.length > 0) {
          await admin.from('decision_makers').insert(hunterDMs)
          await admin.from('scrape_results').update({ enrichment_status: 'advanced' }).eq('id', hotel.id)
        }
        continue
      }

      // Enrich each (1 credit each)
      const decisionMakers = []
      for (const pick of picks) {
        const employee = people[pick.index - 1]
        if (!employee) continue

        await appendLog(admin, searchId, `  → Enriching ${employee.first_name} (${employee.title}) [1 credit]`)
        const person = await enrichPerson(employee.id)
        creditsUsed++

        if (person.email) {
          await appendLog(admin, searchId, `    ✓ ${person.full_name} | ${person.email}`)
        } else {
          await appendLog(admin, searchId, `    ✓ ${person.full_name} | email: not found`)
        }

        decisionMakers.push({
          scrape_result_id: hotel.id,
          apollo_id: employee.id,
          first_name: person.first_name,
          last_name: person.last_name,
          full_name: person.full_name,
          title: person.title,
          email: person.email,
          linkedin_url: person.linkedin_url,
          photo_url: person.photo_url,
          reason: pick.reason,
          enriched: true,
        })
      }

      if (decisionMakers.length > 0) {
        await admin.from('decision_makers').insert(decisionMakers)
        await admin.from('scrape_results').update({ enrichment_status: 'advanced' }).eq('id', hotel.id)
      }
    } catch (e) {
      await appendLog(admin, searchId, `  ✗ Error: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }

  await admin.from('scrape_searches').update({ apollo_credits_used: creditsUsed }).eq('id', searchId)
  await appendLog(admin, searchId, ``)
  await appendLog(admin, searchId, `Apollo credits used: ${creditsUsed}`)
}

/* ═══════════ Main Orchestrator ═══════════ */

async function runPipeline(searchId: string, level: 'none' | 'basic' | 'advanced', meta: { country: string; region: string | null; city: string | null; destination: string; starsFilter: string; propertyType: string; maxItems: number }) {
  const admin = createAdminClient()

  try {
    await appendLog(admin, searchId, `Pipeline started (level: ${level})`)

    // Step 1: TripAdvisor scrape
    const hotels = await runTripAdvisorScrape(
      admin,
      searchId,
      meta.destination,
      meta.starsFilter,
      meta.maxItems
    )

    if (hotels.length === 0) {
      await appendLog(admin, searchId, `No hotels found — stopping`)
      await setStatus(admin, searchId, 'succeeded')
      return
    }

    // Fetch the saved rows to get their IDs (and any pre-enriched fields from TripAdvisor)
    const { data: savedRows } = await admin
      .from('scrape_results')
      .select('id, hotel_name, city, country, property_website, generic_email')
      .eq('search_id', searchId)

    if (level === 'none') {
      await appendLog(admin, searchId, `Skipping enrichment`)
      await setStatus(admin, searchId, 'succeeded')
      return
    }

    // Step 2: Basic enrichment
    if (savedRows) {
      await runBasicEnrichment(admin, searchId, savedRows)
    }

    if (level === 'basic') {
      await setStatus(admin, searchId, 'succeeded')
      return
    }

    // Step 3: Advanced enrichment
    await runAdvancedEnrichment(admin, searchId)
    await setStatus(admin, searchId, 'succeeded')

  } catch (err) {
    await appendLog(admin, searchId, `FATAL: ${err instanceof Error ? err.message : 'unknown error'}`)
    await setStatus(admin, searchId, 'failed')
  }
}

/* ═══════════ Route Handler ═══════════ */

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { enrichmentLevel, meta } = body

  if (!meta) return NextResponse.json({ error: 'Missing meta' }, { status: 400 })
  if (!['none', 'basic', 'advanced'].includes(enrichmentLevel)) {
    return NextResponse.json({ error: 'Invalid enrichmentLevel' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Create search record immediately
  const { data: search, error } = await admin.from('scrape_searches').insert({
    user_id: user.id,
    country: meta.country,
    region: meta.region || null,
    city: meta.city || null,
    destination: meta.destination,
    stars_filter: meta.starsFilter,
    property_type: meta.propertyType,
    sort_by: 'bayesian_review_score',
    currency: 'EUR',
    max_items: meta.maxItems,
    status: 'running',
    enrichment_level: enrichmentLevel,
    enrichment_log: '',
  }).select().single()

  if (error || !search) {
    return NextResponse.json({ error: `DB error: ${error?.message}` }, { status: 500 })
  }

  // Kick off background work - survives response
  after(async () => {
    await runPipeline(search.id, enrichmentLevel, meta)
  })

  return NextResponse.json({ searchId: search.id })
}
