'use client'

import { useState } from 'react'
import { Users, Mail, CheckCircle, Clock, X } from 'lucide-react'
import type { AdminUser, Invite, PlanType } from '@/lib/admin'
import { PLAN_LABELS } from '@/lib/admin'

interface Props {
  initialUsers: AdminUser[]
  initialInvites: Invite[]
}

export default function AdminDashboard({ initialUsers, initialInvites }: Props) {
  const [tab, setTab] = useState<'users' | 'invites'>('users')
  const [users, setUsers] = useState<AdminUser[]>(initialUsers)
  const [invites, setInvites] = useState<Invite[]>(initialInvites)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)

  // Trial invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [inviteError, setInviteError] = useState('')
  const [resendingEmail, setResendingEmail] = useState<string | null>(null)

  // Paid invite state
  const [paidEmail, setPaidEmail] = useState('')
  const [paidPlanType, setPaidPlanType] = useState<'paid_monthly' | 'paid_6month'>('paid_monthly')
  const [paidEndAt, setPaidEndAt] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [paidStatus, setPaidStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [paidError, setPaidError] = useState('')

  const trialUsers = users.filter((u) => u.plan_type === 'trial').length
  const paidUsers = users.filter((u) => u.plan_type === 'paid_monthly' || u.plan_type === 'paid_6month').length
  const pendingInvites = invites.filter((i) => !i.accepted_at).length

  async function handleResendInvite(email: string) {
    setResendingEmail(email)
    await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setResendingEmail(null)
  }

  async function handleSendInvite() {
    if (!inviteEmail.trim()) return
    setInviteStatus('sending')
    setInviteError('')

    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    })
    const json = await res.json()

    if (!res.ok) {
      setInviteStatus('error')
      setInviteError(json.error ?? 'Failed to send invite')
      return
    }

    setInviteStatus('sent')
    setInviteEmail('')
    setInvites((prev) => {
      const exists = prev.find((i) => i.email === json.invite.email)
      if (exists) return prev.map((i) => (i.email === json.invite.email ? json.invite : i))
      return [json.invite, ...prev]
    })
    setTimeout(() => setInviteStatus('idle'), 3000)
  }

  async function handleSendPaidInvite() {
    if (!paidEmail.trim()) return
    setPaidStatus('sending')
    setPaidError('')

    const res = await fetch('/api/admin/invite-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: paidEmail.trim(), planType: paidPlanType, planEndAt: paidEndAt }),
    })
    const json = await res.json()

    if (!res.ok) {
      setPaidStatus('error')
      setPaidError(json.error ?? 'Failed to send invite')
      return
    }

    setPaidStatus('sent')
    setPaidEmail('')
    setInvites((prev) => {
      const exists = prev.find((i) => i.email === json.invite.email)
      if (exists) return prev.map((i) => (i.email === json.invite.email ? json.invite : i))
      return [json.invite, ...prev]
    })
    setTimeout(() => setPaidStatus('idle'), 3000)
  }

  function handlePlanSaved(updated: AdminUser) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    setEditingUser(null)
  }

  const inputCls =
    'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#C5A059]/50 transition-colors'

  return (
    <div className="min-h-screen bg-[#111E2B] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[#C5A059] tracking-widest uppercase font-light text-xl" style={{ fontFamily: 'var(--font-playfair)' }}>
            Letizia
          </span>
          <span className="text-white/20 text-sm">·</span>
          <span className="text-white/40 text-sm tracking-wider uppercase">Admin</span>
        </div>
        <a href="/dashboard" className="text-white/30 hover:text-white/60 text-xs transition-colors">
          ← Back to app
        </a>
      </header>

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total users', value: users.length, icon: <Users size={16} /> },
            { label: 'On trial', value: trialUsers, icon: <Clock size={16} /> },
            { label: 'Paid', value: paidUsers, icon: <CheckCircle size={16} /> },
            { label: 'Pending invites', value: pendingInvites, icon: <Mail size={16} /> },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl px-5 py-4">
              <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
                {stat.icon}
                <span>{stat.label}</span>
              </div>
              <p className="text-2xl font-semibold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/10">
          {(['users', 'invites'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs uppercase tracking-widest transition-colors ${
                tab === t
                  ? 'text-[#C5A059] border-b border-[#C5A059] -mb-px'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {t === 'users' ? 'Users' : 'Invites'}
            </button>
          ))}
        </div>

        {tab === 'users' && (
          <section>
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {['User', 'Joined', 'Plan', 'Trial', 'Paid plan', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-white/35 text-xs font-medium uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <UserRow key={user.id} user={user} onEdit={() => setEditingUser(user)} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'invites' && (
          <div className="space-y-8">
            {/* Trial invite */}
            <section>
              <h2 className="text-white/60 text-xs uppercase tracking-widest mb-3">Send 7-day trial invite</h2>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                    placeholder="email@example.com"
                    className={`flex-1 ${inputCls}`}
                  />
                  <button
                    onClick={handleSendInvite}
                    disabled={inviteStatus === 'sending' || !inviteEmail.trim()}
                    className="bg-[#C5A059] hover:bg-[#d4af6a] disabled:opacity-40 text-[#1A2C41] font-semibold text-sm px-5 py-2 rounded-lg transition-colors"
                  >
                    {inviteStatus === 'sending' ? 'Sending…' : inviteStatus === 'sent' ? 'Sent ✓' : 'Send invite'}
                  </button>
                </div>
                {inviteStatus === 'error' && <p className="text-red-400 text-xs">{inviteError}</p>}
              </div>
            </section>

            {/* Paid invite */}
            <section>
              <h2 className="text-white/60 text-xs uppercase tracking-widest mb-3">Send paid invite</h2>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="email"
                    value={paidEmail}
                    onChange={(e) => setPaidEmail(e.target.value)}
                    placeholder="email@example.com"
                    className={inputCls}
                  />
                  <select
                    value={paidPlanType}
                    onChange={(e) => {
                      const t = e.target.value as 'paid_monthly' | 'paid_6month'
                      setPaidPlanType(t)
                      const d = new Date()
                      if (t === 'paid_6month') d.setMonth(d.getMonth() + 6)
                      else d.setMonth(d.getMonth() + 1)
                      setPaidEndAt(d.toISOString().slice(0, 10))
                    }}
                    className={`${inputCls} cursor-pointer appearance-none`}
                  >
                    <option value="paid_monthly" className="bg-[#1A2C41]">Monthly Plan</option>
                    <option value="paid_6month" className="bg-[#1A2C41]">6-Month Plan</option>
                  </select>
                  <input
                    type="date"
                    value={paidEndAt}
                    onChange={(e) => setPaidEndAt(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSendPaidInvite}
                    disabled={paidStatus === 'sending' || !paidEmail.trim()}
                    className="bg-[#C5A059] hover:bg-[#d4af6a] disabled:opacity-40 text-[#1A2C41] font-semibold text-sm px-5 py-2 rounded-lg transition-colors"
                  >
                    {paidStatus === 'sending' ? 'Sending…' : paidStatus === 'sent' ? 'Sent ✓' : 'Send paid invite'}
                  </button>
                  <span className="text-white/25 text-xs">Access until {paidEndAt || '—'}</span>
                </div>
                {paidStatus === 'error' && <p className="text-red-400 text-xs">{paidError}</p>}
              </div>
            </section>

            {/* All invites log */}
            {invites.length > 0 && (
              <section>
                <h2 className="text-white/60 text-xs uppercase tracking-widest mb-3">Invite log</h2>
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        {['Email', 'Plan', 'Invited', 'Status', ''].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-white/30 text-xs font-medium uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((inv) => (
                        <tr key={inv.id} className="border-b border-white/5 last:border-0">
                          <td className="px-4 py-2.5 text-white/70">{inv.email}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${inv.plan_type === 'trial' ? 'text-yellow-400' : 'text-green-400'}`}>
                              {PLAN_LABELS[inv.plan_type] ?? inv.plan_type}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-white/40 text-xs">{formatDate(inv.invited_at)}</td>
                          <td className="px-4 py-2.5">
                            {inv.accepted_at ? (
                              <span className="inline-flex items-center gap-1 text-[#C5A059] text-xs">
                                <CheckCircle size={11} /> Accepted {formatDate(inv.accepted_at)}
                              </span>
                            ) : (
                              <span className="text-white/35 text-xs">Pending</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {!inv.accepted_at && (
                              <button
                                onClick={() => handleResendInvite(inv.email)}
                                disabled={resendingEmail === inv.email}
                                className="text-white/30 hover:text-[#C5A059] text-xs transition-colors disabled:opacity-40"
                              >
                                {resendingEmail === inv.email ? 'Sending…' : 'Resend'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Plan edit modal */}
      {editingUser && (
        <PlanModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={handlePlanSaved}
        />
      )}
    </div>
  )
}

function UserRow({ user, onEdit }: { user: AdminUser; onEdit: () => void }) {
  const planColor: Record<PlanType, string> = {
    none: 'text-white/30',
    trial: 'text-yellow-400',
    paid_monthly: 'text-green-400',
    paid_6month: 'text-emerald-400',
  }

  return (
    <tr className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
      <td className="px-4 py-3">
        <p className="text-white text-sm">{user.full_name || user.display_name || '—'}</p>
        <p className="text-white/35 text-xs">{user.email}</p>
      </td>
      <td className="px-4 py-3 text-white/40 text-xs">{formatDate(user.created_at)}</td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium ${planColor[user.plan_type]}`}>
          {PLAN_LABELS[user.plan_type]}
        </span>
      </td>
      <td className="px-4 py-3 text-white/35 text-xs">
        {user.trial_start_at && user.trial_end_at
          ? `${formatDate(user.trial_start_at)} → ${formatDate(user.trial_end_at)}`
          : '—'}
      </td>
      <td className="px-4 py-3 text-white/35 text-xs">
        {user.plan_start_at
          ? `${formatDate(user.plan_start_at)}${user.plan_end_at ? ` → ${formatDate(user.plan_end_at)}` : ' (monthly)'}`
          : '—'}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={onEdit}
          className="text-white/30 hover:text-[#C5A059] text-xs transition-colors cursor-pointer"
        >
          Edit plan
        </button>
      </td>
    </tr>
  )
}

function PlanModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser
  onClose: () => void
  onSaved: (u: AdminUser) => void
}) {
  const today = new Date().toISOString().slice(0, 10)

  function defaultEnd(type: PlanType, start: string): string {
    const d = new Date(start)
    if (type === 'trial') d.setDate(d.getDate() + 7)
    else if (type === 'paid_monthly') d.setMonth(d.getMonth() + 1)
    else if (type === 'paid_6month') d.setMonth(d.getMonth() + 6)
    return d.toISOString().slice(0, 10)
  }

  const [planType, setPlanType] = useState<PlanType>(user.plan_type)
  const [trialStart, setTrialStart] = useState(user.trial_start_at?.slice(0, 10) ?? today)
  const [trialEnd, setTrialEnd] = useState(user.trial_end_at?.slice(0, 10) ?? defaultEnd('trial', today))
  const [planStart, setPlanStart] = useState(user.plan_start_at?.slice(0, 10) ?? today)
  const [planEnd, setPlanEnd] = useState(user.plan_end_at?.slice(0, 10) ?? defaultEnd('paid_monthly', today))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleTypeChange(type: PlanType) {
    setPlanType(type)
    if (type === 'trial') setTrialEnd(defaultEnd('trial', trialStart))
    else if (type !== 'none') setPlanEnd(defaultEnd(type, planStart))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/update-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        plan_type: planType,
        trial_start_at: planType === 'trial' ? trialStart : null,
        trial_end_at: planType === 'trial' ? trialEnd : null,
        plan_start_at: (planType === 'paid_monthly' || planType === 'paid_6month') ? planStart : null,
        plan_end_at: (planType === 'paid_monthly' || planType === 'paid_6month') ? planEnd : null,
      }),
    })

    setSaving(false)
    if (!res.ok) {
      const j = await res.json()
      setError(j.error ?? 'Failed to save')
      return
    }

    onSaved({
      ...user,
      plan_type: planType,
      trial_start_at: planType === 'trial' ? `${trialStart}T00:00:00Z` : null,
      trial_end_at: planType === 'trial' ? `${trialEnd}T00:00:00Z` : null,
      plan_start_at: (planType === 'paid_monthly' || planType === 'paid_6month') ? `${planStart}T00:00:00Z` : null,
      plan_end_at: (planType === 'paid_monthly' || planType === 'paid_6month') ? `${planEnd}T00:00:00Z` : null,
    })
  }

  const inputCls =
    'w-full bg-white/8 border border-white/15 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#C5A059]/50 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#111E2B]/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#1A2C41] border border-white/10 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-white font-semibold text-sm">{user.full_name || user.display_name || user.email}</p>
            <p className="text-white/35 text-xs">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-white/50 text-[10px] uppercase tracking-wider mb-1.5">Plan type</label>
            <select
              value={planType}
              onChange={(e) => handleTypeChange(e.target.value as PlanType)}
              className={`${inputCls} cursor-pointer appearance-none`}
            >
              {(Object.entries(PLAN_LABELS) as [PlanType, string][]).map(([v, l]) => (
                <option key={v} value={v} className="bg-[#1A2C41]">{l}</option>
              ))}
            </select>
          </div>

          {planType === 'trial' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-white/50 text-[10px] uppercase tracking-wider mb-1.5">Trial start</label>
                <input type="date" value={trialStart} onChange={(e) => setTrialStart(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-white/50 text-[10px] uppercase tracking-wider mb-1.5">Trial end</label>
                <input type="date" value={trialEnd} onChange={(e) => setTrialEnd(e.target.value)} className={inputCls} />
              </div>
            </div>
          )}

          {(planType === 'paid_monthly' || planType === 'paid_6month') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-white/50 text-[10px] uppercase tracking-wider mb-1.5">Plan start</label>
                <input type="date" value={planStart} onChange={(e) => setPlanStart(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-white/50 text-[10px] uppercase tracking-wider mb-1.5">
                  {planType === 'paid_monthly' ? 'Next renewal' : 'Plan end'}
                </label>
                <input type="date" value={planEnd} onChange={(e) => setPlanEnd(e.target.value)} className={inputCls} />
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#C5A059] hover:bg-[#d4af6a] disabled:opacity-50 text-[#1A2C41] font-semibold text-sm py-2.5 rounded-xl transition-colors"
          >
            {saving ? 'Saving…' : 'Save plan'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
