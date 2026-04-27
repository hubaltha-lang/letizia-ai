'use client'

import ReactMarkdown from 'react-markdown'
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
          <div className="text-[#1A2C41] text-sm leading-relaxed letizia-markdown">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#C5A059] underline hover:text-[#8B6914]"
                  >
                    {children}
                  </a>
                ),
                code: ({ children }) => (
                  <code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[0.85em] font-mono">
                    {children}
                  </code>
                ),
                h1: ({ children }) => <h1 className="text-base font-semibold mb-1.5 mt-2 first:mt-0">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-[#C5A059]/40 pl-3 italic text-[#1A2C41]/80 my-2">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
        <p className="text-[#1A2C41]/30 text-xs mt-1">{formatTime(message.created_at)}</p>
      </div>
    </div>
  )
}
