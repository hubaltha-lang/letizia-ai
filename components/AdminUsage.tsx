'use client'

import { useState, useEffect } from 'react'
import type { AdminUser } from '@/lib/admin'

interface UserUsage {
  user_id: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  cost_today: number
  api_calls: number
  sessions: number
  last_at: string | null
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

export default function AdminUsage({ users }: { users: AdminUser[] }) {
  const [rows, setRows] = useState<UserUsage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/usage')
      .then((r) => r.json())
      .then((j) => setRows(j.byUser ?? []))
      .finally(() => setLoading(false))
  }, [])

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  const totals = rows.reduce(
    (acc, r) => ({
      input_tokens: acc.input_tokens + r.input_tokens,
      output_tokens: acc.output_tokens + r.output_tokens,
      cost_usd: acc.cost_usd + r.cost_usd,
      cost_today: acc.cost_today + r.cost_today,
      api_calls: acc.api_calls + r.api_calls,
      sessions: acc.sessions + r.sessions,
    }),
    { input_tokens: 0, output_tokens: 0, cost_usd: 0, cost_today: 0, api_calls: 0, sessions: 0 }
  )

  if (loading) {
    return <p className="text-white/30 text-sm py-8 text-center">Loading usage data…</p>
  }

  if (rows.length === 0) {
    return <p className="text-white/30 text-sm py-8 text-center">No usage data yet.</p>
  }

  const cols = ['User', 'Sessions', 'API calls', 'Input tokens', 'Output tokens', 'Cost today', 'Total cost', 'Last active']

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total cost', value: fmtCost(totals.cost_usd) },
          { label: 'Cost today', value: fmtCost(totals.cost_today) },
          { label: 'Total API calls', value: totals.api_calls.toLocaleString() },
          { label: 'Total sessions', value: totals.sessions.toLocaleString() },
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
              {cols.map((h) => (
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
                  <td className="px-4 py-3 text-xs">
                    <span className={r.cost_today > 0.5 ? 'text-yellow-400' : 'text-white/50'}>
                      {fmtCost(r.cost_today)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#C5A059] text-xs font-medium">{fmtCost(r.cost_usd)}</td>
                  <td className="px-4 py-3 text-white/35 text-xs whitespace-nowrap">{fmt(r.last_at)}</td>
                </tr>
              )
            })}
            {/* Totals row */}
            <tr className="border-t border-white/15 bg-white/3">
              <td className="px-4 py-3 text-white/60 text-xs font-semibold uppercase tracking-wider">Total</td>
              <td className="px-4 py-3 text-white/60 text-xs font-semibold">{totals.sessions}</td>
              <td className="px-4 py-3 text-white/60 text-xs font-semibold">{totals.api_calls.toLocaleString()}</td>
              <td className="px-4 py-3 text-white/60 text-xs font-semibold">{fmtTokens(totals.input_tokens)}</td>
              <td className="px-4 py-3 text-white/60 text-xs font-semibold">{fmtTokens(totals.output_tokens)}</td>
              <td className="px-4 py-3 text-white/60 text-xs font-semibold">{fmtCost(totals.cost_today)}</td>
              <td className="px-4 py-3 text-[#C5A059] text-xs font-bold">{fmtCost(totals.cost_usd)}</td>
              <td className="px-4 py-3" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
