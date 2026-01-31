import { useEffect, useRef } from 'react'
import Editor, { type Monaco, loader } from '@monaco-editor/react'
import { cn } from '@/lib/utils'

// Catppuccin Mocha theme colors
const catppuccinMocha = {
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',
  surface0: '#313244',
  surface1: '#45475a',
  surface2: '#585b70',
  overlay0: '#6c7086',
  overlay1: '#7f849c',
  overlay2: '#9399b2',
  text: '#cdd6f4',
  subtext0: '#a6adc8',
  subtext1: '#bac2de',
  rosewater: '#f5e0dc',
  flamingo: '#f2cdcd',
  pink: '#f5c2e7',
  mauve: '#cba6f7',
  red: '#f38ba8',
  maroon: '#eba0ac',
  peach: '#fab387',
  yellow: '#f9e2af',
  green: '#a6e3a1',
  teal: '#94e2d5',
  sky: '#89dceb',
  sapphire: '#74c7ec',
  blue: '#89b4fa',
  lavender: '#b4befe',
}

// Define custom Monaco theme
const defineTheme = (monaco: Monaco) => {
  monaco.editor.defineTheme('catppuccin-mocha-json', {
    base: 'vs-dark',
    inherit: false,
    rules: [
      // JSON specific
      { token: 'string.key.json', foreground: catppuccinMocha.blue.slice(1) },
      { token: 'string.value.json', foreground: catppuccinMocha.green.slice(1) },
      { token: 'number', foreground: catppuccinMocha.peach.slice(1) },
      { token: 'keyword', foreground: catppuccinMocha.mauve.slice(1) },
      { token: 'keyword.json', foreground: catppuccinMocha.peach.slice(1) }, // true, false, null
      { token: 'delimiter', foreground: catppuccinMocha.overlay2.slice(1) },
      { token: 'delimiter.bracket', foreground: catppuccinMocha.overlay2.slice(1) },
      // General
      { token: 'comment', foreground: catppuccinMocha.overlay0.slice(1), fontStyle: 'italic' },
      { token: 'string', foreground: catppuccinMocha.green.slice(1) },
      { token: 'variable', foreground: catppuccinMocha.text.slice(1) },
      { token: 'type', foreground: catppuccinMocha.yellow.slice(1) },
    ],
    colors: {
      'editor.background': catppuccinMocha.base,
      'editor.foreground': catppuccinMocha.text,
      'editor.lineHighlightBackground': catppuccinMocha.surface0 + '40',
      'editor.selectionBackground': catppuccinMocha.surface2 + '80',
      'editor.inactiveSelectionBackground': catppuccinMocha.surface1 + '60',
      'editorLineNumber.foreground': catppuccinMocha.surface2,
      'editorLineNumber.activeForeground': catppuccinMocha.lavender,
      'editorCursor.foreground': catppuccinMocha.rosewater,
      'editorWhitespace.foreground': catppuccinMocha.surface2,
      'editorIndentGuide.background': catppuccinMocha.surface1,
      'editorIndentGuide.activeBackground': catppuccinMocha.surface2,
      'editorBracketMatch.background': catppuccinMocha.surface2 + '40',
      'editorBracketMatch.border': catppuccinMocha.mauve,
      'editor.foldBackground': catppuccinMocha.surface0 + '40',
      'scrollbar.shadow': catppuccinMocha.crust,
      'scrollbarSlider.background': catppuccinMocha.surface2 + '80',
      'scrollbarSlider.hoverBackground': catppuccinMocha.overlay0,
      'scrollbarSlider.activeBackground': catppuccinMocha.overlay1,
      'editorGutter.background': catppuccinMocha.base,
      'editorWidget.background': catppuccinMocha.surface0,
      'editorWidget.border': catppuccinMocha.surface1,
      'editorBracketHighlight.foreground1': catppuccinMocha.red,
      'editorBracketHighlight.foreground2': catppuccinMocha.peach,
      'editorBracketHighlight.foreground3': catppuccinMocha.yellow,
      'editorBracketHighlight.foreground4': catppuccinMocha.green,
      'editorBracketHighlight.foreground5': catppuccinMocha.sapphire,
      'editorBracketHighlight.foreground6': catppuccinMocha.mauve,
    },
  })
}

// Initialize theme once
let themeInitialized = false
loader.init().then((monaco) => {
  if (!themeInitialized) {
    defineTheme(monaco)
    themeInitialized = true
  }
})

export interface JsonViewerProps {
  /** Data to display as JSON */
  data: unknown
  /** Height of the editor (default: 100%) */
  height?: string | number
  /** Show line numbers */
  lineNumbers?: boolean
  /** Show minimap */
  minimap?: boolean
  /** Custom class */
  className?: string
  /** Empty state message */
  emptyMessage?: string
}

export function JsonViewer({
  data,
  height = '100%',
  lineNumbers = true,
  minimap = false,
  className,
  emptyMessage = 'No data to display',
}: JsonViewerProps) {
  const editorRef = useRef<unknown>(null)

  // Format JSON with proper indentation
  const formattedJson = data !== undefined ? JSON.stringify(data, null, 2) : ''

  const handleEditorDidMount = (editor: unknown, monaco: Monaco) => {
    editorRef.current = editor

    // Ensure theme is defined
    if (!themeInitialized) {
      defineTheme(monaco)
      themeInitialized = true
    }

    // Configure JSON language features
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
    })
  }

  if (data === undefined || data === null || (Array.isArray(data) && data.length === 0)) {
    return (
      <div className={cn('flex items-center justify-center h-full text-overlay-0 text-sm', className)}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={cn('h-full', className)}>
      <Editor
        height={height}
        language="json"
        value={formattedJson}
        onMount={handleEditorDidMount}
        options={{
          readOnly: true,
          minimap: { enabled: minimap },
          fontSize: 13,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
          lineNumbers: lineNumbers ? 'on' : 'off',
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
        theme="catppuccin-mocha-json"
      />
    </div>
  )
}
