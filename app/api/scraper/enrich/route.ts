import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY!
const APOLLO_KEY = process.env.APOLLO_API_KEY!

function log(action: string, msg: string) {
  console.log(`[ENRICH:${action}] ${msg}`)
}

/* ─── Tier 1: Basic Enrichment (Perplexity Sonar via OpenRouter) ─── */

async function enrichBasic(hotel: { hotel_name: string; city: string; country: string }): Promise<{ company_name: string | null; property_website: string | null; chain_website: string | null; linkedin_url: string | null; generic_email: string | null }> {
  log('basic', `Enriching: ${hotel.hotel_name} (${hotel.city}, ${hotel.country})`)
  const prompt = `You are a data enrichment assistant. Given a hotel, return ONLY a valid JSON object with no other text.

Hotel: ${hotel.hotel_name}
City: ${hotel.city}
Country: ${hotel.country}

Return this exact JSON structure:
{"company_name": "...", "property_website": "...", "chain_website": "...", "linkedin_url": "...", "generic_email": "..."}

CRITICAL RULES:

company_name: The SPECIFIC PROPERTY name as it appears on LinkedIn, NOT the parent corporation.
- Example: for "The Signature at MGM Grand" → "MGM Grand Las Vegas", NOT "MGM Resorts International"
- Example: for "Waldorf Astoria Rome Cavalieri" → "Waldorf Astoria Rome Cavalieri", NOT "Hilton"

property_website: The WEBSITE DOMAIN for THIS specific hotel property (just the domain, no https://, no www., no path).
- Example: "mgmgrand.com" (the MGM Grand hotel domain)
- Example: "grandhoteltremezzo.com" (independent luxury hotel)
- This must be the property's own domain, even if it's a subdomain like "rome.waldorfastoria.com"
- Return null if the property shares a domain with the parent brand and has no unique domain.

chain_website: The PARENT CHAIN/BRAND domain (just the domain).
- Example: "mgmresorts.com" (parent of MGM Grand)
- Example: "hilton.com" (parent of Waldorf Astoria Rome)
- Return null if this hotel is independent with no chain.

linkedin_url: LinkedIn company page for THIS property (linkedin.com/company/...). Null if not found.

generic_email: Public contact email (info@, reservations@, spa@). Null if not found.

Do NOT wrap in markdown code blocks. ONLY return the JSON object.`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'perplexity/sonar',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
    }),
  })

  const data = await res.json()
  const empty = { company_name: null, property_website: null, chain_website: null, linkedin_url: null, generic_email: null }

  if (data.error) {
    log('basic', `OpenRouter error: ${JSON.stringify(data.error)}`)
    return empty
  }

  const content = data.choices?.[0]?.message?.content || '{}'
  log('basic', `Raw response: ${content.substring(0, 300)}`)
  log('basic', `Tokens: ${data.usage?.total_tokens || '?'} | Cost: $${data.usage?.cost || '?'}`)

  try {
    const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    // Clean up domain strings (strip https://, www., trailing slash)
    const cleanDomain = (d: string | null) => {
      if (!d) return null
      return d.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').trim() || null
    }
    parsed.property_website = cleanDomain(parsed.property_website)
    parsed.chain_website = cleanDomain(parsed.chain_website)
    log('basic', `Result: company="${parsed.company_name}" | property=${parsed.property_website} | chain=${parsed.chain_website}`)
    return parsed
  } catch (e) {
    log('basic', `JSON parse failed: ${e}`)
    return empty
  }
}

/* ─── Tier 2a: Apollo People Search (free, no credits) ─── */

/* Step 1: Find the exact Apollo organization by domain (most reliable) */
async function findOrganizationByDomain(domain: string): Promise<{ id: string; name: string; linkedin_url: string | null } | null> {
  log('apollo_org', `Looking up domain: ${domain}`)
  const res = await fetch(
    `https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`,
    { headers: { 'X-Api-Key': APOLLO_KEY } }
  )
  const data = await res.json()
  const org = data.organization

  if (!org || !org.id) {
    log('apollo_org', `✗ No organization found for domain: ${domain}`)
    return null
  }

  log('apollo_org', `✓ ${org.name} (id: ${org.id}, ~${org.estimated_num_employees || '?'} employees)`)
  return { id: org.id, name: org.name, linkedin_url: org.linkedin_url || null }
}

/* Fallback: find by name keyword search */
async function findOrganizationByName(companyName: string): Promise<{ id: string; name: string; linkedin_url: string | null } | null> {
  log('apollo_org', `Fallback: name search for "${companyName}"`)
  const res = await fetch('https://api.apollo.io/api/v1/mixed_companies/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify({ q_organization_keyword_tags: [companyName], page: 1, per_page: 5 }),
  })
  const data = await res.json()
  const orgs = data.organizations || []
  if (orgs.length === 0) return null
  const withLI = orgs.find((o: { linkedin_url?: string }) => o.linkedin_url) || orgs[0]
  log('apollo_org', `✓ ${withLI.name} (id: ${withLI.id})`)
  return { id: withLI.id, name: withLI.name, linkedin_url: withLI.linkedin_url || null }
}

/* Step 2: Search people at the exact organization */
async function searchPeople(
  companyName: string,
  propertyWebsite: string | null,
  chainWebsite: string | null
) {
  log('apollo_search', `Looking for company: "${companyName}"`)

  // Priority 1: Try the property-specific domain
  let org = propertyWebsite ? await findOrganizationByDomain(propertyWebsite) : null

  // Priority 2: Try the chain domain (might give broader results)
  if (!org && chainWebsite) {
    log('apollo_search', `Property domain failed, trying chain: ${chainWebsite}`)
    org = await findOrganizationByDomain(chainWebsite)
  }

  // Priority 3: Fallback to name search
  if (!org) {
    log('apollo_search', `Domain lookups failed, trying name search`)
    org = await findOrganizationByName(companyName)
  }

  if (!org) {
    log('apollo_search', `✗ Could not find organization on Apollo`)
    return []
  }

  // Search people by organization_id
  const res = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify({ organization_ids: [org.id], page: 1, per_page: 50 }),
  })

  const data = await res.json()
  if (data.error) log('apollo_search', `Error: ${JSON.stringify(data.error)}`)
  log('apollo_search', `✓ Found ${data.people?.length || 0} people at ${org.name}`)

  return (data.people || []).map((p: Record<string, unknown>) => ({
    id: p.id,
    first_name: p.first_name,
    last_name_obfuscated: p.last_name_obfuscated,
    title: p.title,
    has_email: p.has_email,
    has_direct_phone: p.has_direct_phone,
  }))
}

/* ─── Tier 2b: AI picks top 3 decision makers ─── */

async function pickDecisionMakers(employees: Array<{ first_name: string; last_name_obfuscated: string; title: string; id: string }>, hotelName: string) {
  const employeeList = employees.map((e, i) =>
    `${i + 1}. ${e.first_name} ${e.last_name_obfuscated} - ${e.title}`
  ).join('\n')

  const prompt = `You are a B2B sales strategist for corporate wellness services (sound healing, breathwork, meditation programs for hotels and resorts).

Here are all employees found at "${hotelName}":
${employeeList}

Pick the TOP 3 people who are most likely to be decision makers for approving a corporate wellness partnership or adding wellness services to this hotel/resort. Consider: spa directors, wellness managers, general managers, directors of operations, F&B directors, event managers.

Return ONLY a valid JSON array with no other text:
[{"index": 1, "reason": "short reason why this person"}, {"index": 2, "reason": "..."}, {"index": 3, "reason": "..."}]

The index refers to the employee number in the list above. If fewer than 3 relevant people exist, return fewer. ONLY return the JSON array.`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
    }),
  })

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || '[]'

  try {
    const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return []
  }
}

/* ─── Tier 2c: Apollo Enrich by ID (costs 1 credit per person) ─── */

async function enrichPerson(personId: string) {
  log('apollo_enrich', `Enriching person ID: ${personId} [COSTS 1 CREDIT]`)
  const res = await fetch('https://api.apollo.io/api/v1/people/match', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': APOLLO_KEY,
    },
    body: JSON.stringify({
      id: personId,
      reveal_personal_emails: false,
      reveal_phone_number: false,
    }),
  })

  const data = await res.json()
  const p = data.person || {}
  log('apollo_enrich', `Result: ${p.first_name} ${p.last_name} | email: ${p.email || 'none'} | linkedin: ${p.linkedin_url || 'none'}`)
  return {
    first_name: p.first_name || '',
    last_name: p.last_name || '',
    full_name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
    title: p.title || '',
    email: p.email || null,
    linkedin_url: p.linkedin_url || null,
    photo_url: p.photo_url || null,
    city: p.city || '',
    state: p.state || '',
    country: p.country || '',
    headline: p.headline || '',
  }
}

/* ─── API Route Handler ─── */

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, hotel, companyName, propertyWebsite, chainWebsite, employees, hotelName, personId } = await req.json()

  switch (action) {
    case 'basic': {
      // Tier 1: Perplexity enrichment
      const result = await enrichBasic(hotel)
      return NextResponse.json(result)
    }

    case 'search_people': {
      // Tier 2a: Apollo free people search (uses domain for precise org match)
      const people = await searchPeople(companyName, propertyWebsite || null, chainWebsite || null)
      return NextResponse.json({ people })
    }

    case 'pick_decision_makers': {
      // Tier 2b: AI picks top 3
      const picks = await pickDecisionMakers(employees, hotelName)
      return NextResponse.json({ picks })
    }

    case 'enrich_person': {
      // Tier 2c: Apollo enrich by ID (costs 1 credit)
      const person = await enrichPerson(personId)
      return NextResponse.json({ person })
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}
