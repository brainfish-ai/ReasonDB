import { useState, useEffect } from 'react'
import {
  Minus,
  Square,
  CornersIn,
  X,
  Sidebar as SidebarIcon,
  Database,
  Plugs,
  PlugsConnected,
} from '@phosphor-icons/react'
import { useUiStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import type { Connection } from '@/stores/connectionStore'

interface TitleBarProps {
  connection?: Connection
}

// Check if we're running inside Tauri
const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function TitleBar({ connection }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const { toggleSidebar } = useUiStore()

  useEffect(() => {
    if (!isTauri()) return

    const setupWindow = async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const currentWindow = getCurrentWindow()

      const maximized = await currentWindow.isMaximized()
      setIsMaximized(maximized)

      // Listen for window resize events
      const unlisten = await currentWindow.onResized(async () => {
        const maximized = await currentWindow.isMaximized()
        setIsMaximized(maximized)
      })

      return unlisten
    }

    let cleanup: (() => void) | undefined
    setupWindow().then((unlisten) => {
      cleanup = unlisten
    })

    return () => {
      cleanup?.()
    }
  }, [])

  const handleMinimize = async () => {
    if (!isTauri()) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    getCurrentWindow().minimize()
  }

  const handleMaximize = async () => {
    if (!isTauri()) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const window = getCurrentWindow()
    if (await window.isMaximized()) {
      await window.unmaximize()
      setIsMaximized(false)
    } else {
      await window.maximize()
      setIsMaximized(true)
    }
  }

  const handleClose = async () => {
    if (!isTauri()) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    getCurrentWindow().close()
  }

  return (
    <div
      data-tauri-drag-region
      className="h-10 bg-mantle border-b border-border flex items-center justify-between select-none"
    >
      {/* Left section */}
      <div className="flex items-center gap-2 px-3">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md hover:bg-surface-0 text-subtext-0 hover:text-text transition-all duration-200"
          title="Toggle Sidebar"
        >
          <SidebarIcon 
            size={18} 
            weight="bold" 
            className="transition-transform duration-200"
          />
        </button>

        <div className="flex items-center gap-2 text-sm">
          <Database size={18} weight="duotone" className="text-mauve" />
          <span className="font-semibold text-text">ReasonDB</span>
        </div>
      </div>

      {/* Center - Connection status */}
      <div
        data-tauri-drag-region
        className="flex-1 flex items-center justify-center gap-2"
      >
        {connection ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-surface-0">
            <PlugsConnected size={14} weight="fill" className="text-green" />
            <span className="text-xs text-subtext-1">{connection.name}</span>
            <span className="text-xs text-overlay-0">
              ({connection.host}:{connection.port})
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-surface-0/50">
            <Plugs size={14} weight="bold" className="text-overlay-0" />
            <span className="text-xs text-overlay-0">Not connected</span>
          </div>
        )}
      </div>

      {/* Window controls - only show in Tauri */}
      {isTauri() && (
        <div className="flex items-center">
          <button
            onClick={handleMinimize}
            className={cn(
              'h-10 w-12 flex items-center justify-center',
              'hover:bg-surface-0 text-subtext-0 hover:text-text transition-colors'
            )}
          >
            <Minus size={16} weight="bold" />
          </button>
          <button
            onClick={handleMaximize}
            className={cn(
              'h-10 w-12 flex items-center justify-center',
              'hover:bg-surface-0 text-subtext-0 hover:text-text transition-colors'
            )}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <CornersIn size={14} weight="bold" />
            ) : (
              <Square size={14} weight="bold" />
            )}
          </button>
          <button
            onClick={handleClose}
            className={cn(
              'h-10 w-12 flex items-center justify-center',
              'hover:bg-red text-subtext-0 hover:text-base transition-colors'
            )}
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      )}
    </div>
  )
}
