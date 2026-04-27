'use client'

import { X, Plus, Settings, Hotel } from 'lucide-react'
import { MODULES, type ModuleId } from '@/lib/modules'
import type { ChatSession } from '@/lib/types'
import type { ActiveView } from '@/lib/store'

interface Props {
  displayName: string
  activeModuleId: ModuleId
  activeChatId: string | null
  sessions: ChatSession[]
  onSelectModule: (id: ModuleId) => void
  onSelectChat: (session: ChatSession) => void
  onNewChat: () => void
  activeView: ActiveView
  onClose: () => void
  onOpenSettings: () => void
}

function groupSessionsByDate(sessions: ChatSession[]): { label: string; items: ChatSession[] }[] {
  const now = Date.now()
  const day = 86400000
  const groups: Record<string, ChatSession[]> = { Today: [], Yesterday: [], 'This Week': [], Older: [] }

  sessions.forEach((s) => {
    const age = now - new Date(s.updated_at).getTime()
    if (age < day) groups['Today'].push(s)
    else if (age < 2 * day) groups['Yesterday'].push(s)
    else if (age < 7 * day) groups['This Week'].push(s)
    else groups['Older'].push(s)
  })

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }))
}

export default function Sidebar({
  displayName,
  activeModuleId,
  activeChatId,
  sessions,
  onSelectModule,
  onSelectChat,
  onNewChat,
  activeView,
  onClose,
  onOpenSettings,
}: Props) {
  const grouped = groupSessionsByDate(sessions)

  return (
    <aside className="flex flex-col h-full bg-[#1A2C41] w-72 flex-shrink-0">
      {/* Header — always visible */}
      <div className="px-5 pt-6 pb-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-5">
          <h1
            className="text-2xl font-light tracking-widest uppercase text-white"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Letizia
          </h1>
          {/* Mobile close */}
          <button
            onClick={onClose}
            className="lg:hidden text-white/40 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Profile card */}
        <div className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C5A059] to-[#8B6914] flex items-center justify-center text-black text-xs font-bold flex-shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <p className="text-xs text-white/70 leading-tight flex-1 min-w-0 truncate">{displayName}</p>
          <button
            onClick={onOpenSettings}
            title="Settings"
            className="text-white/30 hover:text-white/80 transition-colors cursor-pointer"
          >
            <Settings size={14} />
          </button>
        </div>

        {/* New chat button */}
        <button
          onClick={onNewChat}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-[#C5A059] hover:bg-[#d4af6a] text-black font-semibold py-2.5 rounded-xl text-sm transition-all duration-200 cursor-pointer"
        >
          <Plus size={16} />
          New Strategy Chat
        </button>
      </div>

      {/* Module selector */}
      <div className="px-5 pt-4 pb-3 flex-shrink-0">
        <p className="text-[10px] text-white/30 uppercase tracking-[0.15em] font-medium mb-3">
          Select Your Assistant
        </p>
        <nav className="space-y-0.5">
          {MODULES.map((mod) => {
            const isActive = mod.id === activeModuleId
            const isAvailable = mod.id === 'general-letizia'

            if (!isAvailable) {
              return (
                <div
                  key={mod.id}
                  aria-disabled
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left cursor-not-allowed relative text-white/25"
                >
                  <span className="text-base leading-none opacity-50">{mod.icon}</span>
                  <span className="font-medium flex-1 truncate">{mod.name}</span>
                  <span className="text-[9px] uppercase tracking-[0.12em] font-semibold bg-white/10 text-white/40 px-1.5 py-0.5 rounded">
                    Soon
                  </span>
                </div>
              )
            }

            return (
              <button
                key={mod.id}
                onClick={() => onSelectModule(mod.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 text-left cursor-pointer relative ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#C5A059] rounded-full" />
                )}
                <span className="text-base leading-none">{mod.icon}</span>
                <span className="font-medium">{mod.name}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tools section */}
      <div className="px-5 pb-3 flex-shrink-0">
        <p className="text-[10px] text-white/30 uppercase tracking-[0.15em] font-medium mb-3">
          Tools
        </p>
        <div
          aria-disabled
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left cursor-not-allowed relative text-white/25"
        >
          <Hotel size={16} className="opacity-50" />
          <span className="font-medium flex-1 truncate">Hotel Scraper</span>
          <span className="text-[9px] uppercase tracking-[0.12em] font-semibold bg-white/10 text-white/40 px-1.5 py-0.5 rounded">
            Soon
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-white/10 flex-shrink-0" />

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {grouped.length === 0 ? (
          <p className="text-white/20 text-xs text-center mt-4">No conversations yet</p>
        ) : (
          grouped.map(({ label, items }) => (
            <div key={label} className="mb-4">
              <p className="text-[10px] text-white/30 uppercase tracking-[0.12em] font-medium mb-2">
                {label}
              </p>
              <div className="space-y-0.5">
                {items.map((s) => {
                  const mod = MODULES.find((m) => m.id === s.module_id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => onSelectChat(s)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all duration-150 cursor-pointer group ${
                        s.id === activeChatId
                          ? 'bg-white/15 text-white'
                          : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                      }`}
                    >
                      <span className="mr-1.5">{mod?.icon}</span>
                      <span className="truncate">{s.title}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
