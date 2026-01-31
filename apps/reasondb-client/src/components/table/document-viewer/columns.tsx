import type { ColumnDef } from '@tanstack/react-table'
import { CaretUp, CaretDown, BracketsCurly, TreeStructure } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { Document } from '@/stores/tableStore'
import type { SelectedCellData, LoadContentCallback } from './types'

interface ColumnOptions {
  onSelectCell: (cell: SelectedCellData) => void
  onLoadContent: LoadContentCallback
}

/**
 * Create sortable header component
 */
function SortableHeader({ 
  column, 
  label 
}: { 
  column: { toggleSorting: () => void; getIsSorted: () => false | 'asc' | 'desc' }
  label: string 
}) {
  return (
    <button
      className="flex items-center gap-1 hover:text-text transition-colors font-medium"
      onClick={() => column.toggleSorting()}
    >
      {label}
      {column.getIsSorted() === 'asc' && <CaretUp size={12} weight="bold" />}
      {column.getIsSorted() === 'desc' && <CaretDown size={12} weight="bold" />}
    </button>
  )
}

/**
 * Create column definitions for the document table
 */
export function createColumns({ onSelectCell, onLoadContent }: ColumnOptions): ColumnDef<Document>[] {
  return [
    // ID Column
    {
      accessorKey: 'data.id',
      header: ({ column }) => <SortableHeader column={column} label="id" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-overlay-1">
          {String(row.original.data.id)}
        </span>
      ),
    },

    // Title Column
    {
      accessorKey: 'data.title',
      header: ({ column }) => <SortableHeader column={column} label="title" />,
      cell: ({ row }) => (
        <span className="font-medium text-text">
          {String(row.original.data.title || '')}
        </span>
      ),
    },

    // Content Column - click to view document tree
    {
      id: 'content',
      header: 'content',
      cell: ({ row }) => {
        const docId = row.original.data.id as string
        const docTitle = row.original.data.title || row.original.id
        const totalNodes = row.original.data.total_nodes as number

        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onLoadContent(docId, String(docTitle))
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
      },
    },

    // Tags Column
    {
      accessorKey: 'data.tags',
      header: 'tags',
      cell: ({ row }) => {
        const tags = row.original.data.tags as string[] | undefined
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
      },
    },

    // Metadata Column
    {
      accessorKey: 'data.metadata',
      header: 'metadata',
      cell: ({ row }) => {
        const metadata = row.original.data.metadata as Record<string, unknown> | undefined
        const docTitle = row.original.data.title || row.original.id

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
              onSelectCell({
                title: `${docTitle} → metadata`,
                path: 'metadata',
                data: metadata,
              })
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
      },
    },

    // Created At Column
    {
      accessorKey: 'data.created_at',
      header: ({ column }) => <SortableHeader column={column} label="created" />,
      cell: ({ row }) => {
        const date = row.original.data.created_at
        if (!date) return <span className="text-overlay-0 italic">—</span>
        return (
          <span className="text-sky text-sm">
            {new Date(date as string).toLocaleDateString()}
          </span>
        )
      },
    },
  ]
}
