'use client'

import { useState } from 'react'
import { X, User, KeyRound, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { signOut } from '@/app/actions/auth'
import ProfilePanel from './ProfilePanel'
import type { UserProfile } from '@/lib/profile'

interface Props {
  userId: string
  profile: UserProfile
  onProfileChange: (profile: UserProfile) => void
  onClose: () => void
}

type SettingsTab = 'profile' | 'password'

export default function SettingsModal({ userId, profile, onProfileChange, onClose }: Props) {
  const [tab, setTab] = useState<SettingsTab>('profile')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#1A2C41]/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-3xl bg-[#1A2C41] border border-white/10 rounded-2xl shadow-2xl flex overflow-hidden"
        style={{ height: '85vh', maxHeight: '720px' }}
      >
        {/* Left nav */}
        <aside className="w-52 flex-shrink-0 bg-black/20 border-r border-white/10 flex flex-col">
          <div className="px-5 pt-5 pb-4 border-b border-white/10">
            <h2
              className="text-[#C5A059] font-light tracking-widest uppercase text-base"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Settings
            </h2>
          </div>

          <nav className="flex-1 py-3">
            <NavItem
              icon={<User size={14} />}
              label="My Profile"
              active={tab === 'profile'}
              onClick={() => setTab('profile')}
            />
            <NavItem
              icon={<KeyRound size={14} />}
              label="Password"
              active={tab === 'password'}
              onClick={() => setTab('password')}
            />
          </nav>

          <div className="border-t border-white/10 p-3">
            <form action={signOut}>
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/50 hover:bg-white/10 hover:text-white/80 text-xs transition-colors cursor-pointer"
              >
                <LogOut size={14} />
                <span className="font-medium">Sign out</span>
              </button>
            </form>
          </div>
        </aside>

        {/* Right content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-end px-4 pt-4">
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/80 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {tab === 'profile' && (
              <ProfilePanel userId={userId} initial={profile} onChange={onProfileChange} />
            )}
            {tab === 'password' && <PasswordPanel />}
          </div>
        </div>
      </div>
    </div>
  )
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-5 py-2.5 text-xs transition-colors cursor-pointer relative ${
        active ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
      }`}
    >
      {active && <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#C5A059] rounded-full" />}
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  )
}

function PasswordPanel() {
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'saving' }
    | { kind: 'success' }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' })

  const supabase = createClient()

  async function handleSubmit() {
    if (newPassword.length < 8) {
      setStatus({ kind: 'error', message: 'Password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirm) {
      setStatus({ kind: 'error', message: 'Passwords do not match.' })
      return
    }

    setStatus({ kind: 'saving' })
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setStatus({ kind: 'error', message: error.message })
    } else {
      setStatus({ kind: 'success' })
      setNewPassword('')
      setConfirm('')
      setTimeout(() => setStatus({ kind: 'idle' }), 2500)
    }
  }

  const inputCls =
    'w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#C5A059]/50 transition-colors'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 pt-2 pb-4 border-b border-white/10">
        <h3 className="text-white text-sm font-semibold">Change Password</h3>
        <p className="text-white/40 text-xs mt-0.5">
          Update the password you use to sign into your account.
        </p>
      </div>

      <div className="px-5 py-5 space-y-3 max-w-md">
        <div>
          <label className="block text-white/60 text-[10px] uppercase tracking-wider mb-1">
            New password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="at least 8 characters"
            className={inputCls}
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="block text-white/60 text-[10px] uppercase tracking-wider mb-1">
            Confirm new password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="re-enter the new password"
            className={inputCls}
            autoComplete="new-password"
          />
        </div>

        <div className="pt-1">
          <button
            onClick={handleSubmit}
            disabled={status.kind === 'saving' || !newPassword || !confirm}
            className="bg-[#C5A059] hover:bg-[#C5A059]/90 disabled:opacity-40 disabled:cursor-not-allowed text-[#1A2C41] font-semibold text-sm px-5 py-2 rounded-xl transition-colors cursor-pointer"
          >
            {status.kind === 'saving' ? 'Saving…' : 'Update password'}
          </button>
        </div>

        {status.kind === 'success' && (
          <p className="text-[#C5A059] text-xs pt-1">Password updated successfully.</p>
        )}
        {status.kind === 'error' && (
          <p className="text-red-400/90 text-xs pt-1">{status.message}</p>
        )}
      </div>
    </div>
  )
}
