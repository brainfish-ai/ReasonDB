import { useState } from 'react'
import { Panel, Group, Separator } from 'react-resizable-panels'
import {
  Plus,
  X,
  Table as TableIcon,
  Code,
  TreeStructure,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { WelcomeScreen } from '@/components/common/WelcomeScreen'
import { QueryEditor } from '@/components/query/QueryEditor'
import { QueryResults } from '@/components/query/QueryResults'
import { useQueryStore } from '@/stores/queryStore'

interface Tab {
  id: string
  title: string
  type: 'query' | 'table'
}

export function MainPanel() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [resultView, setResultView] = useState<'table' | 'json' | 'tree'>('table')
  const { result } = useQueryStore()

  const addNewTab = () => {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      title: `Query ${tabs.length + 1}`,
      type: 'query',
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
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                'group flex items-center gap-2 px-4 py-2 text-sm border-r border-border cursor-pointer',
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
            </div>
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

      {/* Main content with resizable panels */}
      <Group orientation="vertical" className="flex-1">
        {/* Editor panel */}
        <Panel defaultSize={55} minSize={20}>
          <QueryEditor />
        </Panel>

        <Separator className="h-1 bg-border hover:bg-primary/50 transition-colors cursor-row-resize" />

        {/* Results panel */}
        <Panel defaultSize={45} minSize={15}>
          <div className="h-full flex flex-col">
            {/* Results header with view toggles */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-surface-0/30 border-b border-border">
              <div className="flex items-center gap-4">
                <span className="text-sm text-text font-medium">Results</span>
                {result && (
                  <span className="text-xs text-overlay-0">
                    {result.rowCount} rows · {result.executionTime}ms
                  </span>
                )}
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
            <div className="flex-1 min-h-0">
              {resultView === 'table' && <QueryResults />}
              {resultView === 'json' && (
                <div className="h-full overflow-auto p-4 font-mono text-xs">
                  {result ? (
                    <pre className="text-text">
                      {JSON.stringify(result.rows, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-overlay-0">Run a query to see results</span>
                  )}
                </div>
              )}
              {resultView === 'tree' && (
                <div className="flex items-center justify-center h-full text-overlay-0 text-sm">
                  Tree view coming soon...
                </div>
              )}
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  )
}
