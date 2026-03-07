import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useConnectionStore } from '@/stores/connectionStore'
import { useTableStore } from '@/stores/tableStore'
import { useIngestionStore } from '@/stores/ingestionStore'

interface AddDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableId: string
}

export function AddDocumentDialog({ open, onOpenChange, tableId }: AddDocumentDialogProps) {
  const { activeConnectionId, connections } = useConnectionStore()
  const activeConnection = connections.find(c => c.id === activeConnectionId)
  const tables = useTableStore(s => s.tables)
  const queueJob = useIngestionStore(s => s.queueJob)

  const tableName = tables.find(t => t.id === tableId)?.name ?? tableId

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')

  const resetForm = () => {
    setTitle('')
    setContent('')
    setTags('')
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  const handleSubmit = () => {
    if (!activeConnectionId || !activeConnection) return

    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean)

    queueJob({
      mode: 'text',
      title: title.trim(),
      tableId,
      tableName,
      connectionId: activeConnectionId,
      payload: {
        title: title.trim(),
        content: content.trim(),
        tags: parsedTags.length > 0 ? parsedTags : undefined,
      },
    })

    resetForm()
    onOpenChange(false)
  }

  const isValid = title.trim().length > 0 && content.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              placeholder="e.g. Service Agreement Q1 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="doc-content">Content</Label>
            <Textarea
              id="doc-content"
              placeholder="Paste your document text or markdown here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="font-mono resize-none"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="doc-tags">
              Tags <span className="text-overlay-0 font-normal">(optional, comma-separated)</span>
            </Label>
            <Input
              id="doc-tags"
              placeholder="e.g. legal, nda, confidential"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            Add Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
