'use client'

import type { Module } from '@/lib/modules'

interface Props {
  module: Module
  onSelect: (prompt: string) => void
}

export default function SuggestedPrompts({ module, onSelect }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12">
      {/* Logo mark */}
      <div className="mb-2 w-16 h-16 rounded-full bg-gradient-to-br from-[#C5A059] to-[#8B6914] flex items-center justify-center shadow-xl shadow-[#C5A059]/20">
        <span className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-playfair)' }}>L</span>
      </div>

      {/* Greeting */}
      <h2 className="text-[#1A2C41] text-xl font-light text-center mt-4 mb-1 tracking-wide" style={{ fontFamily: 'var(--font-playfair)' }}>
        {module.greeting}
      </h2>
      <p className="text-[#1A2C41]/40 text-sm text-center mb-10 max-w-md">
        Select a prompt below or type your own message to begin.
      </p>

      {/* Suggested prompt cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
        {module.suggestedPrompts.map((p, i) => (
          <button
            key={i}
            onClick={() => onSelect(p.body)}
            className="group relative text-left bg-white border border-gray-200 rounded-xl p-4 transition-all duration-200 hover:border-[#C5A059]/60 hover:shadow-md hover:shadow-[#C5A059]/10 cursor-pointer"
          >
            {/* Gold top accent line on hover */}
            <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-[#C5A059]/0 to-transparent group-hover:via-[#C5A059]/80 transition-all duration-300" />
            <p className="text-[#1A2C41] text-sm font-medium mb-1">{p.title}</p>
            <p className="text-[#1A2C41]/50 text-xs leading-relaxed">{p.body}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
