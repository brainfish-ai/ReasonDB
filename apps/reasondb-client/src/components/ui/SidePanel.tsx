import { useEffect, useRef } from 'react'
import { X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface SidePanelProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: number
}

export function SidePanel({ open, onClose, title, children, width = 380 }: SidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-30 bg-crust/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label={title}
        className={cn(
          'absolute top-0 right-0 z-40 h-full flex flex-col',
          'bg-mantle border-l border-border shadow-xl',
          'animate-in slide-in-from-right duration-200'
        )}
        style={{ width }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-overlay-0 hover:text-text hover:bg-surface-0 transition-colors"
            aria-label="Close panel"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {children}
        </div>
      </div>
    </>
  )
}
