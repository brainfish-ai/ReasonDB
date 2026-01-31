import { type Table as TableType } from '@tanstack/react-table'
import { Copy, PencilSimple, Trash, CheckCircle } from '@phosphor-icons/react'
import { DataTable } from '@/components/shared/data-table'
import type { Document } from '@/stores/tableStore'

interface TableViewProps {
  table: TableType<Document>
  selectedDocumentId: string | null
  copied: boolean
  onSelectDocument: (id: string) => void
  onCopyDocument: (doc: Document) => void
}

export function TableView({
  table,
  selectedDocumentId,
  copied,
  onSelectDocument,
  onCopyDocument,
}: TableViewProps) {
  return (
    <DataTable
      table={table}
      onRowClick={(row) => onSelectDocument(row.id)}
      getRowId={(row) => row.id}
      selectedRowId={selectedDocumentId}
      renderRowActions={(row) => (
        <RowActions
          row={row}
          copied={copied}
          onCopy={onCopyDocument}
        />
      )}
    />
  )
}

interface RowActionsProps {
  row: Document
  copied: boolean
  onCopy: (doc: Document) => void
}

function RowActions({ row, copied, onCopy }: RowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={(e) => {
          e.stopPropagation()
          onCopy(row)
        }}
        className="p-1 hover:bg-surface-1 rounded text-overlay-0 hover:text-text"
        title="Copy JSON"
      >
        {copied ? (
          <CheckCircle size={14} className="text-green" />
        ) : (
          <Copy size={14} />
        )}
      </button>
      <button
        onClick={(e) => e.stopPropagation()}
        className="p-1 hover:bg-surface-1 rounded text-overlay-0 hover:text-text"
        title="Edit"
      >
        <PencilSimple size={14} />
      </button>
      <button
        onClick={(e) => e.stopPropagation()}
        className="p-1 hover:bg-surface-1 rounded text-overlay-0 hover:text-red"
        title="Delete"
      >
        <Trash size={14} />
      </button>
    </div>
  )
}
