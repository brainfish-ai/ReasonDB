import { useEffect, useRef } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import { X, Copy, CheckCircle, ArrowsOut, ArrowsIn } from '@phosphor-icons/react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface JsonDetailSidebarProps {
  isOpen: boolean
  onClose: () => void
  title: string
  data: unknown
  path?: string // The path to the data (e.g., "metadata.employee")
}

export function JsonDetailSidebar({ isOpen, onClose, title, data, path }: JsonDetailSidebarProps) {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const editorRef = useRef<unknown>(null)

  // Format JSON with proper indentation
  const formattedJson = JSON.stringify(data, null, 2)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedJson)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleEditorDidMount = (editor: unknown, monaco: Monaco) => {
    editorRef.current = editor
    
    // Configure JSON language features
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
    })
  }

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop for expanded mode */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
      
      {/* Sidebar */}
      <div
        className={cn(
          'flex flex-col bg-mantle border-l border-border shadow-xl z-50',
          'transition-all duration-200 ease-out',
          isExpanded 
            ? 'fixed inset-y-0 right-0 w-[60vw]' 
            : 'w-[400px] h-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-0/30">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-text truncate">{title}</h3>
            {path && (
              <span className="text-xs text-overlay-0 font-mono truncate">{path}</span>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={handleCopy}
              className={cn(
                'p-1.5 rounded transition-colors',
                'hover:bg-surface-1 text-overlay-1 hover:text-text'
              )}
              title="Copy JSON"
            >
              {copied ? (
                <CheckCircle size={16} weight="fill" className="text-green" />
              ) : (
                <Copy size={16} />
              )}
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                'p-1.5 rounded transition-colors',
                'hover:bg-surface-1 text-overlay-1 hover:text-text'
              )}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ArrowsIn size={16} /> : <ArrowsOut size={16} />}
            </button>
            <button
              onClick={onClose}
              className={cn(
                'p-1.5 rounded transition-colors',
                'hover:bg-surface-1 text-overlay-1 hover:text-text'
              )}
              title="Close (Esc)"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </div>

        {/* Type info */}
        <div className="px-4 py-2 border-b border-border bg-surface-0/20">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-overlay-0">Type:</span>
            <span className={cn(
              'px-1.5 py-0.5 rounded font-mono',
              Array.isArray(data) ? 'bg-blue/20 text-blue' :
              typeof data === 'object' ? 'bg-mauve/20 text-mauve' :
              typeof data === 'string' ? 'bg-green/20 text-green' :
              typeof data === 'number' ? 'bg-peach/20 text-peach' :
              'bg-overlay-0/20 text-overlay-1'
            )}>
              {Array.isArray(data) ? `array[${data.length}]` : typeof data}
            </span>
            {typeof data === 'object' && data !== null && !Array.isArray(data) && (
              <>
                <span className="text-overlay-0">•</span>
                <span className="text-overlay-0">
                  {Object.keys(data).length} keys
                </span>
              </>
            )}
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            language="json"
            value={formattedJson}
            onMount={handleEditorDidMount}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
              folding: true,
              foldingStrategy: 'indentation',
              showFoldingControls: 'always',
              bracketPairColorization: { enabled: true },
              guides: {
                bracketPairs: true,
                indentation: true,
              },
              renderLineHighlight: 'line',
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
              },
              padding: { top: 12, bottom: 12 },
            }}
            theme="vs-dark"
          />
        </div>

        {/* Footer with quick stats */}
        <div className="px-4 py-2 border-t border-border bg-surface-0/20">
          <div className="flex items-center justify-between text-xs text-overlay-0">
            <span>{formattedJson.split('\n').length} lines</span>
            <span>{new Blob([formattedJson]).size} bytes</span>
          </div>
        </div>
      </div>
    </>
  )
}
