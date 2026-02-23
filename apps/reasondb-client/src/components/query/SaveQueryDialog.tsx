import { useState, useEffect } from 'react'
import { FloppyDisk } from '@phosphor-icons/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useQueryStore, type SavedQuery } from '@/stores/queryStore'
import { useConnectionStore } from '@/stores/connectionStore'

interface SaveQueryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingQuery?: SavedQuery
}

export function SaveQueryDialog({ open, onOpenChange, editingQuery }: SaveQueryDialogProps) {
  const { currentQuery, saveQuery, updateSavedQuery, savedQueries } = useQueryStore()
  const { activeConnectionId } = useConnectionStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState('')

  const isEditing = !!editingQuery

  useEffect(() => {
    if (open) {
      if (editingQuery) {
        setName(editingQuery.name)
        setDescription(editingQuery.description || '')
      } else {
        setName('')
        setDescription('')
      }
      setNameError('')
    }
  }, [open, editingQuery])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('Name is required')
      return
    }

    const duplicate = savedQueries.find(
      (q) => q.name.toLowerCase() === trimmedName.toLowerCase() && q.id !== editingQuery?.id
    )
    if (duplicate) {
      setNameError('A saved query with this name already exists')
      return
    }

    if (isEditing && editingQuery) {
      updateSavedQuery(editingQuery.id, {
        name: trimmedName,
        description: description.trim() || undefined,
      })
    } else {
      saveQuery({
        name: trimmedName,
        query: currentQuery,
        description: description.trim() || undefined,
        connectionId: activeConnectionId || undefined,
      })
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FloppyDisk size={20} weight="duotone" />
            {isEditing ? 'Edit Saved Query' : 'Save Query'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the name and description for this saved query.'
              : 'Give your query a name so you can find it later.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="query-name">Name</Label>
            <Input
              id="query-name"
              placeholder="e.g. Get all active users"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError('')
              }}
              error={nameError}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="query-description">
              Description <span className="text-overlay-0 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="query-description"
              placeholder="What does this query do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {!isEditing && currentQuery && (
            <div className="space-y-2">
              <Label>Query Preview</Label>
              <div className="bg-surface-0 rounded-md p-2 max-h-24 overflow-auto">
                <pre className="text-xs font-mono text-subtext-0 whitespace-pre-wrap break-all">
                  {currentQuery.length > 300
                    ? currentQuery.slice(0, 300) + '...'
                    : currentQuery}
                </pre>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              <FloppyDisk size={16} className="mr-1.5" />
              {isEditing ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
