import { useState, useMemo, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  CaretUp,
  CaretDown,
  BracketsCurly,
  TreeStructure,
  X,
  CircleNotch,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { DataTable } from './DataTable'
import { TableToolbar } from './TableToolbar'
import { TablePagination } from './TablePagination'
import { useConnectionStore } from '@/stores/connectionStore'
import { createClient } from '@/lib/api'

// ==================== Types ====================

export interface RecordTableProps {
  /** Records to display */
  records: Record<string, unknown>[]
  /** Column names to display (auto-detected if not provided) */
  columns?: string[]
  /** Total record count (for server-side pagination) */
  totalCount?: number
  /** Execution time in ms (shown in toolbar) */
  executionTime?: number
  /** Whether this is a query result (affects toolbar styling) */
  isQueryResult?: boolean
  /** Page size */
  pageSize?: number
  /** Custom class */
  className?: string
}

interface DetailPanelData {
  title: string
  type: 'metadata' | 'content' | 'record'
  data: unknown
  isLoading?: boolean
}

// Preferred column order (same as DocumentViewer)
const COLUMN_ORDER = ['id', 'title', 'total_nodes', 'tags', 'metadata', 'created_at']

// Columns to exclude from display
const EXCLUDED_COLUMNS = ['table_id', 'score', 'highlights', 'answer', 'confidence']

// ==================== Cell Renderers ====================

function SortableHeader({
  column,
  label,
}: {
  column: { toggleSorting: () => void; getIsSorted: () => false | 'asc' | 'desc' }
  label: string
}) {
  // Use "content" label for total_nodes to match DocumentViewer
  const displayLabel = label === 'total_nodes' ? 'content' : label
  
  return (
    <button
      className="flex items-center gap-1 hover:text-text transition-colors font-medium"
      onClick={() => column.toggleSorting()}
    >
      {displayLabel}
      {column.getIsSorted() === 'asc' && <CaretUp size={12} weight="bold" />}
      {column.getIsSorted() === 'desc' && <CaretDown size={12} weight="bold" />}
    </button>
  )
}

interface CellRendererProps {
  columnName: string
  value: unknown
  row: Record<string, unknown>
  onMetadataClick: (row: Record<string, unknown>) => void
  onContentClick: (row: Record<string, unknown>) => void
}

function CellRenderer({ columnName, value, row, onMetadataClick, onContentClick }: CellRendererProps) {
  // ID column - monospace, muted
  if (columnName === 'id') {
    return (
      <span className="font-mono text-xs text-overlay-1">
        {String(value || '')}
      </span>
    )
  }

  // Title column - bold
  if (columnName === 'title') {
    return (
      <span className="font-medium text-text">
        {String(value || '')}
      </span>
    )
  }

  // Tags column - comma-separated badges
  if (columnName === 'tags') {
    const tags = value as string[] | undefined
    if (!tags || tags.length === 0) {
      return <span className="text-overlay-0 italic">—</span>
    }
    const displayTags = tags.slice(0, 3)
    const remaining = tags.length - 3
    return (
      <span className="text-blue font-mono text-xs">
        {displayTags.join(', ')}{remaining > 0 ? ` +${remaining}` : ''}
      </span>
    )
  }

  // Metadata column - clickable JSON badge
  if (columnName === 'metadata') {
    const metadata = value as Record<string, unknown> | undefined
    if (!metadata || Object.keys(metadata).length === 0) {
      return <span className="text-overlay-0 italic">—</span>
    }
    const keys = Object.keys(metadata)
    const preview = keys.slice(0, 2).join(', ')
    const hasMore = keys.length > 2
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onMetadataClick(row)
        }}
        className={cn(
          'inline-flex items-center gap-1 px-1.5 rounded',
          'bg-mauve/10 hover:bg-mauve/20 text-mauve transition-colors',
          'font-mono text-xs'
        )}
        title="Click to view metadata"
      >
        <BracketsCurly size={11} className="shrink-0" />
        <span className="truncate max-w-[120px]">
          {preview}{hasMore ? ` +${keys.length - 2}` : ''}
        </span>
      </button>
    )
  }

  // Total nodes column - clickable tree badge (shown as "content")
  if (columnName === 'total_nodes') {
    const totalNodes = value as number
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onContentClick(row)
        }}
        className={cn(
          'inline-flex items-center gap-1 px-1.5 rounded',
          'bg-teal/10 hover:bg-teal/20 text-teal transition-colors',
          'font-mono text-xs'
        )}
        title="Click to view document tree"
      >
        <TreeStructure size={11} className="shrink-0" />
        <span>{totalNodes} nodes</span>
      </button>
    )
  }

  // Date columns - formatted and colored
  if (columnName === 'created_at' || columnName.endsWith('_at')) {
    if (!value) return <span className="text-overlay-0 italic">—</span>
    return (
      <span className="text-sky text-sm">
        {new Date(value as string).toLocaleDateString()}
      </span>
    )
  }

  // Default rendering
  if (value === null) return <span className="text-overlay-0 italic">null</span>
  if (value === undefined) return <span className="text-overlay-0 italic">—</span>
  if (typeof value === 'boolean') {
    return <span className={value ? 'text-green' : 'text-red'}>{String(value)}</span>
  }
  if (typeof value === 'number') {
    return <span className="text-peach font-mono">{value}</span>
  }
  if (Array.isArray(value)) {
    return (
      <span className="text-overlay-0 font-mono text-xs">
        [{value.length} items]
      </span>
    )
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value)
    return (
      <span className="text-overlay-0 font-mono text-xs">
        {`{${keys.length} fields}`}
      </span>
    )
  }
  const strValue = String(value)
  if (strValue.length > 100) {
    return (
      <span className="truncate max-w-[300px]" title={strValue}>
        {strValue}
      </span>
    )
  }
  return <span>{strValue}</span>
}

// ==================== Detail Panel ====================

interface DetailPanelProps {
  data: DetailPanelData | null
  onClose: () => void
}

function DetailPanel({ data, onClose }: DetailPanelProps) {
  if (!data) return null

  const getPanelTitle = () => {
    switch (data.type) {
      case 'metadata':
        return `${data.title} → metadata`
      case 'content':
        return `${data.title} → content`
      default:
        return 'Record Details'
    }
  }

  return (
    <div className="fixed top-0 right-0 h-full w-96 border-l border-border bg-mantle flex flex-col z-50 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium text-text truncate pr-2">{getPanelTitle()}</span>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-surface-1 rounded text-overlay-0 hover:text-text transition-colors shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {data.isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-subtext-0">
            <CircleNotch size={32} className="animate-spin mb-2" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {renderPanelContent(data.data)}
          </div>
        )}
      </div>
    </div>
  )
}

function renderPanelContent(data: unknown): React.ReactNode {
  if (data === null) return <span className="text-overlay-0 italic">null</span>
  if (data === undefined) return <span className="text-overlay-0 italic">undefined</span>

  if (typeof data === 'boolean') {
    return <span className={data ? 'text-green' : 'text-red'}>{String(data)}</span>
  }

  if (typeof data === 'number') {
    return <span className="text-peach font-mono">{data}</span>
  }

  if (typeof data === 'string') {
    // Check if it's a date
    if (data.match(/^\d{4}-\d{2}-\d{2}/)) {
      return <span className="text-sky">{new Date(data).toLocaleString()}</span>
    }
    return <span className="break-words whitespace-pre-wrap">{data}</span>
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-overlay-0 italic">empty array</span>
    return (
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-overlay-0 font-mono text-xs shrink-0 pt-0.5">{i}:</span>
            <div className="flex-1 min-w-0">{renderPanelContent(item)}</div>
          </div>
        ))}
      </div>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data)
    if (entries.length === 0) return <span className="text-overlay-0 italic">empty object</span>
    return (
      <div className="space-y-3">
        {entries.map(([key, value]) => (
          <div key={key} className="space-y-1">
            <div className="text-xs font-medium text-mauve uppercase tracking-wide">
              {key}
            </div>
            <div className="text-sm text-text bg-surface-0 rounded p-2">
              {renderPanelContent(value)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return String(data)
}

// ==================== Main Component ====================

export function RecordTable({
  records,
  columns: columnNames,
  totalCount,
  executionTime,
  isQueryResult = false,
  pageSize = 50,
  className,
}: RecordTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [panelData, setPanelData] = useState<DetailPanelData | null>(null)
  
  const { activeConnectionId, connections } = useConnectionStore()
  const activeConnection = connections.find((c) => c.id === activeConnectionId)

  // Handle metadata click - show metadata in sidebar
  const handleMetadataClick = useCallback((row: Record<string, unknown>) => {
    const title = String(row.title || row.id || 'Record')
    const metadata = row.metadata as Record<string, unknown>
    
    setPanelData({
      title,
      type: 'metadata',
      data: metadata,
    })
  }, [])

  // Handle content click - load document tree
  const handleContentClick = useCallback(async (row: Record<string, unknown>) => {
    const docId = String(row.id || '')
    const title = String(row.title || row.id || 'Record')
    
    if (!activeConnection || !docId) return

    // Show loading state
    setPanelData({
      title,
      type: 'content',
      data: null,
      isLoading: true,
    })

    try {
      const client = createClient({
        host: activeConnection.host,
        port: activeConnection.port,
        apiKey: activeConnection.apiKey,
        useSsl: activeConnection.ssl,
      })

      const tree = await client.getDocumentTree(docId)
      
      setPanelData({
        title,
        type: 'content',
        data: tree,
      })
    } catch (error) {
      console.error('Failed to load document tree:', error)
      setPanelData({
        title,
        type: 'content',
        data: { error: error instanceof Error ? error.message : 'Failed to load document tree' },
      })
    }
  }, [activeConnection])

  // Order and filter columns
  const orderedColumns = useMemo(() => {
    // Get all available columns
    let availableColumns: string[]
    if (columnNames) {
      availableColumns = columnNames
    } else if (records.length > 0) {
      availableColumns = Object.keys(records[0])
    } else {
      return []
    }

    // Filter out excluded columns
    const filtered = availableColumns.filter(col => !EXCLUDED_COLUMNS.includes(col))

    // Sort by preferred order
    const ordered: string[] = []
    const remaining: string[] = []

    for (const col of COLUMN_ORDER) {
      if (filtered.includes(col)) {
        ordered.push(col)
      }
    }

    for (const col of filtered) {
      if (!COLUMN_ORDER.includes(col)) {
        remaining.push(col)
      }
    }

    return [...ordered, ...remaining]
  }, [columnNames, records])

  // Generate column definitions
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    return orderedColumns.map((col) => ({
      accessorKey: col,
      header: ({ column }) => <SortableHeader column={column} label={col} />,
      cell: ({ row, getValue }) => (
        <CellRenderer
          columnName={col}
          value={getValue()}
          row={row.original}
          onMetadataClick={handleMetadataClick}
          onContentClick={handleContentClick}
        />
      ),
    }))
  }, [orderedColumns, handleMetadataClick, handleContentClick])

  const table = useReactTable({
    data: records,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize },
    },
  })

  const rowCount = totalCount ?? records.length

  return (
    <div className={cn('flex h-full bg-base relative', className)}>
      {/* Main table area */}
      <div className="flex flex-col flex-1 min-w-0">
        <TableToolbar
          rowCount={rowCount}
          filteredCount={table.getFilteredRowModel().rows.length}
          executionTime={executionTime}
          isQueryResult={isQueryResult}
          filterValue={globalFilter}
          onFilterChange={setGlobalFilter}
          filterPlaceholder="Filter records..."
          columns={orderedColumns}
          rows={records}
        />

        <div className="flex-1 overflow-auto">
          <DataTable
            table={table}
          />
        </div>

        <TablePagination table={table} />
      </div>

      {/* Detail panel - fixed full height */}
      <DetailPanel
        data={panelData}
        onClose={() => setPanelData(null)}
      />

      {/* Overlay backdrop when panel is open */}
      {panelData && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setPanelData(null)}
        />
      )}
    </div>
  )
}
