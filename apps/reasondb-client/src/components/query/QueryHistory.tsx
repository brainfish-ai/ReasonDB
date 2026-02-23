import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Clock,
  Play,
  Trash,
  CheckCircle,
  XCircle,
  CaretRight,
} from '@phosphor-icons/react'
import { useQueryStore, type QueryHistoryItem } from '@/stores/queryStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface QueryHistoryProps {
  onSelectQuery?: (query: string) => void
  onClose?: () => void
}

export function QueryHistory({ onSelectQuery, onClose }: QueryHistoryProps) {
  const { history, removeFromHistory, clearHistory, setCurrentQuery } = useQueryStore()
  const { connections } = useConnectionStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleSelectQuery = (item: QueryHistoryItem) => {
    setCurrentQuery(item.query)
    onSelectQuery?.(item.query)
    onClose?.()
  }

  const getConnectionName = (connectionId: string) => {
    return connections.find((c) => c.id === connectionId)?.name || 'Unknown'
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Clock size={48} weight="duotone" className="text-overlay-0 mb-3" />
        <p className="text-sm text-subtext-0">No query history</p>
        <p className="text-xs text-overlay-0 mt-1">
          Your executed queries will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-mantle">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock size={16} weight="duotone" />
          Query History
          <span className="text-xs text-overlay-0">({history.length})</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={clearHistory}
          className="text-xs text-overlay-0 hover:text-red"
        >
          <Trash size={14} className="mr-1" />
          Clear
        </Button>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-auto">
        {history.map((item) => (
          <div
            key={item.id}
            className={cn(
              'group border-b border-border/50 hover:bg-surface-0/50 transition-colors'
            )}
          >
            {/* Header row */}
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer"
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              <CaretRight
                size={12}
                weight="bold"
                className={cn(
                  'text-overlay-0 transition-transform',
                  expandedId === item.id && 'rotate-90'
                )}
              />
              
              {item.error ? (
                <XCircle size={14} weight="fill" className="text-red shrink-0" />
              ) : (
                <CheckCircle size={14} weight="fill" className="text-green shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono truncate text-text">
                  {item.query.slice(0, 60)}
                  {item.query.length > 60 && '...'}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-overlay-0">
                  <span>{formatDistanceToNow(new Date(item.executedAt), { addSuffix: true })}</span>
                  <span>•</span>
                  <span>{item.executionTime}ms</span>
                  <span>•</span>
                  <span>{item.rowCount} rows</span>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectQuery(item)
                  }}
                  className="p-1 rounded hover:bg-surface-1 text-overlay-0 hover:text-text"
                  title="Use this query"
                >
                  <Play size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFromHistory(item.id)
                  }}
                  className="p-1 rounded hover:bg-surface-1 text-overlay-0 hover:text-red"
                  title="Remove from history"
                >
                  <Trash size={12} />
                </button>
              </div>
            </div>

            {/* Expanded content */}
            {expandedId === item.id && (
              <div className="px-3 pb-3">
                <div className="bg-surface-0 rounded-md p-2 mb-2">
                  <pre className="text-xs font-mono text-text whitespace-pre-wrap break-all">
                    {item.query}
                  </pre>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-overlay-0">
                    Connection: {getConnectionName(item.connectionId)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSelectQuery(item)}
                    className="h-6 text-xs"
                  >
                    <Play size={12} className="mr-1" />
                    Use Query
                  </Button>
                </div>

                {item.error && (
                  <div className="mt-2 p-2 bg-red/10 rounded-md">
                    <p className="text-xs text-red">{item.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
