'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AdminUser } from '@/lib/admin'

interface UserUsage {
  user_id: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  api_calls: number
  sessions: number
  last_at: string | null
}

type Preset = 'today' | '7d' | 'month' | 'custom'

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date()
  const to = toDateStr(now)
  if (preset === 'today') return { from: to, to }
  if (preset === '7d') {
    const from = new Date(now)
    from.setDate(from.getDate() - 6)
    return { from: toDateStr(from), to }
  }
  if (preset === 'month') {
    return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to }
  }
  return { from: to, to }
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtCost(n: number) {
  if (n === 0) return '$0.00'
  if (n < 0.01) return '<$0.01'
  return `$${n.toFixed(3)}`
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const PRESET_LABELS: Record<Preset, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  month: 'This month',
  custom: 'Custom',
}

export default function AdminUsage({ users }: { users: AdminUser[] }) {
  const [preset, setPreset] = useState<Preset>('month')
  const [customFrom, setCustomFrom] = useState(toDateStr(new Date()))
  const [customTo, setCustomTo] = useState(toDateStr(new Date()))
  const [rows, setRows] = useState<UserUsage[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsage = useCallback((from: string, to: string) => {
    setLoading(true)
    fetch(`/api/admin/usage?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((j) => setRows(j.byUser ?? []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (preset !== 'custom') {
      const { from, to } = presetRange(preset)
      fetchUsage(from, to)
    }
  }, [preset, fetchUsage])

  function handlePreset(p: Preset) {
    setPreset(p)
  }

  function handleCustomApply() {
    fetchUsage(customFrom, customTo)
  }

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  const totals = rows.reduce(
    (acc, r) => ({
      input_tokens: acc.input_tokens + r.input_tokens,
      output_tokens: acc.output_tokens + r.output_tokens,
      cost_usd: acc.cost_usd + r.cost_usd,
      api_calls: acc.api_calls + r.api_calls,
      sessions: acc.sessions + r.sessions,
    }),
    { input_tokens: 0, output_tokens: 0, cost_usd: 0, api_calls: 0, sessions: 0 }
  )

  const inputCls = 'bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#C5A059]/50 transition-colors'

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => handlePreset(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              preset === p
                ? 'bg-[#C5A059] text-[#1A2C41]'
                : 'bg-white/5 border border-white/10 text-white/50 hover:text-white/70 hover:bg-white/8'
            }`}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}

        {preset === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className={inputCls}
            />
            <span className="text-white/30 text-xs">→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className={inputCls}
            />
            <button
              onClick={handleCustomApply}
              className="bg-[#C5A059] hover:bg-[#d4af6a] text-[#1A2C41] font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-white/30 text-sm py-8 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-white/30 text-sm py-8 text-center">No usage data for this period.</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Cost', value: fmtCost(totals.cost_usd) },
              { label: 'API calls', value: totals.api_calls.toLocaleString() },
              { label: 'Input tokens', value: fmtTokens(totals.input_tokens) },
              { label: 'Output tokens', value: fmtTokens(totals.output_tokens) },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{s.label}</p>
                <p className="text-white text-xl font-semibold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Per-user table */}
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['User', 'Sessions', 'API calls', 'Input tokens', 'Output tokens', 'Cost', 'Last active'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-white/35 text-xs font-medium uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const u = userMap[r.user_id]
                  return (
                    <tr key={r.user_id} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-white text-xs">{u?.full_name || u?.display_name || '—'}</p>
                        <p className="text-white/35 text-[10px]">{u?.email ?? r.user_id.slice(0, 8) + '…'}</p>
                      </td>
                      <td className="px-4 py-3 text-white/50 text-xs">{r.sessions}</td>
                      <td className="px-4 py-3 text-white/50 text-xs">{r.api_calls.toLocaleString()}</td>
                      <td className="px-4 py-3 text-white/50 text-xs">{fmtTokens(r.input_tokens)}</td>
                      <td className="px-4 py-3 text-white/50 text-xs">{fmtTokens(r.output_tokens)}</td>
                      <td className="px-4 py-3 text-[#C5A059] text-xs font-medium">{fmtCost(r.cost_usd)}</td>
                      <td className="px-4 py-3 text-white/35 text-xs whitespace-nowrap">{fmt(r.last_at)}</td>
                    </tr>
                  )
                })}
                <tr className="border-t border-white/15 bg-white/3">
                  <td className="px-4 py-3 text-white/60 text-xs font-semibold uppercase tracking-wider">Total</td>
                  <td className="px-4 py-3 text-white/60 text-xs font-semibold">{totals.sessions}</td>
                  <td className="px-4 py-3 text-white/60 text-xs font-semibold">{totals.api_calls.toLocaleString()}</td>
                  <td className="px-4 py-3 text-white/60 text-xs font-semibold">{fmtTokens(totals.input_tokens)}</td>
                  <td className="px-4 py-3 text-white/60 text-xs font-semibold">{fmtTokens(totals.output_tokens)}</td>
                  <td className="px-4 py-3 text-[#C5A059] text-xs font-bold">{fmtCost(totals.cost_usd)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
