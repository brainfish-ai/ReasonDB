import { JsonViewer } from '@/components/shared/JsonViewer'
import type { Document } from '@/stores/tableStore'

interface JsonViewProps {
  documents: Document[]
  selectedDocumentId: string | null
  onSelectDocument: (id: string) => void
}

export function JsonView({
  documents,
}: JsonViewProps) {
  // Transform documents to show their data
  const data = documents.map((doc) => doc.data)

  return (
    <div className="h-full">
      <JsonViewer
        data={data}
        emptyMessage="No documents to display"
      />
    </div>
  )
}
