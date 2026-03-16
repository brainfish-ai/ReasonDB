import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Key, CircleNotch, WarningCircle } from '@phosphor-icons/react'

interface ApiKeyPromptDialogProps {
  open: boolean
  connectionName: string
  /** Called with the submitted key; return false to show a validation error */
  onSubmit: (apiKey: string) => Promise<boolean>
  onCancel: () => void
}

export function ApiKeyPromptDialog({
  open,
  connectionName,
  onSubmit,
  onCancel,
}: ApiKeyPromptDialogProps) {
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setApiKey('')
      setError(null)
      setLoading(false)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim()) {
      setError('API key is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const ok = await onSubmit(apiKey.trim())
      if (!ok) {
        setError('Invalid API key — authentication failed')
      }
    } catch {
      setError('Connection error — please check the key and try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key size={18} weight="duotone" className="text-blue" />
            Authentication Required
          </DialogTitle>
          <DialogDescription>
            <strong>{connectionName}</strong> requires an API key. Enter your key to connect.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="api-key-input">API Key</Label>
            <Input
              id="api-key-input"
              type="password"
              placeholder="Enter your API key…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoFocus
              disabled={loading}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red rounded-md bg-red/10 px-3 py-2">
              <WarningCircle size={16} weight="fill" className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !apiKey.trim()}>
              {loading && <CircleNotch size={14} className="mr-1.5 animate-spin" />}
              Connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
