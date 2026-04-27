'use client'

import { useState, useTransition } from 'react'
import { signIn, claimInvite } from '@/app/actions/auth'

interface Props {
  inviteEmail?: string | null
  inviteToken?: string | null
}

export default function AuthForm({ inviteEmail, inviteToken }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isInvite = !!inviteEmail && !!inviteToken

  async function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = isInvite ? await claimInvite(formData) : await signIn(formData)
      if (result?.error) setError(result.error)
    })
  }

  const inputCls =
    'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#1A2C41] placeholder:text-[#1A2C41]/30 focus:outline-none focus:border-[#C5A059]/60 transition-colors'

  if (isInvite) {
    return (
      <form action={handleSubmit} className="space-y-4">
        <div className="text-center mb-6">
          <p className="text-[#1A2C41] font-semibold text-base">You've been invited!</p>
          <p className="text-[#1A2C41]/45 text-sm mt-1">Set a password to activate your 7-day free trial.</p>
        </div>

        <input type="hidden" name="token" value={inviteToken} />

        <div>
          <label className="block text-xs text-[#1A2C41]/50 uppercase tracking-wider mb-2">Email</label>
          <input
            name="email"
            type="email"
            value={inviteEmail}
            readOnly
            className={`${inputCls} opacity-60 cursor-not-allowed`}
          />
        </div>

        <div>
          <label className="block text-xs text-[#1A2C41]/50 uppercase tracking-wider mb-2">Choose a password</label>
          <input
            name="password"
            type="password"
            placeholder="at least 6 characters"
            required
            minLength={6}
            autoFocus
            className={inputCls}
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-[#C5A059] hover:bg-[#d4af6a] text-[#1A2C41] font-semibold py-3 rounded-xl transition-all duration-200 text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer"
        >
          {isPending ? 'Creating your account…' : 'Activate my free trial →'}
        </button>
      </form>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-[#1A2C41]/50 uppercase tracking-wider mb-2">Email</label>
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-xs text-[#1A2C41]/50 uppercase tracking-wider mb-2">Password</label>
        <input
          name="password"
          type="password"
          placeholder="••••••••"
          required
          minLength={6}
          className={inputCls}
        />
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#1A2C41] hover:bg-[#243d5a] text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer"
      >
        {isPending ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}
