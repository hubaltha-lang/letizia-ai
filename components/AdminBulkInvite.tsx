'use client'

import { useState, useRef } from 'react'
import { Upload, Download, Play, Square, CheckCircle, XCircle, Clock } from 'lucide-react'

interface Entry {
  email: string
  status: 'pending' | 'sending' | 'sent' | 'error' | 'skipped'
  error?: string
}

const DELAY_OPTIONS = [
  { label: '30 sec', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
]

function parseCSV(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^["']|["']$/g, '').toLowerCase())
    .filter((l) => l && l !== 'email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l))
}

function downloadTemplate() {
  const blob = new Blob(['email\nexample1@domain.com\nexample2@domain.com\n'], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'invite-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminBulkInvite() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [running, setRunning] = useState(false)
  const [delay, setDelay] = useState(120)
  const [countdown, setCountdown] = useState(0)
  const abortRef = useRef(false)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function handleFile(file: File) {
    file.text().then((text) => {
      const emails = parseCSV(text)
      setEntries(emails.map((email) => ({ email, status: 'pending' })))
    })
  }

  function updateEntry(index: number, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)))
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      let elapsed = 0
      tickRef.current = setInterval(() => {
        if (abortRef.current) {
          clearInterval(tickRef.current!)
          setCountdown(0)
          resolve()
          return
        }
        elapsed += 1000
        setCountdown(Math.ceil((ms - elapsed) / 1000))
        if (elapsed >= ms) {
          clearInterval(tickRef.current!)
          setCountdown(0)
          resolve()
        }
      }, 1000)
    })
  }

  async function start() {
    abortRef.current = false
    setRunning(true)

    for (let i = 0; i < entries.length; i++) {
      if (abortRef.current) break
      if (entries[i].status === 'sent' || entries[i].status === 'skipped') continue

      updateEntry(i, { status: 'sending', error: undefined })

      let status: Entry['status'] = 'pending'
      let error: string | undefined

      try {
        const res = await fetch('/api/admin/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: entries[i].email }),
        })
        const json = await res.json()

        if (res.status === 409) {
          status = 'skipped'
          error = 'Already a user'
        } else if (!res.ok) {
          status = 'error'
          error = json.error ?? 'Failed'
        } else {
          status = 'sent'
        }
      } catch {
        status = 'error'
        error = 'Network error'
      }

      if (!abortRef.current) updateEntry(i, { status, error })

      // Wait between sends — skip delay after last one
      const hasMore = entries.slice(i + 1).some((e) => e.status !== 'sent' && e.status !== 'skipped')
      if (hasMore && !abortRef.current) {
        await sleep(delay * 1000)
      }
    }

    setRunning(false)
    setCountdown(0)
  }

  function stop() {
    abortRef.current = true
    if (tickRef.current) clearInterval(tickRef.current)
    setRunning(false)
    setCountdown(0)
    setEntries((prev) =>
      prev.map((e) => (e.status === 'sending' ? { ...e, status: 'pending' } : e))
    )
  }

  const pending = entries.filter((e) => e.status === 'pending').length
  const sent = entries.filter((e) => e.status === 'sent').length
  const errors = entries.filter((e) => e.status === 'error').length
  const skipped = entries.filter((e) => e.status === 'skipped').length
  const remaining = entries.filter((e) => e.status === 'pending' || e.status === 'error').length
  const etaMin = Math.ceil((remaining * delay) / 60)

  const inputCls =
    'bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#C5A059]/50 transition-colors'

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-white/60 text-xs uppercase tracking-widest">Bulk invite — 7-day trial</h2>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 text-white/35 hover:text-[#C5A059] text-xs transition-colors"
        >
          <Download size={11} /> Download CSV template
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
        {/* Drop zone — shown when list is empty */}
        {!entries.length && (
          <label className="flex flex-col items-center justify-center border border-dashed border-white/15 rounded-xl py-10 cursor-pointer hover:border-[#C5A059]/40 hover:bg-[#C5A059]/3 transition-all group">
            <Upload size={20} className="text-white/20 group-hover:text-[#C5A059]/50 mb-2 transition-colors" />
            <p className="text-white/40 text-xs">Click to upload CSV</p>
            <p className="text-white/20 text-[10px] mt-1">One email per row · first row must be: email</p>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        )}

        {entries.length > 0 && (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Counters */}
              <div className="flex gap-3 text-xs">
                <span className="text-white/40">{entries.length} total</span>
                {sent > 0 && <span className="text-[#C5A059]">{sent} sent</span>}
                {skipped > 0 && <span className="text-white/30">{skipped} skipped</span>}
                {errors > 0 && <span className="text-red-400">{errors} errors</span>}
                {pending > 0 && <span className="text-white/30">{pending} pending</span>}
              </div>

              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {/* Countdown */}
                {running && countdown > 0 && (
                  <span className="text-white/30 text-xs tabular-nums">next in {countdown}s</span>
                )}

                {/* Delay + ETA */}
                {!running && (
                  <>
                    <select
                      value={delay}
                      onChange={(e) => setDelay(Number(e.target.value))}
                      className={`${inputCls} cursor-pointer appearance-none`}
                    >
                      {DELAY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value} className="bg-[#1A2C41]">
                          {o.label} between sends
                        </option>
                      ))}
                    </select>
                    {remaining > 0 && (
                      <span className="text-white/20 text-xs">~{etaMin} min ETA</span>
                    )}
                  </>
                )}

                {/* Action buttons */}
                {!running ? (
                  <button
                    onClick={start}
                    disabled={remaining === 0}
                    className="flex items-center gap-1.5 bg-[#C5A059] hover:bg-[#d4af6a] disabled:opacity-40 disabled:cursor-not-allowed text-[#1A2C41] font-semibold text-xs px-4 py-1.5 rounded-lg transition-colors"
                  >
                    <Play size={11} />
                    {sent > 0 && remaining > 0 ? 'Resume' : 'Start sending'}
                  </button>
                ) : (
                  <button
                    onClick={stop}
                    className="flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 text-red-400 text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
                  >
                    <Square size={11} /> Stop
                  </button>
                )}

                {!running && (
                  <button
                    onClick={() => setEntries([])}
                    className="text-white/20 hover:text-white/45 text-xs transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {entries.length > 0 && (sent + skipped) > 0 && (
              <div className="h-0.5 bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#C5A059] transition-all duration-700"
                  style={{ width: `${((sent + skipped) / entries.length) * 100}%` }}
                />
              </div>
            )}

            {/* Email list */}
            <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
              {entries.map((e, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                    e.status === 'sending'
                      ? 'bg-[#C5A059]/10 border border-[#C5A059]/20'
                      : 'bg-white/3'
                  }`}
                >
                  <span
                    className={
                      e.status === 'sent' || e.status === 'skipped'
                        ? 'text-white/30 line-through'
                        : e.status === 'error'
                        ? 'text-red-400'
                        : e.status === 'sending'
                        ? 'text-white'
                        : 'text-white/55'
                    }
                  >
                    {e.email}
                  </span>
                  <span className="flex items-center gap-1 flex-shrink-0 ml-3">
                    {e.status === 'sent' && (
                      <>
                        <CheckCircle size={11} className="text-[#C5A059]" />
                        <span className="text-[#C5A059]">Sent</span>
                      </>
                    )}
                    {e.status === 'skipped' && (
                      <span className="text-white/25">Already registered</span>
                    )}
                    {e.status === 'error' && (
                      <>
                        <XCircle size={11} className="text-red-400" />
                        <span className="text-red-400">{e.error}</span>
                      </>
                    )}
                    {e.status === 'sending' && (
                      <span className="text-[#C5A059] animate-pulse">Sending…</span>
                    )}
                    {e.status === 'pending' && <Clock size={10} className="text-white/20" />}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Domain status note */}
      <p className="text-white/20 text-[10px] leading-relaxed">
        Domain status: SPF ✓ · DKIM ✓ · sending from altha-community.com via Mailgun.
        {' '}Sending 1 email every {delay >= 60 ? `${delay / 60} min` : `${delay}s`} to protect domain reputation.
        {' '}You can safely increase speed to 1/min for this list size.
      </p>
    </section>
  )
}
