import { create } from 'zustand'
import type { ModuleId } from './modules'

export type ActiveView = 'chat' | 'hotel-scraper'

// UI-only state — all persistence goes to Supabase
interface AppState {
  activeModuleId: ModuleId
  activeChatId: string | null
  activeView: ActiveView
  sidebarOpen: boolean
  isStreaming: boolean

  setActiveModule: (id: ModuleId) => void
  setActiveChatId: (id: string | null) => void
  setActiveView: (view: ActiveView) => void
  setSidebarOpen: (open: boolean) => void
  setIsStreaming: (v: boolean) => void
}

export const useAppStore = create<AppState>()((set) => ({
  activeModuleId: 'general-letizia',
  activeChatId: null,
  activeView: 'chat',
  sidebarOpen: true,
  isStreaming: false,

  setActiveModule: (id) => set({ activeModuleId: id }),
  setActiveChatId: (id) => set({ activeChatId: id }),
  setActiveView: (view) => set({ activeView: view }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setIsStreaming: (v) => set({ isStreaming: v }),
}))
