import { useState, useMemo, useRef, useCallback, useEffect, forwardRef } from 'react'
import { MagnifyingGlass, X, Article, ArticleNyTimes, ArrowsLeftRight, CaretDown } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { SyntaxViewer } from './SyntaxViewer'
import { palette } from '@/lib/monaco-theme'

export interface TreeNode {
  id: string
  title: string
  summary: string
  content?: string
  depth: number
  is_leaf: boolean
  cross_ref_node_ids?: string[]
  children: TreeNode[]
}

interface TreeStats {
  totalNodes: number
  leafNodes: number
  totalChars: number
  maxDepth: number
}

interface LeafPosition {
  node: TreeNode
  index: number
  lineNumber: number
}

function extractLeafNodes(node: TreeNode): TreeNode[] {
  if (!node) return []
  if (node.is_leaf) return [node]
  const children = node.children || []
  return children.flatMap(extractLeafNodes)
}

function countNodes(node: TreeNode): number {
  if (!node) return 0
  const children = node.children || []
  return 1 + children.reduce((sum, child) => sum + countNodes(child), 0)
}

function calculateStats(node: TreeNode): TreeStats {
  if (!node) {
    return { totalNodes: 0, leafNodes: 0, totalChars: 0, maxDepth: 0 }
  }
  const leaves = extractLeafNodes(node)
  return {
    totalNodes: countNodes(node),
    leafNodes: leaves.length,
    totalChars: leaves.reduce((sum, n) => sum + (n.content?.length || 0), 0),
    maxDepth: leaves.length > 0 ? Math.max(...leaves.map(n => n.depth)) : 0,
  }
}

function findLeafPositions(json: string, leafNodes: TreeNode[]): LeafPosition[] {
  const positions: LeafPosition[] = []
  const lines = json.split('\n')
  
  leafNodes.forEach((node, index) => {
    let nodeStartLine = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`"id": "${node.id}"`)) {
        nodeStartLine = i
        break
      }
    }
    
    if (nodeStartLine === -1) return
    
    for (let i = nodeStartLine; i < Math.min(nodeStartLine + 15, lines.length); i++) {
      if (lines[i].includes('"content":')) {
        positions.push({ node, index, lineNumber: i + 1 })
        return
      }
    }
    
    positions.push({ node, index, lineNumber: nodeStartLine + 1 })
  })
  
  return positions
}

const ACCENT_COLOR = '#60a5fa'
const LINE_HEIGHT = 20

// Flatten all nodes in a tree into a map keyed by id
function buildNodeMap(node: TreeNode, map: Map<string, TreeNode> = new Map()): Map<string, TreeNode> {
  map.set(node.id, node)
  for (const child of node.children || []) buildNodeMap(child, map)
  return map
}

interface ContentBlockProps {
  node: TreeNode
  index: number
  isSelected: boolean
  isHovered: boolean
  searchQuery: string
  nodeMap: Map<string, TreeNode>
  crossRefOnly: boolean
  onSelect: () => void
  onHover: (hovered: boolean) => void
}

const ContentBlock = forwardRef<HTMLDivElement, ContentBlockProps>(
  ({ node, isSelected, isHovered, searchQuery, nodeMap, crossRefOnly, onSelect, onHover }, ref) => {
    const refIds = node.cross_ref_node_ids ?? []
    const refNodes = (refIds.map(id => nodeMap.get(id)).filter(Boolean) as TreeNode[])
      .filter(n => {
        // Skip nodes whose content is mostly "N/A" placeholder values (PDF form fields)
        const text = n.content ?? n.summary ?? ''
        const nonNaChars = text.split(/\s+/).filter(w => w.toLowerCase() !== 'n/a').join('').length
        return nonNaChars >= 20
      })

    const highlightContent = (text: string) => {
      if (!searchQuery.trim() || !text) return text
      const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      const parts = text.split(regex)
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow/20 text-yellow rounded px-0.5">{part}</mark>
        ) : part
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          'group relative transition-all duration-150 cursor-pointer',
          'rounded-r-lg pl-4 pr-4 py-3',
          'border-l-2',
          refNodes.length > 0
            ? isSelected
              ? 'border-l-mauve bg-mauve/8'
              : isHovered
                ? 'border-l-mauve bg-mauve/5'
                : 'border-l-mauve/40 hover:border-l-mauve'
            : isSelected
              ? 'border-l-blue bg-blue/10'
              : isHovered
                ? 'border-l-lavender bg-surface-0/40'
                : 'border-l-overlay-0 hover:border-l-subtext-0'
        )}
        onClick={onSelect}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
      >
        <p className={cn(
          'text-[15px] leading-[1.7] tracking-[-0.01em]',
          'font-normal whitespace-pre-wrap transition-colors duration-150',
          isSelected ? 'text-text' : isHovered ? 'text-text' : 'text-subtext-0'
        )}>
          {node.content ? highlightContent(node.content) : (
            <span className="italic text-subtext-0">No content</span>
          )}
        </p>

        {/* Cross-ref footer — always visible when refs exist */}
        {refNodes.length > 0 && (
          <div
            className="mt-3 pt-2.5 border-t border-mauve/15"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowsLeftRight size={11} className="text-mauve/60 shrink-0" />
              <span className="text-[10px] font-semibold text-mauve/70 uppercase tracking-wider">
                References
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {refNodes.map(refNode => (
                <CrossRefPreview key={refNode.id} node={refNode} defaultExpanded={crossRefOnly} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }
)

function CrossRefPreview({ node, defaultExpanded }: { node: TreeNode; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)
  const hasContent = !!node.content && node.content.trim().length > 0
  const isLong = (node.content?.length ?? 0) > 300

  return (
    <div
      className={cn(
        'rounded-md border transition-colors overflow-hidden',
        expanded
          ? 'border-mauve/30 bg-mantle/80'
          : 'border-mauve/20 bg-mantle/40 hover:border-mauve/35 hover:bg-mantle/60'
      )}
    >
      {/* Title row — always visible, click to toggle content */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <CaretDown
          size={10}
          className={cn('shrink-0 text-mauve/50 transition-transform', !expanded && '-rotate-90')}
        />
        <span className="text-[11px] font-semibold text-mauve/90 truncate flex-1">{node.title}</span>
      </button>

      {/* Content — only when expanded */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-mauve/10">
          {hasContent ? (
            <>
              <p className={cn(
                'text-[11px] text-subtext-0 leading-relaxed whitespace-pre-wrap mt-2',
                !isLong && 'line-clamp-none'
              )}>
                {node.content}
              </p>
            </>
          ) : (
            <p className="text-[11px] italic text-overlay-0 mt-2">{node.summary}</p>
          )}
        </div>
      )}
    </div>
  )
}

ContentBlock.displayName = 'ContentBlock'

export interface NodeSplitViewerProps {
  treeData: TreeNode
  className?: string
}

export function NodeSplitViewer({ treeData, className }: NodeSplitViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [crossRefOnly, setCrossRefOnly] = useState(false)

  const contentRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  const [linePositions, setLinePositions] = useState<
    Array<{ leftY: number; rightY: number; rightX: number; index: number }>
  >([])
  const [leftPanelWidth, setLeftPanelWidth] = useState(0)

  const leafNodes = useMemo(() => extractLeafNodes(treeData), [treeData])
  const nodeMap = useMemo(() => buildNodeMap(treeData), [treeData])

  const filteredLeafNodes = useMemo(() => {
    let nodes = leafNodes
    if (crossRefOnly) nodes = nodes.filter(n => (n.cross_ref_node_ids?.length ?? 0) > 0)
    if (!searchQuery.trim()) return nodes
    const query = searchQuery.toLowerCase()
    return nodes.filter(
      (node) =>
        node.title.toLowerCase().includes(query) ||
        node.content?.toLowerCase().includes(query) ||
        node.summary.toLowerCase().includes(query)
    )
  }, [leafNodes, searchQuery, crossRefOnly])

  const stats = useMemo(() => calculateStats(treeData), [treeData])
  const fullJson = useMemo(() => JSON.stringify(treeData, null, 2), [treeData])

  const leafPositions = useMemo(
    () => findLeafPositions(fullJson, leafNodes),
    [fullJson, leafNodes],
  )

  const handleSelectContent = useCallback(
    (index: number) => {
      setSelectedIndex(index)

      const pos = leafPositions.find((p) => p.index === index)
      if (pos) {
        const scrollContainer = leftPanelRef.current?.querySelector('[class*="overflow-auto"]') || leftPanelRef.current
        if (scrollContainer) {
          const targetY = (pos.lineNumber - 1) * LINE_HEIGHT
          scrollContainer.scrollTo({ top: targetY - scrollContainer.clientHeight / 2, behavior: 'smooth' })
        }
      }
    },
    [leafPositions],
  )

  const handleLineClick = useCallback(
    (lineNumber: number) => {
      const pos = leafPositions.find((p) => p.lineNumber === lineNumber)
      if (pos) {
        setSelectedIndex(pos.index)
        if (showPreview) {
          const contentEl = contentRefs.current.get(pos.index)
          contentEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    },
    [leafPositions, showPreview],
  )

  useEffect(() => {
    if (selectedIndex !== null && showPreview) {
      const contentEl = contentRefs.current.get(selectedIndex)
      contentEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [selectedIndex, showPreview])

  // Update connection line positions
  const updateLinePositions = useCallback(() => {
    if (!showPreview || !leftPanelRef.current || !rightPanelRef.current) return

    const containerRect = leftPanelRef.current.parentElement?.getBoundingClientRect()
    if (!containerRect) return

    const scrollContainer = leftPanelRef.current
    const scrollTop = scrollContainer.scrollTop
    const leftRect = scrollContainer.getBoundingClientRect()

    const newPositions: Array<{ leftY: number; rightY: number; rightX: number; index: number }> = []

    leafPositions.forEach((pos, idx) => {
      const leftY = leftRect.top - containerRect.top + (pos.lineNumber - 1) * LINE_HEIGHT - scrollTop + LINE_HEIGHT / 2

      const contentEl = contentRefs.current.get(idx)
      if (contentEl) {
        const contentRect = contentEl.getBoundingClientRect()
        const rightY = contentRect.top - containerRect.top + (contentRect.height / 2)
        const rightX = contentRect.left - containerRect.left

        newPositions.push({
          leftY: Math.max(0, leftY),
          rightY: Math.max(0, rightY),
          rightX,
          index: idx,
        })
      }
    })

    setLinePositions(newPositions)
    setLeftPanelWidth(scrollContainer.offsetWidth)
  }, [leafPositions, showPreview])

  useEffect(() => {
    if (!showPreview) return

    const update = () => requestAnimationFrame(updateLinePositions)
    update()

    const rightPanel = rightPanelRef.current
    const leftPanel = leftPanelRef.current
    const container = leftPanel?.parentElement

    leftPanel?.addEventListener('scroll', update)
    rightPanel?.addEventListener('scroll', update)
    window.addEventListener('resize', update)

    const resizeObserver = new ResizeObserver(update)
    if (container) resizeObserver.observe(container)
    if (leftPanel) resizeObserver.observe(leftPanel)
    if (rightPanel) resizeObserver.observe(rightPanel)

    const intervalId = setInterval(update, 500)

    return () => {
      leftPanel?.removeEventListener('scroll', update)
      rightPanel?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      resizeObserver.disconnect()
      clearInterval(intervalId)
      setLinePositions([])
      setLeftPanelWidth(0)
    }
  }, [showPreview, updateLinePositions])

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Search bar + preview toggle */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-overlay-0"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search document..."
            className={cn(
              'w-full pl-9 pr-9 py-2 text-sm rounded-lg',
              'bg-surface-0 border border-surface-1',
              'text-text placeholder:text-overlay-0',
              'focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue/50',
              'transition-all duration-150'
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-overlay-0 hover:text-text"
              aria-label="Clear search"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowPreview((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors shrink-0',
            showPreview
              ? 'bg-blue/15 text-blue border border-blue/30'
              : 'bg-surface-0 text-overlay-0 hover:text-text border border-surface-1 hover:border-overlay-0'
          )}
          aria-pressed={showPreview}
          aria-label="Toggle document preview"
        >
          {showPreview ? (
            <ArticleNyTimes size={14} weight="bold" aria-hidden="true" />
          ) : (
            <Article size={14} aria-hidden="true" />
          )}
          Preview
        </button>
      </div>

      {(searchQuery || crossRefOnly) && (
        <div className="px-4 py-1.5 text-xs text-overlay-0 border-b border-border bg-surface-0/30 flex items-center gap-2">
          <span>{filteredLeafNodes.length} of {leafNodes.length} sections</span>
          {crossRefOnly && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-mauve/15 text-mauve text-[10px] font-medium">
              <ArrowsLeftRight size={9} />
              cross-refs only
              <button
                onClick={() => setCrossRefOnly(false)}
                className="ml-0.5 hover:text-red transition-colors"
                aria-label="Clear filter"
              >
                <X size={9} />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Split View */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Panel — JSON tree */}
        <div
          ref={leftPanelRef}
          className={cn(
            'flex flex-col min-h-0 transition-all duration-200 overflow-auto',
            showPreview ? 'w-[45%] border-r border-border' : 'w-full'
          )}
        >
          <SyntaxViewer
            content={fullJson}
            language="json"
            lineNumbers
            onLineClick={handleLineClick}
          />
        </div>

        {/* Connection Lines */}
        {showPreview && linePositions.length > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ overflow: 'visible', zIndex: 10 }}
          >
            <defs>
              <linearGradient id="line-gradient-inactive" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={palette.overlay0} stopOpacity="0.9" />
                <stop offset="100%" stopColor={palette.overlay0} stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="line-gradient-active" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={ACCENT_COLOR} stopOpacity="1" />
                <stop offset="100%" stopColor={ACCENT_COLOR} stopOpacity="0.8" />
              </linearGradient>
            </defs>
            {linePositions.map((pos) => {
              const isActive = selectedIndex === pos.index || hoveredIndex === pos.index
              const startX = leftPanelWidth
              const endX = pos.rightX
              const midX = (startX + endX) / 2

              return (
                <g key={pos.index}>
                  <path
                    d={`M ${startX} ${pos.leftY} C ${midX} ${pos.leftY}, ${midX} ${pos.rightY}, ${endX} ${pos.rightY}`}
                    fill="none"
                    stroke={isActive ? 'url(#line-gradient-active)' : 'url(#line-gradient-inactive)'}
                    strokeWidth={isActive ? 2 : 1.5}
                    strokeLinecap="round"
                    className="transition-all duration-150"
                  />
                  <circle
                    cx={startX}
                    cy={pos.leftY}
                    r={isActive ? 4 : 3}
                    fill={isActive ? ACCENT_COLOR : palette.overlay0}
                    className="transition-all duration-150"
                  />
                  <circle
                    cx={endX}
                    cy={pos.rightY}
                    r={isActive ? 4 : 3}
                    fill={isActive ? ACCENT_COLOR : palette.overlay0}
                    className="transition-all duration-150"
                  />
                </g>
              )
            })}
          </svg>
        )}

        {/* Right Panel — Document preview */}
        {showPreview && (
          <div ref={rightPanelRef} className="w-[55%] flex flex-col min-h-0 bg-mantle/30">
            <div className="flex-1 overflow-auto">
              <div className="py-6 px-6 pl-8">
                {filteredLeafNodes.length > 0 ? (
                  <div className="space-y-4">
                    {filteredLeafNodes.map((node) => {
                      const originalIndex = leafNodes.indexOf(node)
                      return (
                        <ContentBlock
                          key={node.id}
                          ref={(el) => {
                            if (el) contentRefs.current.set(originalIndex, el)
                          }}
                          node={node}
                          index={originalIndex}
                          searchQuery={searchQuery}
                          nodeMap={nodeMap}
                          crossRefOnly={crossRefOnly}
                          isSelected={selectedIndex === originalIndex}
                          isHovered={hoveredIndex === originalIndex}
                          onSelect={() => handleSelectContent(originalIndex)}
                          onHover={(hovered) => setHoveredIndex(hovered ? originalIndex : null)}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-overlay-0 text-sm">
                    {crossRefOnly ? 'No sections with cross-references' : searchQuery ? 'No matching sections' : 'No content available'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-surface-0/30">
        <div className="flex items-center justify-between text-xs text-overlay-0">
          <span>{stats.leafNodes} sections</span>
          <div className="flex items-center gap-3">
            {(() => {
              const crossRefCount = leafNodes.filter(n => (n.cross_ref_node_ids?.length ?? 0) > 0).length
              return crossRefCount > 0 ? (
                <button
                  onClick={() => {
                    setCrossRefOnly(v => !v)
                    setShowPreview(true)
                  }}
                  className={cn(
                    'flex items-center gap-1 transition-colors rounded px-1 py-0.5',
                    crossRefOnly
                      ? 'text-mauve bg-mauve/15'
                      : 'text-mauve/70 hover:text-mauve hover:bg-mauve/10'
                  )}
                  title="Filter preview to sections with cross-references"
                >
                  <ArrowsLeftRight size={10} />
                  {crossRefCount} with cross-refs
                </button>
              ) : null
            })()}
            <span>{stats.totalChars.toLocaleString()} characters</span>
          </div>
        </div>
      </div>
    </div>
  )
}
