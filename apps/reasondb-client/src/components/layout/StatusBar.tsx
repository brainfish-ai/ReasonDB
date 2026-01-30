import {
  CheckCircle,
  WarningCircle,
  Table,
  FileText,
  Lightning,
} from '@phosphor-icons/react'
import type { Connection } from '@/stores/connectionStore'

interface StatusBarProps {
  connection?: Connection
}

export function StatusBar({ connection }: StatusBarProps) {
  const isConnected = !!connection

  return (
    <div className="h-6 bg-mantle border-t border-border flex items-center justify-between px-3 text-xs">
      {/* Left side - Connection status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <>
              <CheckCircle size={14} weight="fill" className="text-green" />
              <span className="text-subtext-0">
                Connected to{' '}
                <span className="text-text font-medium">{connection.host}</span>
                :<span className="text-text">{connection.port}</span>
              </span>
            </>
          ) : (
            <>
              <WarningCircle size={14} weight="fill" className="text-yellow" />
              <span className="text-overlay-0">Not connected</span>
            </>
          )}
        </div>

        {isConnected && (
          <>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-3 text-overlay-0">
              <div className="flex items-center gap-1">
                <Table size={12} weight="bold" />
                <span>3 tables</span>
              </div>
              <div className="flex items-center gap-1">
                <FileText size={12} weight="bold" />
                <span>150 documents</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right side - Status info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 text-overlay-0">
          <Lightning size={12} weight="fill" className="text-mauve" />
          <span>ReasonDB v0.1.0</span>
        </div>
      </div>
    </div>
  )
}
