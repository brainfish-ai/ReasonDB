import { useState } from 'react'
import { Panel, Group, Separator } from 'react-resizable-panels'
import {
  Plus,
  X,
  Play,
  FloppyDisk,
  Table as TableIcon,
  Code,
  TreeStructure,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { WelcomeScreen } from '@/components/common/WelcomeScreen'

interface Tab {
  id: string
  title: string
  type: 'query' | 'table'
  content?: string
}

export function MainPanel() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [resultView, setResultView] = useState<'table' | 'json' | 'tree'>(
    'table'
  )

  const activeTab = tabs.find((t) => t.id === activeTabId)

  const addNewTab = () => {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      title: `Query ${tabs.length + 1}`,
      type: 'query',
      content: '',
    }
    setTabs([...tabs, newTab])
    setActiveTabId(newTab.id)
  }

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newTabs = tabs.filter((t) => t.id !== id)
    setTabs(newTabs)
    if (activeTabId === id) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null)
    }
  }

  if (tabs.length === 0) {
    return <WelcomeScreen onNewQuery={addNewTab} />
  }

  return (
    <div className="h-full flex flex-col bg-base">
      {/* Tab bar */}
      <div className="flex items-center bg-mantle border-b border-border">
        <div className="flex-1 flex items-center overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                'group flex items-center gap-2 px-4 py-2 text-sm border-r border-border',
                'hover:bg-surface-0 transition-colors min-w-[120px] max-w-[200px]',
                activeTabId === tab.id
                  ? 'bg-base text-text'
                  : 'bg-mantle text-subtext-0'
              )}
            >
              <span className="truncate">{tab.title}</span>
              <button
                onClick={(e) => closeTab(tab.id, e)}
                className={cn(
                  'p-0.5 rounded hover:bg-surface-1',
                  'opacity-0 group-hover:opacity-100 transition-opacity',
                  'text-overlay-0 hover:text-text'
                )}
              >
                <X size={12} weight="bold" />
              </button>
            </button>
          ))}
        </div>
        <button
          onClick={addNewTab}
          className="p-2 hover:bg-surface-0 text-overlay-0 hover:text-text transition-colors"
          title="New Tab"
        >
          <Plus size={16} weight="bold" />
        </button>
      </div>

      {/* Main content */}
      <Group orientation="vertical" className="flex-1">
        {/* Editor panel */}
        <Panel defaultSize={60} minSize={20}>
          <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 bg-surface-0/30 border-b border-border">
              <button
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium',
                  'bg-green text-base hover:bg-green/90 transition-colors'
                )}
              >
                <Play size={14} weight="fill" />
                Run
              </button>
              <button
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm',
                  'bg-surface-0 text-subtext-1 hover:text-text hover:bg-surface-1 transition-colors'
                )}
              >
                <FloppyDisk size={14} weight="bold" />
                Save
              </button>
              <span className="text-xs text-overlay-0 ml-auto">
                Press <kbd className="px-1 py-0.5 rounded bg-surface-0 font-mono">⌘</kbd>
                +<kbd className="px-1 py-0.5 rounded bg-surface-0 font-mono">Enter</kbd> to run
              </span>
            </div>

            {/* Editor area */}
            <div className="flex-1 p-4">
              <textarea
                value={activeTab?.content || ''}
                onChange={(e) => {
                  if (activeTab) {
                    setTabs(
                      tabs.map((t) =>
                        t.id === activeTab.id
                          ? { ...t, content: e.target.value }
                          : t
                      )
                    )
                  }
                }}
                placeholder="Enter your RQL query here..."
                className={cn(
                  'w-full h-full resize-none font-mono text-sm',
                  'bg-transparent text-text placeholder-overlay-0',
                  'focus:outline-none'
                )}
              />
            </div>
          </div>
        </Panel>

        <Separator className="h-1 bg-border hover:bg-primary/50 transition-colors" />

        {/* Results panel */}
        <Panel defaultSize={40} minSize={15}>
          <div className="h-full flex flex-col">
            {/* Results header */}
            <div className="flex items-center justify-between px-4 py-2 bg-surface-0/30 border-b border-border">
              <div className="flex items-center gap-4">
                <span className="text-sm text-text font-medium">Results</span>
                <span className="text-xs text-overlay-0">0 rows · 0ms</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setResultView('table')}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    resultView === 'table'
                      ? 'bg-surface-1 text-text'
                      : 'text-overlay-0 hover:text-text hover:bg-surface-0'
                  )}
                  title="Table View"
                >
                  <TableIcon size={16} weight="bold" />
                </button>
                <button
                  onClick={() => setResultView('json')}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    resultView === 'json'
                      ? 'bg-surface-1 text-text'
                      : 'text-overlay-0 hover:text-text hover:bg-surface-0'
                  )}
                  title="JSON View"
                >
                  <Code size={16} weight="bold" />
                </button>
                <button
                  onClick={() => setResultView('tree')}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    resultView === 'tree'
                      ? 'bg-surface-1 text-text'
                      : 'text-overlay-0 hover:text-text hover:bg-surface-0'
                  )}
                  title="Tree View"
                >
                  <TreeStructure size={16} weight="bold" />
                </button>
              </div>
            </div>

            {/* Results content */}
            <div className="flex-1 flex items-center justify-center text-overlay-0 text-sm">
              Run a query to see results
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  )
}
