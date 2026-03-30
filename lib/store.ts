import { create } from 'zustand'
import type { ModuleId } from './modules'

// UI-only state — all persistence goes to Supabase
interface AppState {
  activeModuleId: ModuleId
  activeChatId: string | null
  sidebarOpen: boolean
  isStreaming: boolean

  setActiveModule: (id: ModuleId) => void
  setActiveChatId: (id: string | null) => void
  setSidebarOpen: (open: boolean) => void
  setIsStreaming: (v: boolean) => void
}

export const useAppStore = create<AppState>()((set) => ({
  activeModuleId: 'b2b-pitcher',
  activeChatId: null,
  sidebarOpen: true,
  isStreaming: false,

  setActiveModule: (id) => set({ activeModuleId: id }),
  setActiveChatId: (id) => set({ activeChatId: id }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setIsStreaming: (v) => set({ isStreaming: v }),
}))
