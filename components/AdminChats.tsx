'use client'

import { useState, useEffect } from 'react'
import { X, MessageSquare, ChevronRight } from 'lucide-react'
import type { AdminUser } from '@/lib/admin'

interface Session {
  id: string
  module_id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

const MODULE_NAMES: Record<string, string> = {
  'general-letizia': 'Letizia AI',
  'b2b-pitcher': 'B2B Pitcher',
  'linkedin-networker': 'LinkedIn',
  'social-media': 'Social Media',
  'business-coach': 'Business Coach',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function AdminChats({ users }: { users: AdminUser[] }) {
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  useEffect(() => {
    if (!selectedUser) { setSessions([]); return }
    setLoadingSessions(true)
    setSelectedSession(null)
    setMessages([])
    fetch(`/api/admin/chats?userId=${selectedUser.id}`)
      .then((r) => r.json())
      .then((j) => setSessions(j.sessions ?? []))
      .finally(() => setLoadingSessions(false))
  }, [selectedUser])

  useEffect(() => {
    if (!selectedSession) { setMessages([]); return }
    setLoadingMessages(true)
    fetch(`/api/admin/chats/${selectedSession.id}`)
      .then((r) => r.json())
      .then((j) => setMessages(j.messages ?? []))
      .finally(() => setLoadingMessages(false))
  }, [selectedSession])

  return (
    <div className="flex gap-4 min-h-[520px]">
      {/* User list */}
      <div className="w-56 flex-shrink-0 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <p className="text-white/40 text-[10px] uppercase tracking-widest px-4 py-3 border-b border-white/10">
          Users
        </p>
        <div className="overflow-y-auto max-h-[480px]">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelectedUser(u)}
              className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0 transition-colors ${
                selectedUser?.id === u.id
                  ? 'bg-[#C5A059]/15 border-l-2 border-l-[#C5A059]'
                  : 'hover:bg-white/5'
              }`}
            >
              <p className="text-white text-xs font-medium truncate">
                {u.full_name || u.display_name || u.email.split('@')[0]}
              </p>
              <p className="text-white/35 text-[10px] truncate">{u.email}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Sessions list */}
      <div className="w-64 flex-shrink-0 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <p className="text-white/40 text-[10px] uppercase tracking-widest px-4 py-3 border-b border-white/10">
          {selectedUser ? `${selectedUser.full_name || selectedUser.display_name || selectedUser.email}'s chats` : 'Select a user'}
        </p>
        <div className="overflow-y-auto max-h-[480px]">
          {loadingSessions && (
            <p className="text-white/30 text-xs px-4 py-4">Loading…</p>
          )}
          {!loadingSessions && selectedUser && sessions.length === 0 && (
            <p className="text-white/30 text-xs px-4 py-4">No conversations yet.</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSession(s)}
              className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0 transition-colors group ${
                selectedSession?.id === s.id
                  ? 'bg-[#C5A059]/15 border-l-2 border-l-[#C5A059]'
                  : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-white/80 text-xs leading-snug line-clamp-2 flex-1">{s.title || 'Untitled'}</p>
                <ChevronRight size={12} className="text-white/20 group-hover:text-white/40 flex-shrink-0 mt-0.5" />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-white/30 text-[10px]">{MODULE_NAMES[s.module_id] ?? s.module_id}</span>
                <span className="text-white/20 text-[10px]">·</span>
                <span className="text-white/30 text-[10px] flex items-center gap-0.5">
                  <MessageSquare size={9} /> {s.message_count}
                </span>
                <span className="text-white/20 text-[10px]">·</span>
                <span className="text-white/25 text-[10px]">{fmt(s.updated_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col">
        {!selectedSession ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/20 text-sm">Select a conversation to read it</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <div>
                <p className="text-white text-sm font-medium">{selectedSession.title || 'Untitled'}</p>
                <p className="text-white/35 text-xs">{MODULE_NAMES[selectedSession.module_id] ?? selectedSession.module_id} · {fmt(selectedSession.created_at)}</p>
              </div>
              <button onClick={() => setSelectedSession(null)} className="text-white/30 hover:text-white/60">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[440px]">
              {loadingMessages && <p className="text-white/30 text-xs">Loading messages…</p>}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-[#C5A059]/20 text-white/90 rounded-br-sm'
                        : 'bg-white/8 text-white/75 rounded-bl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className={`text-[10px] mt-1.5 ${m.role === 'user' ? 'text-white/30 text-right' : 'text-white/25'}`}>
                      {m.role === 'user' ? 'User' : 'Letizia AI'} · {fmtTime(m.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
