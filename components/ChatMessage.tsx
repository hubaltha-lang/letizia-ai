'use client'

import type { Message } from '@/lib/types'

interface Props {
  message: Message
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%]">
          <div className="bg-[#1A2C41] rounded-2xl rounded-br-sm px-4 py-3">
            <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
          <p className="text-[#1A2C41]/30 text-xs mt-1 text-right">{formatTime(message.created_at)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-3 mb-4">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C5A059] to-[#8B6914] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-sm">
        L
      </div>
      {/* Bubble */}
      <div className="max-w-[75%]">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
          <p className="text-[#1A2C41] text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className="text-[#1A2C41]/30 text-xs mt-1">{formatTime(message.created_at)}</p>
      </div>
    </div>
  )
}
