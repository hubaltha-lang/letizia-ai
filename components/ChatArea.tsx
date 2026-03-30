'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Send } from 'lucide-react'
import { getModule, type ModuleId } from '@/lib/modules'
import { createClient } from '@/lib/supabase/client'
import { buildProfileContext, type UserProfile } from '@/lib/profile'
import ChatMessage from './ChatMessage'
import SuggestedPrompts from './SuggestedPrompts'
import TypingIndicator from './TypingIndicator'
import type { Message, ChatSession } from '@/lib/types'

interface Props {
  userId: string
  activeModuleId: ModuleId
  activeSession: ChatSession | null
  messages: Message[]
  isStreaming: boolean
  streamingContent: string
  profile: UserProfile
  onMessagesUpdate: (msgs: Message[]) => void
  onSessionCreated: (session: ChatSession) => void
  onSessionUpdated: (session: ChatSession) => void
  onStreamingChange: (streaming: boolean, content: string) => void
}

export default function ChatArea({
  userId,
  activeModuleId,
  activeSession,
  messages,
  isStreaming,
  streamingContent,
  profile,
  onMessagesUpdate,
  onSessionCreated,
  onSessionUpdated,
  onStreamingChange,
}: Props) {
  const module = getModule(activeModuleId)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming, streamingContent])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return
    setInput('')

    const supabase = createClient()
    let sessionId = activeSession?.id ?? null
    let currentSession = activeSession

    // Create session if needed
    if (!sessionId) {
      const { data: newSession, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: userId,
          module_id: activeModuleId,
          title: text.slice(0, 60) + (text.length > 60 ? '...' : ''),
        })
        .select()
        .single()

      if (error || !newSession) {
        console.error('Failed to create session', error)
        return
      }
      sessionId = newSession.id
      currentSession = newSession
      onSessionCreated(newSession)
    }

    // Save user message to Supabase
    const { data: userMsg, error: msgError } = await supabase
      .from('messages')
      .insert({ session_id: sessionId, role: 'user', content: text })
      .select()
      .single()

    if (msgError || !userMsg) {
      console.error('Failed to save user message', msgError)
      return
    }

    const updatedMessages = [...messages, userMsg]
    onMessagesUpdate(updatedMessages)

    // Stream AI response
    onStreamingChange(true, '')

    try {
      const apiMessages = updatedMessages.map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          moduleId: activeModuleId,
          profileContext: buildProfileContext(profile),
        }),
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullContent += decoder.decode(value, { stream: true })
        onStreamingChange(true, fullContent)
      }

      // Save final AI message to Supabase
      const { data: aiMsg } = await supabase
        .from('messages')
        .insert({ session_id: sessionId, role: 'assistant', content: fullContent })
        .select()
        .single()

      // Update session title if still default and update updated_at
      const { data: updatedSession } = await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .select()
        .single()

      if (aiMsg) onMessagesUpdate([...updatedMessages, aiMsg])
      if (updatedSession) onSessionUpdated(updatedSession)
    } catch (err) {
      console.error('Streaming error', err)
    } finally {
      onStreamingChange(false, '')
    }
  }, [activeSession, activeModuleId, userId, messages, isStreaming, onMessagesUpdate, onSessionCreated, onSessionUpdated, onStreamingChange])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0 && !isStreaming

  // Build display messages (real + streaming placeholder)
  const displayMessages = isStreaming && streamingContent
    ? [
        ...messages,
        {
          id: 'streaming',
          session_id: activeSession?.id ?? '',
          role: 'assistant' as const,
          content: streamingContent,
          created_at: new Date().toISOString(),
        },
      ]
    : messages

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100">
        <h2
          className="text-xl font-light text-[#C5A059] tracking-wide"
          style={{ fontFamily: 'var(--font-playfair)' }}
        >
          {module.icon} {module.name}
        </h2>
        <p className="text-[#1A2C41]/50 text-xs mt-0.5">{module.description}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto chat-scroll bg-white">
        {isEmpty ? (
          <SuggestedPrompts module={module} onSelect={(p) => sendMessage(p)} />
        ) : (
          <div className="px-6 py-6 max-w-3xl mx-auto">
            {displayMessages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isStreaming && !streamingContent && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
        {!isEmpty && <div ref={bottomRef} />}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-[#C5A059]/60 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Letizia..."
              rows={1}
              disabled={isStreaming}
              className="w-full bg-transparent text-[#1A2C41] text-sm placeholder:text-[#1A2C41]/30 resize-none focus:outline-none disabled:opacity-50 max-h-32 overflow-y-auto"
              style={{ lineHeight: '1.5' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 128) + 'px'
              }}
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="w-11 h-11 rounded-full bg-[#C5A059] hover:bg-[#d4af6a] flex items-center justify-center flex-shrink-0 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-[#C5A059]/20"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
        <p className="text-center text-[#1A2C41]/20 text-xs mt-2">
          Shift+Enter for new line · Enter to send
        </p>
      </div>
    </div>
  )
}
