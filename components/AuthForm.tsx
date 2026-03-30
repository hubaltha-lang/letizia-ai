'use client'

import { useState, useTransition } from 'react'
import { signIn, signUp } from '@/app/actions/auth'

export default function AuthForm() {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const action = tab === 'signin' ? signIn : signUp
      const result = await action(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex border border-gray-200 rounded-xl p-1 mb-8 bg-gray-50">
        {(['signin', 'signup'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(null) }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer ${
              tab === t
                ? 'bg-[#C5A059] text-white shadow-sm'
                : 'text-[#1A2C41]/50 hover:text-[#1A2C41]'
            }`}
          >
            {t === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        ))}
      </div>

      <form action={handleSubmit} className="space-y-4">
        {tab === 'signup' && (
          <div>
            <label className="block text-xs text-[#1A2C41]/50 uppercase tracking-wider mb-2">
              Your Name & Role
            </label>
            <input
              name="display_name"
              type="text"
              placeholder="e.g. Sarah | Corporate Sound Healer"
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#1A2C41] placeholder:text-[#1A2C41]/30 focus:outline-none focus:border-[#C5A059]/60 transition-colors"
            />
          </div>
        )}

        <div>
          <label className="block text-xs text-[#1A2C41]/50 uppercase tracking-wider mb-2">
            Email
          </label>
          <input
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#1A2C41] placeholder:text-[#1A2C41]/30 focus:outline-none focus:border-[#C5A059]/60 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs text-[#1A2C41]/50 uppercase tracking-wider mb-2">
            Password
          </label>
          <input
            name="password"
            type="password"
            placeholder="••••••••"
            required
            minLength={6}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#1A2C41] placeholder:text-[#1A2C41]/30 focus:outline-none focus:border-[#C5A059]/60 transition-colors"
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-[#1A2C41] hover:bg-[#243d5a] text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer"
        >
          {isPending
            ? tab === 'signin' ? 'Signing in...' : 'Creating account...'
            : tab === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-[#1A2C41]/40 text-xs mt-6">
        {tab === 'signin'
          ? "Don't have an account? "
          : 'Already have an account? '}
        <button
          onClick={() => { setTab(tab === 'signin' ? 'signup' : 'signin'); setError(null) }}
          className="text-[#C5A059] hover:text-[#d4af6a] transition-colors cursor-pointer"
        >
          {tab === 'signin' ? 'Create one' : 'Sign in'}
        </button>
      </p>
    </div>
  )
}
