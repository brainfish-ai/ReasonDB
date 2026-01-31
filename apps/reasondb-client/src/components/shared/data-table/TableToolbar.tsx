import { useState } from 'react'
import {
  Clock,
  CheckCircle,
  Copy,
  Download,
  Rows,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export interface TableToolbarProps {
  /** Total row count */
  rowCount: number
  /** Filtered row count (if different from total) */
  filteredCount?: number
  /** Query execution time in ms */
  executionTime?: number
  /** Whether results are from a query (shows success indicator) */
  isQueryResult?: boolean
  /** Global filter value */
  filterValue?: string
  /** Filter change handler */
  onFilterChange?: (value: string) => void
  /** Filter placeholder */
  filterPlaceholder?: string
  /** Data for copy/export */
  columns: string[]
  rows: Record<string, unknown>[]
  /** Optional children for additional actions */
  children?: React.ReactNode
  /** Custom class */
  className?: string
}

export function TableToolbar({
  rowCount,
  filteredCount,
  executionTime,
  isQueryResult = false,
  filterValue = '',
  onFilterChange,
  filterPlaceholder = 'Filter...',
  columns,
  rows,
  children,
  className,
}: TableToolbarProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const tsv = [
      columns.join('\t'),
      ...rows.map((row) => columns.map((col) => formatValue(row[col])).join('\t')),
    ].join('\n')

    await navigator.clipboard.writeText(tsv)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportCSV = () => {
    const csv = [
      columns.join(','),
      ...rows.map((row) =>
        columns
          .map((col) => {
            const str = formatValue(row[col])
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"`
              : str
          })
          .join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `data_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const displayCount = filteredCount !== undefined && filteredCount !== rowCount
    ? `${filteredCount} of ${rowCount}`
    : String(rowCount)

  return (
    <div className={cn(
      'flex items-center justify-between px-3 py-2 border-b border-border bg-mantle',
      className
    )}>
      <div className="flex items-center gap-3">
        {isQueryResult ? (
          <div className="flex items-center gap-1.5 text-xs text-green">
            <CheckCircle size={14} weight="fill" />
            <span>{displayCount} rows</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-subtext-0">
            <Rows size={14} />
            <span>{displayCount} rows</span>
          </div>
        )}
        {executionTime !== undefined && (
          <div className="flex items-center gap-1.5 text-xs text-subtext-0">
            <Clock size={14} />
            <span>{executionTime}ms</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onFilterChange && (
          <div className="relative">
            <MagnifyingGlass size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-overlay-0" />
            <input
              type="text"
              placeholder={filterPlaceholder}
              value={filterValue}
              onChange={(e) => onFilterChange(e.target.value)}
              className={cn(
                'pl-7 pr-2 py-1 text-xs rounded border border-border bg-surface-0 w-48',
                'focus:outline-none focus:ring-1 focus:ring-primary',
                'placeholder-overlay-0'
              )}
            />
          </div>
        )}
        {children}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="gap-1"
        >
          {copied ? <CheckCircle size={14} className="text-green" /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleExportCSV}
          className="gap-1"
        >
          <Download size={14} />
          Export
        </Button>
      </div>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
