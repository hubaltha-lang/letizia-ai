'use client'

import { signOut } from '@/app/actions/auth'

export default function TrialExpiredModal() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Full backdrop — no click-through */}
      <div className="absolute inset-0 bg-[#0d1a26]/90 backdrop-blur-md" />

      <div className="relative w-full max-w-sm bg-[#1A2C41] border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C5A059" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <h2 className="text-white font-semibold text-lg mb-2">Your trial has ended</h2>
        <p className="text-white/45 text-sm leading-relaxed mb-6">
          Your 7-day free trial has expired.<br />
          Contact the admin to get full access.
        </p>

        <a
          href="mailto:hub.altha@gmail.com?subject=Letizia%20Access%20Request"
          className="block w-full bg-[#C5A059] hover:bg-[#d4af6a] text-[#1A2C41] font-semibold text-sm py-3 rounded-xl transition-colors mb-3"
        >
          Contact admin →
        </a>

        <form action={signOut}>
          <button
            type="submit"
            className="w-full text-white/30 hover:text-white/60 text-xs transition-colors py-2"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
