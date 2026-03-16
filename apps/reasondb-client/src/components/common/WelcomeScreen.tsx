import {
  PlugsConnected,
  BookOpen,
  Lightning,
  Brain,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { open } from '@tauri-apps/plugin-shell'
import { cn } from '@/lib/utils'
import { useConnectionStore } from '@/stores/connectionStore'
import logoUrl from '@/assets/logo.svg'

interface WelcomeScreenProps {
  onNewConnection: () => void
}

export function WelcomeScreen({ onNewConnection }: WelcomeScreenProps) {
  const { connections, setActiveConnection } = useConnectionStore()

  const features = [
    {
      icon: Brain,
      title: 'Hierarchical Reasoning',
      description: 'LLM-guided tree traversal over your documents. Not chunks, not embeddings.',
      color: 'text-mauve',
    },
    {
      icon: MagnifyingGlass,
      title: 'Full Audit Trail',
      description: '4-phase trace per query. Logged, replayable, and auditable.',
      color: 'text-blue',
    },
    {
      icon: Lightning,
      title: 'Built in Rust',
      description: 'Single binary, deploy anywhere, bring your own LLM',
      color: 'text-yellow',
    },
  ]

  return (
    <div className="h-full flex items-center justify-center bg-base p-8">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="p-4 rounded-2xl bg-linear-to-br from-green/10 to-green/5 border border-green/20">
              <img src={logoUrl} alt="ReasonDB" className="h-12 w-12 object-contain" aria-hidden="true" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">
              Welcome to ReasonDB
            </h1>
            <p className="text-subtext-0 mt-2">
              The AI database that reasons beyond RAG
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <section aria-label="Quick actions">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={onNewConnection}
              className={cn(
                'flex items-center gap-3 p-4 rounded-lg',
                'bg-surface-0 hover:bg-surface-1 border border-border',
                'transition-all hover:border-green/50 group'
              )}
            >
              <div className="p-2 rounded-lg bg-green/10 text-green group-hover:bg-green/20 transition-colors" aria-hidden="true">
                <PlugsConnected size={20} weight="bold" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-text">
                  New Connection
                </div>
                <div className="text-xs text-subtext-0">
                  Connect to a database
                </div>
              </div>
            </button>

            <button
              onClick={() => open('https://reasondb.ai/')}
              className={cn(
                'flex items-center gap-3 p-4 rounded-lg',
                'bg-surface-0 hover:bg-surface-1 border border-border',
                'transition-all hover:border-yellow/50 group'
              )}
            >
              <div className="p-2 rounded-lg bg-yellow/10 text-yellow group-hover:bg-yellow/20 transition-colors" aria-hidden="true">
                <BookOpen size={20} weight="bold" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-text">Documentation</div>
                <div className="text-xs text-subtext-0">Learn RQL syntax</div>
              </div>
            </button>
          </div>
        </section>

        {/* Recent connections */}
        {connections.length > 0 && (
          <section aria-label="Recent connections" className="space-y-3">
            <h2 className="text-sm font-medium text-subtext-0 uppercase tracking-wide">
              Recent Connections
            </h2>
            <ul className="space-y-2" role="list">
              {connections.slice(0, 3).map((conn) => (
                <li key={conn.id}>
                  <button
                    onClick={() => setActiveConnection(conn.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg',
                      'bg-surface-0/50 hover:bg-surface-0 border border-border',
                      'transition-colors text-left'
                    )}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: conn.color || '#60a5fa' }}
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-text">
                        {conn.name}
                      </div>
                      <div className="text-xs text-overlay-0">
                        {conn.host}:{conn.port}
                      </div>
                    </div>
                    {conn.lastUsedAt && (
                      <div className="text-xs text-overlay-0">
                        <time dateTime={new Date(conn.lastUsedAt).toISOString()}>
                          {new Date(conn.lastUsedAt).toLocaleDateString()}
                        </time>
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Features */}
        <section aria-label="Features" className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="text-center space-y-2 p-3 rounded-lg hover:bg-surface-0/50 transition-colors"
            >
              <feature.icon
                size={24}
                weight="duotone"
                className={cn('mx-auto', feature.color)}
                aria-hidden="true"
              />
              <div className="text-xs font-medium text-text">
                {feature.title}
              </div>
              <div className="text-xs text-overlay-0">{feature.description}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
