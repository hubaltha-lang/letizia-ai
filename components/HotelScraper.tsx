'use client'

import { useState, useCallback, useMemo, useEffect, Fragment } from 'react'
import { Country, State, City } from 'country-state-city'
import { createClient } from '@/lib/supabase/client'
import {
  Search,
  Download,
  Loader2,
  Hotel,
  Star,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Plus,
  Clock,
  ArrowLeft,
  Trash2,
  Sparkles,
  Users,
  Mail,
  Building2,
} from 'lucide-react'

/* ─── Types ─── */

interface HotelResult {
  id?: string // Supabase row ID
  hotel_name: string
  hotel_chain: string
  stars: number
  rating: number
  rating_label: string
  reviews: number
  full_address: string
  city: string
  country: string
  url: string
  type: string
  has_spa: boolean
  facilities: string
  // Basic enrichment
  company_name?: string | null
  property_website?: string | null
  chain_website?: string | null
  linkedin_company_url?: string | null
  generic_email?: string | null
  enrichment_status?: 'none' | 'basic' | 'advanced'
  // Advanced enrichment
  decision_makers?: DecisionMaker[]
}

interface DecisionMaker {
  id?: string
  apollo_id?: string
  first_name?: string
  last_name?: string
  full_name?: string
  title?: string
  email?: string | null
  linkedin_url?: string | null
  photo_url?: string | null
  reason?: string
  enriched?: boolean
}

interface SavedSearch {
  id: string
  country: string
  region: string | null
  city: string | null
  destination: string
  stars_filter: string
  property_type: string
  sort_by: string
  currency: string
  max_items: number
  result_count: number
  status: 'running' | 'succeeded' | 'failed'
  enrichment_level?: 'none' | 'basic' | 'advanced'
  enrichment_log?: string
  enrichment_progress?: { phase: string; current: number; total: number }
  apollo_credits_used?: number
  created_at: string
}

type ScraperTab = 'new' | 'history' | 'results'

/* ─── Constants ─── */

const STAR_OPTIONS = ['any', '1', '2', '3', '4', '5', 'unrated'] as const
const PROPERTY_TYPES = [
  { value: 'Hotels', label: 'Hotels (recommended)' },
  { value: 'Resorts', label: 'Resorts' },
  { value: 'none', label: 'All Types (incl. B&Bs, apartments)' },
  { value: 'Apartments', label: 'Apartments' },
  { value: 'Villas', label: 'Villas' },
  { value: 'Hostels', label: 'Hostels' },
  { value: 'Guest houses', label: 'Guest Houses' },
  { value: 'Bed and breakfasts', label: 'B&Bs' },
  { value: 'Holiday homes', label: 'Holiday Homes' },
  { value: 'Holiday parks', label: 'Holiday Parks' },
  { value: 'Motels', label: 'Motels' },
] as const

const ALL_COUNTRIES = Country.getAllCountries()

/* ─── Helpers ─── */

function extractHotel(item: Record<string, unknown>): HotelResult {
  const addr = item.address as Record<string, string> | string | undefined
  let fullAddr = '', city = '', country = ''
  if (typeof addr === 'object' && addr !== null) {
    fullAddr = addr.full || ''
    city = addr.city || ''
    country = addr.country || ''
  } else if (typeof addr === 'string') {
    fullAddr = addr
  }

  const facGroups = (item.facilities || []) as Array<Record<string, unknown>>
  const facNames: string[] = []
  for (const group of facGroups) {
    if (Array.isArray(group.facilities)) {
      for (const f of group.facilities as Array<Record<string, string>>) {
        facNames.push(f.name || '')
      }
    }
  }

  const hasSpa = facNames.some(
    (n) => /spa|wellness|sauna|massage|steam|hammam|jacuzzi|hot tub|thermal/i.test(n)
  )

  return {
    hotel_name: (item.name as string) || '',
    hotel_chain: (item.hotelChain as string) || '',
    stars: (item.stars as number) || 0,
    rating: (item.rating as number) || 0,
    rating_label: (item.ratingLabel as string) || '',
    reviews: (item.reviews as number) || 0,
    full_address: fullAddr,
    city,
    country: country.toUpperCase(),
    url: (item.url as string) || '',
    type: (item.type as string) || '',
    has_spa: hasSpa,
    facilities: facNames.join(', '),
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ─── Results Table (shared) ─── */

function ResultsTable({
  results,
  filterSpaOnly,
  setFilterSpaOnly,
  onExportCSV,
  onBasicEnrich,
  onAdvancedEnrich,
  enrichingIds,
}: {
  results: HotelResult[]
  filterSpaOnly: boolean
  setFilterSpaOnly: (v: boolean) => void
  onExportCSV: () => void
  onBasicEnrich?: (hotel: HotelResult, index: number) => void
  onAdvancedEnrich?: (hotel: HotelResult, index: number) => void
  enrichingIds?: Set<number>
}) {
  const displayResults = filterSpaOnly ? results.filter((r) => r.has_spa) : results
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-[#1A2C41]">
            {displayResults.length} Hotels Found
            {filterSpaOnly && ` (${results.length} total)`}
          </h3>
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={filterSpaOnly}
              onChange={(e) => setFilterSpaOnly(e.target.checked)}
              className="rounded border-gray-300 text-[#C5A059] focus:ring-[#C5A059]"
            />
            Spa/Wellness only
          </label>
        </div>
        <div className="flex items-center gap-2">
          {onBasicEnrich && (
            <button
              onClick={() => displayResults.forEach((h, i) => {
                if (!h.company_name) onBasicEnrich(h, i)
              })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1A2C41] text-white rounded-lg hover:bg-[#243a54] cursor-pointer"
            >
              <Building2 size={12} />
              Enrich All (Basic)
            </button>
          )}
          {onAdvancedEnrich && (
            <button
              onClick={() => displayResults.forEach((h, i) => {
                if (h.company_name && h.enrichment_status !== 'advanced') onAdvancedEnrich(h, i)
              })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#C5A059] text-black rounded-lg hover:bg-[#d4af6a] cursor-pointer"
            >
              <Users size={12} />
              Enrich All (Advanced)
            </button>
          )}
          <button
            onClick={onExportCSV}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer text-[#1A2C41]"
          >
            <Download size={12} />
            CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Hotel</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Location</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Stars</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Rating</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Spa</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Company</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Contact</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayResults.map((hotel, i) => (
              <Fragment key={i}>
                <tr className="hover:bg-[#C5A059]/5 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-[#1A2C41] text-sm leading-tight">{hotel.hotel_name}</p>
                      {hotel.hotel_chain && <p className="text-xs text-gray-400 mt-0.5">{hotel.hotel_chain}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-1.5">
                      <MapPin size={12} className="text-gray-300 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-[#1A2C41]">{hotel.city}</p>
                        <p className="text-xs text-gray-400">{hotel.country}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {Array.from({ length: hotel.stars }).map((_, j) => (
                        <Star key={j} size={10} className="fill-[#C5A059] text-[#C5A059]" />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      hotel.rating >= 9 ? 'bg-green-100 text-green-700'
                        : hotel.rating >= 8 ? 'bg-blue-100 text-blue-700'
                        : hotel.rating >= 7 ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {hotel.rating}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {hotel.has_spa ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#C5A059]/15 text-[#8B6914]">SPA</span>
                    ) : (
                      <span className="text-gray-300 text-xs">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {hotel.company_name ? (
                      <div>
                        <p className="text-xs font-medium text-[#1A2C41]">{hotel.company_name}</p>
                        {hotel.linkedin_company_url && (
                          <a href={hotel.linkedin_company_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#C5A059] hover:underline">LinkedIn</a>
                        )}
                      </div>
                    ) : enrichingIds?.has(i) ? (
                      <Loader2 size={12} className="animate-spin text-gray-300" />
                    ) : (
                      <span className="text-gray-300 text-xs">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {hotel.generic_email ? (
                      <a href={`mailto:${hotel.generic_email}`} className="text-xs text-[#C5A059] hover:underline flex items-center gap-1">
                        <Mail size={10} />
                        {hotel.generic_email}
                      </a>
                    ) : (
                      <span className="text-gray-300 text-xs">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {!hotel.company_name && onBasicEnrich && (
                        <button onClick={() => onBasicEnrich(hotel, i)} disabled={enrichingIds?.has(i)}
                          className="p-1.5 text-gray-400 hover:text-[#C5A059] hover:bg-[#C5A059]/10 rounded-lg transition-colors cursor-pointer disabled:opacity-30" title="Basic Enrich">
                          <Building2 size={14} />
                        </button>
                      )}
                      {hotel.company_name && hotel.enrichment_status !== 'advanced' && onAdvancedEnrich && (
                        <button onClick={() => onAdvancedEnrich(hotel, i)} disabled={enrichingIds?.has(i)}
                          className="p-1.5 text-gray-400 hover:text-[#C5A059] hover:bg-[#C5A059]/10 rounded-lg transition-colors cursor-pointer disabled:opacity-30" title="Find Decision Makers">
                          <Users size={14} />
                        </button>
                      )}
                      {hotel.decision_makers && hotel.decision_makers.length > 0 && (
                        <button onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                          className="p-1.5 text-[#C5A059] hover:bg-[#C5A059]/10 rounded-lg transition-colors cursor-pointer" title="View Decision Makers">
                          <Sparkles size={14} />
                        </button>
                      )}
                      {hotel.url && (
                        <a href={hotel.url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-[#C5A059] hover:bg-[#C5A059]/10 rounded-lg transition-colors">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
                {/* Expanded decision makers row */}
                {expandedRow === i && hotel.decision_makers && hotel.decision_makers.length > 0 && (
                  <tr key={`${i}-dm`} className="bg-[#1A2C41]/3">
                    <td colSpan={8} className="px-6 py-4">
                      <p className="text-xs font-semibold text-[#1A2C41] mb-3">Top Decision Makers</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {hotel.decision_makers.map((dm, j) => (
                          <div key={j} className="bg-white rounded-lg border border-gray-200 p-3">
                            <div className="flex items-start gap-2">
                              {dm.photo_url ? (
                                <img src={dm.photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-[#C5A059]/20 flex items-center justify-center text-[10px] font-bold text-[#8B6914] flex-shrink-0">
                                  {dm.first_name?.[0]}{dm.last_name?.[0]}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[#1A2C41]">
                                  {dm.enriched ? dm.full_name : `${dm.first_name} ${dm.last_name || ''}`}
                                </p>
                                <p className="text-xs text-gray-500">{dm.title}</p>
                                {dm.email && (
                                  <a href={`mailto:${dm.email}`} className="text-[10px] text-[#C5A059] hover:underline">{dm.email}</a>
                                )}
                                {dm.linkedin_url && (
                                  <a href={dm.linkedin_url} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-[#C5A059] hover:underline">LinkedIn Profile</a>
                                )}
                                {dm.reason && <p className="text-[10px] text-gray-400 mt-1 italic">{dm.reason}</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Main Component ─── */

export default function HotelScraper({ userId }: { userId: string }) {
  const supabase = createClient()
  const [tab, setTab] = useState<ScraperTab>('new')

  // ── Destination state ──
  const [countryCode, setCountryCode] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [cityName, setCityName] = useState('')

  const selectedCountry = useMemo(() => ALL_COUNTRIES.find((c) => c.isoCode === countryCode), [countryCode])
  const states = useMemo(() => (countryCode ? State.getStatesOfCountry(countryCode) : []), [countryCode])
  const selectedState = useMemo(() => states.find((s) => s.isoCode === stateCode), [states, stateCode])
  const cities = useMemo(() => (countryCode && stateCode ? City.getCitiesOfState(countryCode, stateCode) : []), [countryCode, stateCode])

  const countryName = selectedCountry?.name || ''
  const regionName = selectedState?.name || ''
  const destination = [cityName, regionName, countryName].filter(Boolean).join(', ')

  // ── Filter state ──
  const [starsFilter, setStarsFilter] = useState<string>('5')
  const [propertyType, setPropertyType] = useState('Hotels')
  const [maxItems, setMaxItems] = useState(100)
  const [minScore, setMinScore] = useState('')
  const [priceRange, setPriceRange] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [enrichmentLevel, setEnrichmentLevel] = useState<'none' | 'basic' | 'advanced'>('basic')

  // ── Current results state ──
  const [results, setResults] = useState<HotelResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('')
  const [error, setError] = useState('')
  const [filterSpaOnly, setFilterSpaOnly] = useState(false)

  // ── Past searches state ──
  const [pastSearches, setPastSearches] = useState<SavedSearch[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [viewingSearchId, setViewingSearchId] = useState<string | null>(null)
  const [viewingResults, setViewingResults] = useState<HotelResult[]>([])
  const [viewingSearch, setViewingSearch] = useState<SavedSearch | null>(null)
  const [viewingSpaOnly, setViewingSpaOnly] = useState(false)

  // ── Load past searches ──
  const loadPastSearches = useCallback(async () => {
    setLoadingHistory(true)
    const { data } = await supabase
      .from('scrape_searches')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) setPastSearches(data)
    setLoadingHistory(false)
  }, [userId, supabase])

  // ── Load results + decision makers for a search ──
  const loadSearchResults = useCallback(async (searchId: string) => {
    const { data } = await supabase
      .from('scrape_results')
      .select('*, decision_makers(*)')
      .eq('search_id', searchId)
      .order('rating', { ascending: false })

    if (data) {
      setViewingResults(data.map((r) => ({
        id: r.id,
        hotel_name: r.hotel_name,
        hotel_chain: r.hotel_chain || '',
        stars: r.stars || 0,
        rating: Number(r.rating) || 0,
        rating_label: r.rating_label || '',
        reviews: r.reviews || 0,
        full_address: r.full_address || '',
        city: r.city || '',
        country: r.country || '',
        url: r.url || '',
        type: r.property_type || '',
        has_spa: r.has_spa || false,
        facilities: r.facilities || '',
        company_name: r.company_name,
        property_website: r.property_website,
        chain_website: r.chain_website,
        linkedin_company_url: r.linkedin_company_url,
        generic_email: r.generic_email,
        enrichment_status: r.enrichment_status || 'none',
        decision_makers: (r.decision_makers || []).map((dm: Record<string, unknown>) => ({
          id: dm.id,
          apollo_id: dm.apollo_id,
          first_name: dm.first_name,
          last_name: dm.last_name,
          full_name: dm.full_name,
          title: dm.title,
          email: dm.email,
          linkedin_url: dm.linkedin_url,
          photo_url: dm.photo_url,
          reason: dm.reason,
          enriched: dm.enriched,
        })),
      })))
    }
  }, [supabase])

  useEffect(() => {
    loadPastSearches()
  }, [loadPastSearches])

  // ── Live polling when viewing a running search ──
  useEffect(() => {
    if (!viewingSearchId || !viewingSearch || viewingSearch.status !== 'running') return
    const interval = setInterval(async () => {
      const { data } = await supabase.from('scrape_searches').select('*').eq('id', viewingSearchId).single()
      if (!data) return
      setViewingSearch(data)
      // Also refresh results as enrichment progresses
      await loadSearchResults(viewingSearchId)
      if (data.status !== 'running') {
        loadPastSearches()
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [viewingSearchId, viewingSearch, supabase, loadSearchResults, loadPastSearches])

  // ── View a search's results (with live polling if running) ──
  const viewSearch = useCallback(async (search: SavedSearch) => {
    setViewingSearch(search)
    setViewingSearchId(search.id)
    setTab('results')
    await loadSearchResults(search.id)
  }, [loadSearchResults])

  // ── Delete a past search ──
  const deleteSearch = useCallback(async (id: string) => {
    await supabase.from('scrape_results').delete().eq('search_id', id)
    await supabase.from('scrape_searches').delete().eq('id', id)
    setPastSearches((prev) => prev.filter((s) => s.id !== id))
    if (viewingSearchId === id) {
      setTab('history')
      setViewingSearchId(null)
      setViewingResults([])
    }
  }, [supabase, viewingSearchId])

  // ── Run scrape (now server-side orchestrated) ──
  const runScrape = useCallback(async () => {
    if (!countryCode) return

    setIsLoading(true)
    setError('')
    setResults([])
    setLoadingStatus('Starting...')

    const meta = {
      country: countryName,
      region: regionName || null,
      city: cityName || null,
      destination,
      starsFilter,
      propertyType,
      maxItems,
      minScore: minScore || null,
      priceRange: priceRange || null,
    }

    try {
      const res = await fetch('/api/scraper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrichmentLevel, meta }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to start')
      }

      const { searchId } = await res.json()
      // Switch immediately to viewing this search — polling will show live progress
      const { data: newSearch } = await supabase.from('scrape_searches').select('*').eq('id', searchId).single()
      if (newSearch) {
        await viewSearch(newSearch)
      }
      loadPastSearches()
      setLoadingStatus('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [countryCode, destination, maxItems, starsFilter, propertyType, minScore, priceRange, countryName, regionName, cityName, enrichmentLevel, supabase, loadPastSearches, viewSearch])

  // ── CSV export (current or past) ──
  const makeExportCSV = useCallback((data: HotelResult[], spaOnly: boolean, label: string) => {
    return () => {
      const filtered = spaOnly ? data.filter((r) => r.has_spa) : data
      if (filtered.length === 0) return
      const headers = Object.keys(filtered[0])
      const csvRows = [
        headers.join(','),
        ...filtered.map((row) =>
          headers.map((h) => {
            const val = String(row[h as keyof HotelResult] ?? '')
            return `"${val.replace(/"/g, '""')}"`
          }).join(',')
        ),
      ]
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hotels_${label.replace(/[\s,]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [])

  // ── Enrichment state (legacy - now server-side) ──
  const [enrichingIds] = useState<Set<number>>(new Set())

  // Enrichment is now handled server-side via /api/scraper/start

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C5A059] to-[#8B6914] flex items-center justify-center">
              <Hotel size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#1A2C41]" style={{ fontFamily: 'var(--font-playfair)' }}>
                Hotel Scraper
              </h2>
              <p className="text-xs text-gray-400">
                Find hotels and wellness resorts worldwide
              </p>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mt-4 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab('new')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              tab === 'new' ? 'bg-white text-[#1A2C41] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Plus size={14} />
            New Search
          </button>
          <button
            onClick={() => { setTab('history'); loadPastSearches() }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              tab === 'history' || tab === 'results' ? 'bg-white text-[#1A2C41] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock size={14} />
            Past Searches
            {pastSearches.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-[#C5A059]/15 text-[#8B6914] rounded-full text-[10px] font-semibold">
                {pastSearches.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

          {/* ═══ NEW SEARCH TAB ═══ */}
          {tab === 'new' && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-[#1A2C41] mb-4">Search Filters</h3>

                {/* Destination fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Country <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={countryCode}
                      onChange={(e) => { setCountryCode(e.target.value); setStateCode(''); setCityName('') }}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#C5A059] bg-white cursor-pointer"
                    >
                      <option value="">Select country...</option>
                      {ALL_COUNTRIES.map((c) => (
                        <option key={c.isoCode} value={c.isoCode}>{c.flag} {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Region / State <span className="text-gray-300">(optional)</span>
                    </label>
                    <select
                      value={stateCode}
                      onChange={(e) => { setStateCode(e.target.value); setCityName('') }}
                      disabled={!countryCode || states.length === 0}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#C5A059] bg-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">{states.length === 0 ? 'No regions available' : 'All regions'}</option>
                      {states.map((s) => (
                        <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      City <span className="text-gray-300">(optional)</span>
                    </label>
                    <select
                      value={cityName}
                      onChange={(e) => setCityName(e.target.value)}
                      disabled={!stateCode || cities.length === 0}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#C5A059] bg-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">{cities.length === 0 ? 'Select a region first' : 'All cities'}</option>
                      {cities.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {countryCode && (
                  <div className="mb-4 px-3 py-2 bg-[#C5A059]/8 rounded-lg">
                    <p className="text-xs text-[#8B6914]">
                      <span className="font-medium">Searching Booking.com for:</span> {destination}
                    </p>
                    {!stateCode && !cityName && (
                      <p className="text-[10px] text-orange-600 mt-1.5">
                        ⚠ Country-only searches return very few results from Booking.com. Pick a region or city for full results.
                      </p>
                    )}
                  </div>
                )}

                {/* Filter row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Star Rating</label>
                    <select value={starsFilter} onChange={(e) => setStarsFilter(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#C5A059] bg-white cursor-pointer">
                      {STAR_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s === 'any' ? 'Any Stars' : s === 'unrated' ? 'Unrated' : `${s} Stars`}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Property Type</label>
                    <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#C5A059] bg-white cursor-pointer">
                      {PROPERTY_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Max Results</label>
                    <input type="number" value={maxItems} onChange={(e) => setMaxItems(Number(e.target.value))} min={1} max={1000}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/30" />
                  </div>
                </div>

                {/* Advanced filters */}
                <button onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1.5 text-xs text-[#C5A059] font-medium hover:text-[#8B6914] cursor-pointer mb-3">
                  {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Advanced Filters
                </button>

                {showAdvanced && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pt-3 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Min Rating (e.g. 8.0)</label>
                      <input type="text" value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="8.0"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Price Range (e.g. 100-500)</label>
                      <input type="text" value={priceRange} onChange={(e) => setPriceRange(e.target.value)} placeholder="100-500"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/30" />
                    </div>
                  </div>
                )}

                {/* Enrichment Level */}
                <div className="pt-4 mt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-3">Enrichment Level</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* None */}
                    <label className={`cursor-pointer p-3 rounded-xl border-2 transition-all ${
                      enrichmentLevel === 'none' ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input type="radio" name="enrichment" value="none" checked={enrichmentLevel === 'none'}
                        onChange={() => setEnrichmentLevel('none')} className="sr-only" />
                      <div className="flex items-start gap-2">
                        <Download size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-[#1A2C41]">None</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Just the hotel list.</p>
                          <p className="text-[10px] text-green-600 mt-1 font-medium">Free</p>
                        </div>
                      </div>
                    </label>

                    {/* Basic */}
                    <label className={`cursor-pointer p-3 rounded-xl border-2 transition-all ${
                      enrichmentLevel === 'basic' ? 'border-[#1A2C41] bg-[#1A2C41]/3' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input type="radio" name="enrichment" value="basic" checked={enrichmentLevel === 'basic'}
                        onChange={() => setEnrichmentLevel('basic')} className="sr-only" />
                      <div className="flex items-start gap-2">
                        <Building2 size={14} className="text-[#1A2C41] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-[#1A2C41]">Basic</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Company name, LinkedIn, email.</p>
                          <p className="text-[10px] text-[#1A2C41] mt-1 font-medium">~${(maxItems * 0.005).toFixed(2)}</p>
                        </div>
                      </div>
                    </label>

                    {/* Advanced */}
                    <label className={`cursor-pointer p-3 rounded-xl border-2 transition-all ${
                      enrichmentLevel === 'advanced' ? 'border-[#C5A059] bg-[#C5A059]/5' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input type="radio" name="enrichment" value="advanced" checked={enrichmentLevel === 'advanced'}
                        onChange={() => setEnrichmentLevel('advanced')} className="sr-only" />
                      <div className="flex items-start gap-2">
                        <Users size={14} className="text-[#C5A059] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-[#1A2C41]">Advanced</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Basic + top 3 decision makers w/ emails.</p>
                          <p className="text-[10px] text-[#C5A059] mt-1 font-medium">~${(maxItems * 0.005 + maxItems * 3 * 0.04).toFixed(2)}</p>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Action */}
                <div className="flex items-center gap-3 pt-4">
                  <button onClick={runScrape} disabled={isLoading || !countryCode}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#C5A059] hover:bg-[#d4af6a] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-xl text-sm transition-all cursor-pointer">
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    {isLoading ? 'Starting...' : 'Start Scrape'}
                  </button>
                  {loadingStatus && <span className="text-xs text-gray-400">{loadingStatus}</span>}
                  {error && <span className="text-xs text-red-500">{error}</span>}
                </div>
              </div>

            </>
          )}

          {/* ═══ PAST SEARCHES TAB ═══ */}
          {tab === 'history' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-[#1A2C41]">Search History</h3>
              </div>

              {loadingHistory ? (
                <div className="px-5 py-12 text-center">
                  <Loader2 size={20} className="animate-spin text-gray-300 mx-auto" />
                </div>
              ) : pastSearches.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm text-gray-400">No past searches yet.</p>
                  <button onClick={() => setTab('new')}
                    className="mt-3 text-xs text-[#C5A059] font-medium hover:text-[#8B6914] cursor-pointer">
                    Start your first search
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {pastSearches.map((s) => (
                    <div key={s.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                      <button onClick={() => viewSearch(s)} className="flex-1 text-left cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Number(s.stars_filter) || 0 }).map((_, j) => (
                              <Star key={j} size={10} className="fill-[#C5A059] text-[#C5A059]" />
                            ))}
                          </div>
                          <p className="text-sm font-medium text-[#1A2C41]">{s.destination}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            s.status === 'succeeded' ? 'bg-green-100 text-green-700'
                              : s.status === 'failed' ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {s.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-gray-400">{formatDate(s.created_at)}</span>
                          <span className="text-xs text-gray-400">{s.result_count} hotels</span>
                          <span className="text-xs text-gray-400">{s.property_type === 'none' ? 'All types' : s.property_type}</span>
                          <span className="text-xs text-gray-400">{s.currency}</span>
                        </div>
                      </button>
                      <button onClick={() => deleteSearch(s.id)}
                        className="ml-4 p-2 text-gray-300 hover:text-red-500 transition-colors cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ VIEWING PAST RESULTS ═══ */}
          {tab === 'results' && viewingSearch && (
            <>
              <button onClick={() => setTab('history')}
                className="flex items-center gap-1.5 text-xs text-[#C5A059] font-medium hover:text-[#8B6914] cursor-pointer">
                <ArrowLeft size={14} />
                Back to Search History
              </button>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Number(viewingSearch.stars_filter) || 0 }).map((_, j) => (
                      <Star key={j} size={12} className="fill-[#C5A059] text-[#C5A059]" />
                    ))}
                  </div>
                  <h3 className="text-sm font-semibold text-[#1A2C41]">{viewingSearch.destination}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    viewingSearch.status === 'succeeded' ? 'bg-green-100 text-green-700'
                      : viewingSearch.status === 'failed' ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {viewingSearch.status}
                  </span>
                  {viewingSearch.enrichment_level && viewingSearch.enrichment_level !== 'none' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#C5A059]/15 text-[#8B6914]">
                      {viewingSearch.enrichment_level}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {formatDate(viewingSearch.created_at)} &middot; {viewingSearch.result_count} hotels
                  {viewingSearch.apollo_credits_used ? ` · ${viewingSearch.apollo_credits_used} Apollo credits` : ''}
                </p>
              </div>

              {/* Live progress log (when running) */}
              {(viewingSearch.status === 'running' || viewingSearch.enrichment_log) && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                    {viewingSearch.status === 'running' && <Loader2 size={14} className="animate-spin text-[#C5A059]" />}
                    <h3 className="text-sm font-semibold text-[#1A2C41]">
                      {viewingSearch.status === 'running'
                        ? `${viewingSearch.enrichment_progress?.phase || 'Running'}${
                            viewingSearch.enrichment_progress?.total
                              ? ` (${viewingSearch.enrichment_progress.current}/${viewingSearch.enrichment_progress.total})`
                              : ''
                          }`
                        : 'Job Log'}
                    </h3>
                  </div>
                  {viewingSearch.enrichment_log && (
                    <div className="px-5 py-3 max-h-80 overflow-y-auto bg-[#1A2C41] font-mono text-[11px] leading-relaxed">
                      {viewingSearch.enrichment_log.split('\n').map((line, i) => (
                        <div key={i} className={
                          line.includes('✓') ? 'text-green-400' :
                          line.includes('✗') || line.includes('FATAL') ? 'text-red-400' :
                          line.includes('──') ? 'text-[#C5A059] font-bold mt-1' :
                          line.startsWith('    ') || line.includes('  →') ? 'text-gray-500' :
                          'text-gray-300'
                        }>{line}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {viewingResults.length > 0 ? (
                <ResultsTable
                  results={viewingResults}
                  filterSpaOnly={viewingSpaOnly}
                  setFilterSpaOnly={setViewingSpaOnly}
                  onExportCSV={makeExportCSV(viewingResults, viewingSpaOnly, viewingSearch.destination)}
                />
              ) : viewingSearch.status === 'running' ? null : (
                <div className="bg-white rounded-xl border border-gray-200 px-5 py-12 text-center">
                  <p className="text-xs text-gray-400">No results yet.</p>
                </div>
              )}
            </>
          )}

        </div>
      </div>

    </div>
  )
}
