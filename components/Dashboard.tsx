'use client'

import { useState, useEffect, useCallback } from 'react'
import { Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import Sidebar from './Sidebar'
import ChatArea from './ChatArea'
import HotelScraper from './HotelScraper'
import OnboardingModal from './OnboardingModal'
import SettingsModal from './SettingsModal'
import TrialExpiredModal from './TrialExpiredModal'
import GuidedTour from './GuidedTour'
import HelpModal from './HelpModal'
import type { ChatSession, Message } from '@/lib/types'
import type { ModuleId } from '@/lib/modules'
import type { UserProfile } from '@/lib/profile'
import type { ActiveView } from '@/lib/store'

interface Props {
  userId: string
  userEmail: string
  displayName: string
  initialProfile: UserProfile
  accessBlocked: boolean
}

function isProfileIncomplete(profile: UserProfile): boolean {
  return (
    !profile.full_name?.trim() ||
    !profile.age ||
    !profile.location?.trim() ||
    !profile.modalities?.trim() ||
    !profile.practice_status ||
    !profile.persona?.trim() ||
    !profile.mission?.trim() ||
    !profile.services?.trim()
  )
}

export default function Dashboard({ userId, userEmail, displayName, initialProfile, accessBlocked }: Props) {
  const {
    activeModuleId,
    activeChatId,
    activeView,
    sidebarOpen,
    isStreaming,
    setActiveModule,
    setActiveChatId,
    setActiveView,
    setSidebarOpen,
    setIsStreaming,
  } = useAppStore()

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [profile, setProfile] = useState<UserProfile>(initialProfile)

  // Onboarding modal: auto-show for first-time users (never dismissed before).
  // The "Finish onboarding" banner reopens it for returning users with gaps.
  const [showOnboarding, setShowOnboarding] = useState(false)
  // tourStep: null = not showing, 0|1|2 = active step
  const [tourStep, setTourStep] = useState<number | null>(null)

  useEffect(() => {
    let onboardingDismissed = false
    let tourDone = false
    try {
      onboardingDismissed = localStorage.getItem(`onboarding_done_${userId}`) === '1'
      tourDone = localStorage.getItem(`tour_done_${userId}`) === '1'
    } catch {}

    const needsOnboarding = !onboardingDismissed && isProfileIncomplete(initialProfile)
    if (needsOnboarding) {
      setShowOnboarding(true)
      // tour will be triggered after onboarding completes
    } else if (!tourDone && !accessBlocked) {
      setTourStep(0)
    }
  }, [userId, initialProfile, accessBlocked])

  const profileIncomplete = isProfileIncomplete(profile)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

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
    setActiveView('chat')
    setMessages([])
  }, [setActiveModule, setActiveChatId, setActiveView])

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
    if (!accessBlocked) {
      let tourDone = false
      try { tourDone = localStorage.getItem(`tour_done_${userId}`) === '1' } catch {}
      if (!tourDone) setTourStep(0)
    }
  }

  function handleTourNext() {
    const next = (tourStep ?? 0) + 1
    // Steps 1 and 2 target sidebar elements — ensure sidebar is visible
    if (next === 1 || next === 2) setSidebarOpen(true)
    setTourStep(next)
  }

  function handleTourDone() {
    try { localStorage.setItem(`tour_done_${userId}`, '1') } catch {}
    setTourStep(null)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {accessBlocked && <TrialExpiredModal />}
      {showOnboarding && !accessBlocked && (
        <OnboardingModal
          userId={userId}
          displayName={displayName}
          initial={profile}
          onComplete={handleOnboardingComplete}
          onClose={() => setShowOnboarding(false)}
        />
      )}
      {showSettings && (
        <SettingsModal
          userId={userId}
          profile={profile}
          onProfileChange={setProfile}
          onClose={() => setShowSettings(false)}
        />
      )}
      {tourStep !== null && !accessBlocked && (
        <GuidedTour
          step={tourStep}
          onNext={handleTourNext}
          onDone={handleTourDone}
        />
      )}
      {showHelp && (
        <HelpModal
          userEmail={userEmail}
          displayName={displayName}
          onClose={() => setShowHelp(false)}
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
          displayName={displayName}
          activeModuleId={activeModuleId}
          activeChatId={activeChatId}
          sessions={sessions}
          onSelectModule={handleSelectModule}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          activeView={activeView}
          onClose={() => setSidebarOpen(false)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenHelp={() => setShowHelp(true)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Incomplete-profile banner */}
        {profileIncomplete && !showOnboarding && (
          <button
            onClick={() => setShowOnboarding(true)}
            className="flex items-center justify-center gap-2 w-full bg-[#C5A059] hover:bg-[#d4af6a] text-[#1A2C41] font-semibold text-xs px-4 py-2.5 transition-colors cursor-pointer"
          >
            <span className="font-bold">Important!</span>
            <span>Finish the onboarding to help you better →</span>
          </button>
        )}

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

        {activeView === 'hotel-scraper' ? (
          <HotelScraper userId={userId} />
        ) : (
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
        )}
      </div>
    </div>
  )
}
