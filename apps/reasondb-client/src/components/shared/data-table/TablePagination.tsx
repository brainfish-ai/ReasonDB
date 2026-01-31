import { type Table, type RowData } from '@tanstack/react-table'
import { CaretLeft, CaretRight, CaretDoubleLeft, CaretDoubleRight } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export interface TablePaginationProps<TData extends RowData> {
  table: Table<TData>
  /** Show first/last page buttons */
  showFirstLast?: boolean
  /** Custom class */
  className?: string
}

export function TablePagination<TData extends RowData>({
  table,
  showFirstLast = false,
  className,
}: TablePaginationProps<TData>) {
  const pageCount = table.getPageCount()
  
  if (pageCount <= 1) return null

  const currentPage = table.getState().pagination.pageIndex + 1

  return (
    <div className={cn(
      'flex items-center justify-between px-3 py-2 border-t border-border bg-mantle',
      className
    )}>
      <div className="text-xs text-subtext-0">
        Page {currentPage} of {pageCount}
      </div>
      <div className="flex items-center gap-1">
        {showFirstLast && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="h-7 w-7"
            title="First page"
          >
            <CaretDoubleLeft size={14} />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="h-7 w-7"
          title="Previous page"
        >
          <CaretLeft size={14} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="h-7 w-7"
          title="Next page"
        >
          <CaretRight size={14} />
        </Button>
        {showFirstLast && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
            className="h-7 w-7"
            title="Last page"
          >
            <CaretDoubleRight size={14} />
          </Button>
        )}
      </div>
    </div>
  )
}
