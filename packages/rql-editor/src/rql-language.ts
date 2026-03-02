import type { Monaco } from '@monaco-editor/react'
import { palette, editorColors } from './monaco-theme'

export const RQL_LANGUAGE_ID = 'rql'
export const RQL_THEME_NAME = 'rql-dark'

// ─── Language Configuration ──────────────────────────────────────────────────

export const rqlLanguageConfig: Monaco['languages']['LanguageConfiguration'] = {
  comments: {
    lineComment: '--',
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
}

// ─── Monarch Tokenizer ───────────────────────────────────────────────────────

const keywords = [
  // Standard SQL
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'UPDATE', 'DELETE',
  'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX',
  'SET', 'VALUES', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
  'IS', 'NULL', 'TRUE', 'FALSE',
  'ORDER', 'BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
  'GROUP', 'HAVING', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON',
  'AS', 'DISTINCT', 'ALL', 'EXISTS',
  // ReasonDB-specific
  'REASON', 'SEARCH', 'SEMANTIC', 'EMBED', 'SIMILAR', 'TO',
  'SUMMARIZE', 'EXTRACT', 'CHUNK', 'RELATE', 'LINK',
  'WITH', 'CONTEXT', 'THRESHOLD', 'TOP', 'VECTOR', 'CONTAINS', 'ANY',
]

const builtinFunctions = [
  'LOWER', 'UPPER', 'TRIM', 'LENGTH', 'SUBSTRING', 'CONCAT', 'REPLACE',
  'ABS', 'CEIL', 'FLOOR', 'ROUND', 'SQRT', 'POW', 'MOD',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'NOW', 'DATE', 'TIME', 'YEAR', 'MONTH', 'DAY',
  'SIMILARITY', 'DISTANCE', 'EMBEDDING', 'TOKENS', 'CHUNKS',
]

export const rqlTokensProvider = {
  defaultToken: '',
  tokenPostfix: '.rql',
  ignoreCase: true,
  keywords,
  builtinFunctions,
  operators: [
    '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
    '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
    '+=', '-=', '*=', '/=',
  ],
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  tokenizer: {
    root: [
      [
        /[a-zA-Z_$][\w$]*/,
        {
          cases: {
            '@keywords': 'keyword',
            '@builtinFunctions': 'predefined',
            '@default': 'identifier',
          },
        },
      ],
      { include: '@whitespace' },
      [/[{}()\[\]]/, '@brackets'],
      [/[<>](?!@symbols)/, '@brackets'],
      [
        /@symbols/,
        {
          cases: {
            '@operators': 'operator',
            '@default': '',
          },
        },
      ],
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/\d+/, 'number'],
      [/[;,.]/, 'delimiter'],
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],
    ],
    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/--.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
    ],
    comment: [
      [/[^\/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[\/*]/, 'comment'],
    ],
    string_double: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string', '@pop'],
    ],
    string_single: [
      [/[^\\']+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/'/, 'string', '@pop'],
    ],
  },
}

// ─── RQL Theme ───────────────────────────────────────────────────────────────

const hex = (color: string) => color.slice(1)

export const rqlThemeData = {
  base: 'vs-dark' as const,
  inherit: false,
  rules: [
    { token: 'keyword', foreground: hex(palette.mauve), fontStyle: 'bold' },
    { token: 'predefined', foreground: hex(palette.blue) },
    { token: 'identifier', foreground: hex(palette.text) },
    { token: 'string', foreground: hex(palette.green) },
    { token: 'string.escape', foreground: hex(palette.pink) },
    { token: 'number', foreground: hex(palette.peach) },
    { token: 'number.float', foreground: hex(palette.peach) },
    { token: 'number.hex', foreground: hex(palette.peach) },
    { token: 'operator', foreground: hex(palette.sky) },
    { token: 'delimiter', foreground: hex(palette.overlay1) },
    { token: 'comment', foreground: hex(palette.overlay0), fontStyle: 'italic' },
    { token: 'white', foreground: hex(palette.text) },
  ],
  colors: editorColors,
}

// ─── Registration ─────────────────────────────────────────────────────────────

let languageRegistered = false

/**
 * Registers the `rql` language and `rql-dark` theme with Monaco.
 * Safe to call multiple times — only registers once per page load.
 */
export function registerRqlLanguage(monaco: Monaco): void {
  if (languageRegistered) return
  languageRegistered = true

  monaco.languages.register({ id: RQL_LANGUAGE_ID })
  monaco.languages.setLanguageConfiguration(RQL_LANGUAGE_ID, rqlLanguageConfig)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  monaco.languages.setMonarchTokensProvider(RQL_LANGUAGE_ID, rqlTokensProvider as any)
  monaco.editor.defineTheme(RQL_THEME_NAME, rqlThemeData)
}
