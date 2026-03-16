import { useEffect, useState } from 'react'
import {
  CheckCircle,
  WarningCircle,
  Table,
  FileText,
  Lightning,
} from '@phosphor-icons/react'
import type { Connection } from '@/stores/connectionStore'
import { getClient } from '@/lib/api'

interface StatusBarProps {
  connection?: Connection
}

interface Stats {
  tableCount: number
  documentCount: number
  version: string
}

export function StatusBar({ connection }: StatusBarProps) {
  const isConnected = !!connection
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (!connection) {
      setStats(null)
      return
    }

    let cancelled = false

    const fetchStats = async () => {
      const client = getClient(connection.id)
      if (!client) return

      try {
        const [tablesRes, healthRes] = await Promise.all([
          client.listTables(true),
          client.health(),
        ])

        if (cancelled) return

        const documentCount = tablesRes.tables.reduce(
          (sum, t) => sum + (t.document_count ?? 0),
          0,
        )

        setStats({
          tableCount: tablesRes.total,
          documentCount,
          version: healthRes.version ?? '',
        })
      } catch {
        // Stats are best-effort — don't surface errors here.
      }
    }

    fetchStats()
    return () => {
      cancelled = true
    }
  }, [connection?.id])

  return (
    <footer
      className="h-6 bg-mantle border-t border-border flex items-center justify-between px-3 text-xs"
      role="contentinfo"
    >
      {/* Left side - Connection status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5" role="status" aria-live="polite">
          {isConnected ? (
            <>
              <CheckCircle size={14} weight="fill" className="text-green" aria-hidden="true" />
              <span className="text-subtext-0">
                Connected to{' '}
                <span className="text-text font-medium">{connection.host}</span>
                :<span className="text-text">{connection.port}</span>
              </span>
            </>
          ) : (
            <>
              <WarningCircle size={14} weight="fill" className="text-yellow" aria-hidden="true" />
              <span className="text-overlay-0">Not connected</span>
            </>
          )}
        </div>

        {isConnected && stats && (
          <>
            <div className="h-3 w-px bg-border" aria-hidden="true" />
            <div className="flex items-center gap-3 text-overlay-0">
              <div className="flex items-center gap-1">
                <Table size={12} weight="bold" aria-hidden="true" />
                <span>{stats.tableCount} {stats.tableCount === 1 ? 'table' : 'tables'}</span>
              </div>
              <div className="flex items-center gap-1">
                <FileText size={12} weight="bold" aria-hidden="true" />
                <span>{stats.documentCount} {stats.documentCount === 1 ? 'document' : 'documents'}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right side - version */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 text-overlay-0">
          <Lightning size={12} weight="fill" className="text-mauve" aria-hidden="true" />
          <span>ReasonDB{stats?.version ? ` v${stats.version}` : ''}</span>
        </div>
      </div>
    </footer>
  )
}
