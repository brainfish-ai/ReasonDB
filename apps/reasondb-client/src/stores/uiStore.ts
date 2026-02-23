import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light' | 'system'

export interface UiState {
  theme: Theme
  sidebarOpen: boolean
  sidebarWidth: number
  resultsHeight: number
  activeTab: string | null
  showConnectionForm: boolean
  showQueryHistory: boolean
  showSavedQueries: boolean

  // Actions
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setResultsHeight: (height: number) => void
  setActiveTab: (tabId: string | null) => void
  setShowConnectionForm: (show: boolean) => void
  openConnectionForm: () => void
  setShowQueryHistory: (show: boolean) => void
  setShowSavedQueries: (show: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarOpen: true,
      sidebarWidth: 280,
      resultsHeight: 300,
      activeTab: null,
      showConnectionForm: false,
      showQueryHistory: false,
      showSavedQueries: false,

      setTheme: (theme) => {
        set({ theme })
        // Apply theme to document
        const root = document.documentElement
        if (theme === 'system') {
          const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
            .matches
            ? 'dark'
            : 'light'
          root.setAttribute('data-theme', systemTheme)
        } else {
          root.setAttribute('data-theme', theme)
        }
      },

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),

      setResultsHeight: (resultsHeight) => set({ resultsHeight }),

      setActiveTab: (activeTab) => set({ activeTab }),

      setShowConnectionForm: (showConnectionForm) => set({ showConnectionForm }),
      
      openConnectionForm: () => set({ showConnectionForm: true, sidebarOpen: true }),

      setShowQueryHistory: (showQueryHistory) => set({ showQueryHistory, showSavedQueries: false }),
      setShowSavedQueries: (showSavedQueries) => set({ showSavedQueries, showQueryHistory: false }),
    }),
    {
      name: 'reasondb-ui',
      partialize: (state) => ({
        theme: state.theme,
        sidebarWidth: state.sidebarWidth,
        resultsHeight: state.resultsHeight,
      }),
    }
  )
)
