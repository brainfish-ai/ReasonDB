import { useEffect, useRef } from 'react'
import { TitleBar } from '@/components/layout/TitleBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { MainPanel } from '@/components/layout/MainPanel'
import { StatusBar } from '@/components/layout/StatusBar'
import { IngestionStatus } from '@/components/ingestion/IngestionStatus'
import { useUiStore } from '@/stores/uiStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useMemoryDiagnostics } from '@/hooks/useMemoryDiagnostics'
import { MonacoProvider } from '@/providers/MonacoProvider'
import { createClient, setClient } from '@/lib/api'

function App() {
  useMemoryDiagnostics()
  const { theme, sidebarOpen } = useUiStore()
  const { activeConnectionId, connections, setActiveConnection } = useConnectionStore()

  const activeConnection = connections.find((c) => c.id === activeConnectionId)

  // On startup (or whenever activeConnectionId changes), verify the connection
  // is reachable. If the server is down or the persisted ID is stale, clear it
  // so the user lands on the welcome screen instead of a broken session.
  const lastCheckedId = useRef<string | null>(null)
  useEffect(() => {
    if (!activeConnectionId || !activeConnection) return
    if (lastCheckedId.current === activeConnectionId) return

    lastCheckedId.current = activeConnectionId

    const client = createClient({
      host: activeConnection.host,
      port: activeConnection.port,
      apiKey: activeConnection.apiKey,
      useSsl: activeConnection.ssl,
    })

    client.testConnection().then(async (result) => {
      if (!result.success) {
        setActiveConnection(null)
        return
      }

      // If the persisted connection has no API key, check whether auth is required.
      // If so, drop the active connection so the user is brought back to the
      // connection list where clicking the row will show the API key prompt.
      if (!activeConnection.apiKey) {
        const { authRequired } = await client.checkAuth()
        if (authRequired) {
          setActiveConnection(null)
          return
        }
      }

      setClient(activeConnectionId, client)
    }).catch(() => {
      setActiveConnection(null)
    })
  }, [activeConnectionId, activeConnection, setActiveConnection])

  useEffect(() => {
    const root = document.documentElement
    const applyTheme = () => {
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
          .matches
          ? 'dark'
          : 'light'
        root.setAttribute('data-theme', systemTheme)
      } else {
        root.setAttribute('data-theme', theme)
      }
    }

    applyTheme()

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme()
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  return (
    <MonacoProvider>
      <a href="#main-content" className="skip-nav">
        Skip to main content
      </a>

      <div className="flex flex-col h-screen bg-background text-foreground">
        <TitleBar connection={activeConnection} />

        <div className="flex-1 flex overflow-hidden">
          <div 
            className={`shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
              sidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0'
            }`}
          >
            <div className="w-64 h-full">
              <Sidebar />
            </div>
          </div>
          <main
            id="main-content"
            className="flex-1 overflow-hidden transition-all duration-300 ease-in-out"
          >
            <MainPanel />
          </main>
        </div>

        <StatusBar connection={activeConnection} />
      </div>

      <IngestionStatus />
    </MonacoProvider>
  )
}

export default App
