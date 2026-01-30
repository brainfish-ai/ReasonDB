import type * as Monaco from 'monaco-editor'

// RQL Language Definition for Monaco Editor
export const RQL_LANGUAGE_ID = 'rql'

export const rqlLanguageConfig: Monaco.languages.LanguageConfiguration = {
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

export const rqlTokensProvider: Monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.rql',
  ignoreCase: true,

  keywords: [
    // Query operations
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'UPDATE', 'DELETE',
    'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX',
    // Clauses
    'SET', 'VALUES', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
    'IS', 'NULL', 'TRUE', 'FALSE',
    'ORDER', 'BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
    'GROUP', 'HAVING', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON',
    'AS', 'DISTINCT', 'ALL', 'EXISTS',
    // ReasonDB specific
    'REASON', 'ABOUT', 'SEARCH', 'SEMANTIC', 'EMBED', 'SIMILAR', 'TO',
    'SUMMARIZE', 'EXTRACT', 'CHUNK', 'RELATE', 'LINK',
    'WITH', 'CONTEXT', 'THRESHOLD', 'TOP', 'VECTOR',
  ],

  operators: [
    '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
    '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
    '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
    '%=', '<<=', '>>=', '>>>=', '->',
  ],

  builtinFunctions: [
    // Text functions
    'LOWER', 'UPPER', 'TRIM', 'LENGTH', 'SUBSTRING', 'CONCAT', 'REPLACE',
    // Numeric functions
    'ABS', 'CEIL', 'FLOOR', 'ROUND', 'SQRT', 'POW', 'MOD',
    // Aggregate functions
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
    // Date functions
    'NOW', 'DATE', 'TIME', 'YEAR', 'MONTH', 'DAY',
    // ReasonDB specific
    'SIMILARITY', 'DISTANCE', 'EMBEDDING', 'TOKENS', 'CHUNKS',
  ],

  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  tokenizer: {
    root: [
      // Identifiers and keywords
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

      // Whitespace
      { include: '@whitespace' },

      // Delimiters and operators
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

      // Numbers
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/\d+/, 'number'],

      // Delimiter
      [/[;,.]/, 'delimiter'],

      // Strings
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

// RQL Theme colors (Catppuccin Mocha)
export const rqlTheme: Monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'cba6f7', fontStyle: 'bold' }, // Mauve
    { token: 'predefined', foreground: '89b4fa' }, // Blue
    { token: 'identifier', foreground: 'cdd6f4' }, // Text
    { token: 'string', foreground: 'a6e3a1' }, // Green
    { token: 'string.escape', foreground: 'f5c2e7' }, // Pink
    { token: 'number', foreground: 'fab387' }, // Peach
    { token: 'number.float', foreground: 'fab387' },
    { token: 'number.hex', foreground: 'fab387' },
    { token: 'operator', foreground: '89dceb' }, // Sky
    { token: 'delimiter', foreground: '9399b2' }, // Overlay2
    { token: 'comment', foreground: '6c7086', fontStyle: 'italic' }, // Overlay0
    { token: 'white', foreground: 'cdd6f4' },
  ],
  colors: {
    'editor.background': '#1e1e2e', // Base
    'editor.foreground': '#cdd6f4', // Text
    'editor.lineHighlightBackground': '#313244', // Surface0
    'editor.selectionBackground': '#45475a', // Surface1
    'editorCursor.foreground': '#f5e0dc', // Rosewater
    'editorLineNumber.foreground': '#6c7086', // Overlay0
    'editorLineNumber.activeForeground': '#cdd6f4', // Text
    'editorIndentGuide.background': '#313244', // Surface0
    'editorIndentGuide.activeBackground': '#45475a', // Surface1
    'editor.selectionHighlightBackground': '#45475a80',
    'editorBracketMatch.background': '#45475a',
    'editorBracketMatch.border': '#89b4fa',
  },
}

// Auto-completion items for RQL
export function getRqlCompletionItems(
  monaco: typeof Monaco,
  range: Monaco.IRange
): Monaco.languages.CompletionItem[] {
  const keywords = [
    { label: 'SELECT', insertText: 'SELECT ', detail: 'Select columns from table' },
    { label: 'FROM', insertText: 'FROM ', detail: 'Specify table name' },
    { label: 'WHERE', insertText: 'WHERE ', detail: 'Filter conditions' },
    { label: 'INSERT INTO', insertText: 'INSERT INTO ${1:table} (${2:columns}) VALUES (${3:values})', detail: 'Insert new row' },
    { label: 'UPDATE', insertText: 'UPDATE ${1:table} SET ${2:column} = ${3:value}', detail: 'Update existing rows' },
    { label: 'DELETE FROM', insertText: 'DELETE FROM ${1:table} WHERE ${2:condition}', detail: 'Delete rows' },
    { label: 'CREATE TABLE', insertText: 'CREATE TABLE ${1:name} (\n  ${2:columns}\n)', detail: 'Create new table' },
    { label: 'ORDER BY', insertText: 'ORDER BY ${1:column} ${2|ASC,DESC|}', detail: 'Sort results' },
    { label: 'LIMIT', insertText: 'LIMIT ${1:10}', detail: 'Limit number of results' },
    { label: 'GROUP BY', insertText: 'GROUP BY ${1:column}', detail: 'Group results' },
    // ReasonDB specific
    { label: 'REASON ABOUT', insertText: 'REASON ABOUT "${1:question}" FROM ${2:table}', detail: 'AI-powered reasoning query' },
    { label: 'SEARCH SEMANTIC', insertText: 'SEARCH SEMANTIC "${1:query}" IN ${2:table}', detail: 'Semantic search' },
    { label: 'SIMILAR TO', insertText: 'SIMILAR TO ${1:document_id} IN ${2:table} LIMIT ${3:10}', detail: 'Find similar documents' },
    { label: 'SUMMARIZE', insertText: 'SUMMARIZE ${1:column} FROM ${2:table}', detail: 'AI summarization' },
    { label: 'EXTRACT', insertText: 'EXTRACT ${1:entity_type} FROM ${2:column}', detail: 'Entity extraction' },
  ]

  return keywords.map((k) => ({
    label: k.label,
    kind: monaco.languages.CompletionItemKind.Keyword,
    insertText: k.insertText,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    detail: k.detail,
    range,
  }))
}

// Register RQL language with Monaco
export function registerRqlLanguage(monaco: typeof Monaco) {
  // Register language
  monaco.languages.register({ id: RQL_LANGUAGE_ID })

  // Set language configuration
  monaco.languages.setLanguageConfiguration(RQL_LANGUAGE_ID, rqlLanguageConfig)

  // Set tokenizer
  monaco.languages.setMonarchTokensProvider(RQL_LANGUAGE_ID, rqlTokensProvider)

  // Register theme
  monaco.editor.defineTheme('rql-catppuccin', rqlTheme)

  // Register completion provider
  monaco.languages.registerCompletionItemProvider(RQL_LANGUAGE_ID, {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }
      return {
        suggestions: getRqlCompletionItems(monaco, range),
      }
    },
  })
}
