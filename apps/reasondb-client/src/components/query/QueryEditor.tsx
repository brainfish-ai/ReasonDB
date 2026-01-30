import { useRef, useEffect, useCallback } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useHotkeys } from 'react-hotkeys-hook'
import { Play, FloppyDisk, Clock, CircleNotch } from '@phosphor-icons/react'
import { registerRqlLanguage, RQL_LANGUAGE_ID } from '@/lib/rql-language'
import { useQueryStore } from '@/stores/queryStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface QueryEditorProps {
  onExecute?: (query: string) => Promise<void>
}

export function QueryEditor({ onExecute }: QueryEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  
  const { currentQuery, setCurrentQuery, isExecuting, setIsExecuting, setResult, setError, addToHistory } = useQueryStore()
  const { activeConnectionId, connections } = useConnectionStore()
  
  const activeConnection = connections.find((c) => c.id === activeConnectionId)

  // Register RQL language on Monaco load
  const handleEditorWillMount = useCallback((monaco: typeof Monaco) => {
    registerRqlLanguage(monaco)
    monacoRef.current = monaco
  }, [])

  const handleEditorDidMount = useCallback((editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    
    // Focus editor on mount
    editor.focus()
    
    // Add keyboard shortcuts
    editor.addAction({
      id: 'execute-query',
      label: 'Execute Query',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      ],
      run: () => {
        handleExecute()
      },
    })
  }, [])

  // Execute query
  const handleExecute = useCallback(async () => {
    const query = currentQuery.trim()
    if (!query || isExecuting || !activeConnectionId) return

    setIsExecuting(true)
    setError(null)
    
    const startTime = Date.now()

    try {
      if (onExecute) {
        await onExecute(query)
      } else {
        // Mock execution for demo
        await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000))
        
        // Generate mock results based on query type
        const isSelect = query.toUpperCase().startsWith('SELECT') || 
                        query.toUpperCase().startsWith('REASON') ||
                        query.toUpperCase().startsWith('SEARCH')
        
        if (isSelect) {
          const mockColumns = ['id', 'title', 'content', 'similarity', 'created_at']
          const mockRows = Array.from({ length: Math.floor(Math.random() * 20) + 5 }, (_, i) => ({
            id: `doc_${i + 1}`,
            title: `Document ${i + 1}`,
            content: `This is the content of document ${i + 1}...`,
            similarity: (Math.random() * 0.5 + 0.5).toFixed(3),
            created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          }))
          
          const executionTime = Date.now() - startTime
          
          setResult({
            columns: mockColumns,
            rows: mockRows,
            rowCount: mockRows.length,
            executionTime,
          })
          
          addToHistory({
            query,
            connectionId: activeConnectionId,
            executedAt: new Date().toISOString(),
            executionTime,
            rowCount: mockRows.length,
          })
        } else {
          const executionTime = Date.now() - startTime
          
          setResult({
            columns: ['affected_rows'],
            rows: [{ affected_rows: Math.floor(Math.random() * 10) + 1 }],
            rowCount: 1,
            executionTime,
          })
          
          addToHistory({
            query,
            connectionId: activeConnectionId,
            executedAt: new Date().toISOString(),
            executionTime,
            rowCount: 1,
          })
        }
      }
    } catch (err) {
      const executionTime = Date.now() - startTime
      const errorMessage = err instanceof Error ? err.message : 'Query execution failed'
      
      setError(errorMessage)
      
      addToHistory({
        query,
        connectionId: activeConnectionId,
        executedAt: new Date().toISOString(),
        executionTime,
        rowCount: 0,
        error: errorMessage,
      })
    } finally {
      setIsExecuting(false)
    }
  }, [currentQuery, isExecuting, activeConnectionId, onExecute, setIsExecuting, setError, setResult, addToHistory])

  // Keyboard shortcut for execute
  useHotkeys('mod+enter', () => handleExecute(), {
    enableOnFormTags: true,
    preventDefault: true,
  })

  // Configure Monaco loader
  useEffect(() => {
    loader.config({
      paths: {
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs',
      },
    })
  }, [])

  return (
    <div className="flex flex-col h-full bg-base">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-mantle">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleExecute}
            disabled={isExecuting || !activeConnectionId || !currentQuery.trim()}
            className="gap-1.5"
          >
            {isExecuting ? (
              <CircleNotch size={14} className="animate-spin" />
            ) : (
              <Play size={14} weight="fill" />
            )}
            Run
            <kbd className="ml-1 px-1 py-0.5 text-[10px] bg-surface-0 rounded">⌘↵</kbd>
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            disabled={!currentQuery.trim()}
            className="gap-1.5"
          >
            <FloppyDisk size={14} />
            Save
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
          >
            <Clock size={14} />
            History
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs text-subtext-0">
          {activeConnection ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green" />
              {activeConnection.name}
            </span>
          ) : (
            <span className="text-overlay-0">Not connected</span>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={RQL_LANGUAGE_ID}
          theme="rql-catppuccin"
          value={currentQuery}
          onChange={(value) => setCurrentQuery(value || '')}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
            padding: { top: 12, bottom: 12 },
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            folding: true,
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              indentation: true,
            },
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            placeholder: activeConnectionId 
              ? 'Enter your RQL query here... (⌘+Enter to execute)'
              : 'Connect to a database to start querying...',
          }}
          loading={
            <div className="flex items-center justify-center h-full text-subtext-0">
              <CircleNotch size={24} className="animate-spin" />
            </div>
          }
        />
      </div>
    </div>
  )
}
