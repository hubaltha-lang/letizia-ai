'use client'

export default function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 mb-4">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C5A059] to-[#8B6914] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-sm">
        L
      </div>
      {/* Bubble */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}
