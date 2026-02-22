import { useState, useEffect } from 'react'
import {
  Table,
  WarningCircle,
  Timer,
} from '@phosphor-icons/react'
import { useQueryStore } from '@/stores/queryStore'
import { RecordTable } from '@/components/shared/data-table'
import { cn } from '@/lib/utils'

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSec = Math.floor(seconds % 60)
  return `${minutes}m ${remainingSec}s`
}

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(() => Date.now() - startedAt)

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100)
    return () => clearInterval(id)
  }, [startedAt])

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs text-overlay-0 mt-3">
      <Timer size={13} className="text-mauve" />
      <span>{formatElapsed(elapsed)}</span>
    </div>
  )
}

export function QueryResults() {
  const { results, activeResultIndex, setActiveResultIndex, error, isExecuting, executionStartedAt, reasonProgress } = useQueryStore()

  if (isExecuting) {
    const message = reasonProgress?.message ?? 'Executing query...'
    const phase = reasonProgress?.phase

    return (
      <div className="flex flex-col items-center justify-center h-full bg-base text-subtext-0">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p
          key={message}
          className="text-sm animate-[fadeIn_0.3s_ease-in-out]"
        >
          {message}
        </p>
        {phase && (
          <span className="text-[11px] text-overlay-0 mt-1 font-mono">{phase}</span>
        )}
        {executionStartedAt && <ElapsedTimer startedAt={executionStartedAt} />}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-base p-6">
        <WarningCircle size={48} weight="duotone" className="text-red mb-3" />
        <p className="text-sm font-medium text-red mb-2">Query Error</p>
        <pre className="text-xs text-subtext-0 bg-surface-0 p-3 rounded-md max-w-full overflow-auto">
          {error}
        </pre>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-base text-subtext-0">
        <Table size={48} weight="duotone" className="mb-3 opacity-50" />
        <p className="text-sm">Run a query to see results</p>
      </div>
    )
  }

  const activeResult = results[activeResultIndex] ?? results[0]

  if (results.length === 1) {
    return (
      <RecordTable
        records={activeResult.rows}
        columns={activeResult.columns}
        totalCount={activeResult.rowCount}
        executionTime={activeResult.executionTime}
        isQueryResult
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-0.5 px-2 py-1 bg-mantle border-b border-border overflow-x-auto scrollbar-none">
        {results.map((r, i) => (
          <button
            key={i}
            onClick={() => setActiveResultIndex(i)}
            className={cn(
              'px-3 py-1 text-xs rounded-md transition-colors whitespace-nowrap',
              i === activeResultIndex
                ? 'bg-surface-1 text-text font-medium'
                : 'text-subtext-0 hover:text-text hover:bg-surface-0'
            )}
          >
            Result {i + 1}
            <span className="ml-1.5 text-overlay-0">
              {r.rowCount} rows · {r.executionTime}ms
            </span>
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        <RecordTable
          records={activeResult.rows}
          columns={activeResult.columns}
          totalCount={activeResult.rowCount}
          executionTime={activeResult.executionTime}
          isQueryResult
        />
      </div>
    </div>
  )
}
