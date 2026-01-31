import type { Document } from '@/stores/tableStore'

// Selected cell data for sidebar
export interface SelectedCellData {
  title: string
  path: string
  data: unknown
  isLoading?: boolean
}

// View modes
export type ViewMode = 'table' | 'json'

// Props for DocumentViewer
export interface DocumentViewerProps {
  tableId: string
}

// Callback for loading document content
export type LoadContentCallback = (documentId: string, documentTitle: string) => void

// Re-export Document type
export type { Document }
