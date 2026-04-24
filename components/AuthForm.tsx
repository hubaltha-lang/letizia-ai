'use client'

import { useState, useTransition } from 'react'
import { signIn } from '@/app/actions/auth'

export default function AuthForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await signIn(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-4">
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
        {isPending ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
