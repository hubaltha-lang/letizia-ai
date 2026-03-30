'use client'

import { useState, useEffect, useCallback } from 'react'
import { Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import Sidebar from './Sidebar'
import ChatArea from './ChatArea'
import OnboardingModal from './OnboardingModal'
import type { ChatSession, Message } from '@/lib/types'
import type { ModuleId } from '@/lib/modules'
import type { UserProfile } from '@/lib/profile'

interface Props {
  userId: string
  displayName: string
  initialProfile: UserProfile
}

function isProfileEmpty(profile: UserProfile) {
  return !profile.persona.trim() && !profile.mission.trim() && !profile.services.trim()
}

export default function Dashboard({ userId, displayName, initialProfile }: Props) {
  const {
    activeModuleId,
    activeChatId,
    sidebarOpen,
    isStreaming,
    setActiveModule,
    setActiveChatId,
    setSidebarOpen,
    setIsStreaming,
  } = useAppStore()

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [profile, setProfile] = useState<UserProfile>(initialProfile)

  // Show onboarding modal for new users who haven't completed it
  const [showOnboarding, setShowOnboarding] = useState(false)
  useEffect(() => {
    let done = false
    try {
      done = localStorage.getItem(`onboarding_done_${userId}`) === '1'
    } catch {}
    if (!done && isProfileEmpty(initialProfile)) {
      setShowOnboarding(true)
    }
  }, [userId, initialProfile])

  const supabase = createClient()

  // Load all sessions for user on mount
  useEffect(() => {
    supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data) setSessions(data)
      })
  }, [userId])

  // Load messages when active chat changes
  useEffect(() => {
    if (!activeChatId) {
      setMessages([])
      return
    }
    supabase
      .from('messages')
      .select('*')
      .eq('session_id', activeChatId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data)
      })
  }, [activeChatId])

  const activeSession = sessions.find((s) => s.id === activeChatId) ?? null

  const handleSelectModule = useCallback((id: ModuleId) => {
    setActiveModule(id)
    setActiveChatId(null)
    setMessages([])
  }, [setActiveModule, setActiveChatId])

  const handleSelectChat = useCallback((session: ChatSession) => {
    setActiveModule(session.module_id as ModuleId)
    setActiveChatId(session.id)
    setSidebarOpen(false) // close on mobile
  }, [setActiveModule, setActiveChatId, setSidebarOpen])

  const handleNewChat = useCallback(() => {
    setActiveChatId(null)
    setMessages([])
    setSidebarOpen(false)
  }, [setActiveChatId, setSidebarOpen])

  const handleSessionCreated = useCallback((session: ChatSession) => {
    setSessions((prev) => [session, ...prev])
    setActiveChatId(session.id)
  }, [setActiveChatId])

  const handleSessionUpdated = useCallback((updated: ChatSession) => {
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
  }, [])

  const handleStreamingChange = useCallback((streaming: boolean, content: string) => {
    setIsStreaming(streaming)
    setStreamingContent(content)
  }, [setIsStreaming])

  function handleOnboardingComplete(completed: UserProfile) {
    setProfile(completed)
    setShowOnboarding(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {showOnboarding && (
        <OnboardingModal
          userId={userId}
          displayName={displayName}
          onComplete={handleOnboardingComplete}
        />
      )}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-[#1A2C41]/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:relative z-30 lg:z-auto h-full transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar
          userId={userId}
          displayName={displayName}
          activeModuleId={activeModuleId}
          activeChatId={activeChatId}
          sessions={sessions}
          profile={profile}
          onSelectModule={handleSelectModule}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onClose={() => setSidebarOpen(false)}
          onProfileChange={setProfile}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-[#1A2C41]/50 hover:text-[#1A2C41] transition-colors cursor-pointer"
          >
            <Menu size={20} />
          </button>
          <span
            className="text-[#1A2C41] font-light tracking-widest uppercase text-lg"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Letizia
          </span>
        </div>

        <ChatArea
          userId={userId}
          activeModuleId={activeModuleId}
          activeSession={activeSession}
          messages={messages}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          profile={profile}
          onMessagesUpdate={setMessages}
          onSessionCreated={handleSessionCreated}
          onSessionUpdated={handleSessionUpdated}
          onStreamingChange={handleStreamingChange}
        />
      </div>
    </div>
  )
}
