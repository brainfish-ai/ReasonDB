import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  Table,
  Rows,
  Clock,
  CaretUp,
  CaretDown,
  CaretLeft,
  CaretRight,
  WarningCircle,
  CheckCircle,
  Copy,
  Download,
} from '@phosphor-icons/react'
import { useQueryStore, type QueryResult } from '@/stores/queryStore'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export function QueryResults() {
  const { result, error, isExecuting } = useQueryStore()

  if (isExecuting) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-base text-subtext-0">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm">Executing query...</p>
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

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-base text-subtext-0">
        <Table size={48} weight="duotone" className="mb-3 opacity-50" />
        <p className="text-sm">Run a query to see results</p>
      </div>
    )
  }

  return <ResultsTable result={result} />
}

function ResultsTable({ result }: { result: QueryResult }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [copied, setCopied] = useState(false)

  // Generate columns dynamically from result
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    return result.columns.map((col) => ({
      accessorKey: col,
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 hover:text-text transition-colors"
          onClick={() => column.toggleSorting()}
        >
          {col}
          {column.getIsSorted() === 'asc' && <CaretUp size={12} weight="bold" />}
          {column.getIsSorted() === 'desc' && <CaretDown size={12} weight="bold" />}
        </button>
      ),
      cell: ({ getValue }) => {
        const value = getValue()
        // Format different value types
        if (value === null) return <span className="text-overlay-0 italic">null</span>
        if (value === undefined) return <span className="text-overlay-0 italic">undefined</span>
        if (typeof value === 'boolean') {
          return <span className={value ? 'text-green' : 'text-red'}>{String(value)}</span>
        }
        if (typeof value === 'number') {
          return <span className="text-peach font-mono">{value}</span>
        }
        if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
          return <span className="text-sky">{new Date(value).toLocaleString()}</span>
        }
        const strValue = String(value)
        if (strValue.length > 100) {
          return (
            <span className="block max-w-[300px] truncate" title={strValue}>
              {strValue}
            </span>
          )
        }
        return strValue
      },
    }))
  }, [result.columns])

  const table = useReactTable({
    data: result.rows,
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
      pagination: {
        pageSize: 50,
      },
    },
  })

  const handleCopyResults = async () => {
    const csv = [
      result.columns.join('\t'),
      ...result.rows.map((row) => result.columns.map((col) => row[col] ?? '').join('\t')),
    ].join('\n')
    
    await navigator.clipboard.writeText(csv)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportCSV = () => {
    const csv = [
      result.columns.join(','),
      ...result.rows.map((row) =>
        result.columns
          .map((col) => {
            const val = row[col]
            if (val === null || val === undefined) return ''
            const str = String(val)
            return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
          })
          .join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query_results_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full bg-base">
      {/* Results toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-mantle">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-green">
            <CheckCircle size={14} weight="fill" />
            <span>{result.rowCount} rows</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-subtext-0">
            <Clock size={14} />
            <span>{result.executionTime}ms</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter results..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className={cn(
              'px-2 py-1 text-xs rounded border border-border bg-surface-0',
              'focus:outline-none focus:ring-1 focus:ring-primary',
              'placeholder-overlay-0'
            )}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyResults}
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

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-mantle border-b border-border">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left text-xs font-semibold text-subtext-0 uppercase tracking-wide"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, idx) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-border/50 hover:bg-surface-0/50 transition-colors',
                  idx % 2 === 0 ? 'bg-base' : 'bg-mantle/30'
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 text-text">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-mantle">
          <div className="text-xs text-subtext-0">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-7 w-7"
            >
              <CaretLeft size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-7 w-7"
            >
              <CaretRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
