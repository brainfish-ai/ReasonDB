/**
 * SQL Completion Engine
 * 
 * Uses node-sql-parser for AST-based context detection
 * and provides intelligent autocompletion suggestions.
 */

import { Parser } from 'node-sql-parser'
import type * as Monaco from 'monaco-editor'

// Schema types
export interface ColumnSchema {
  name: string
  type: string
  nullable?: boolean
  primaryKey?: boolean
}

export interface TableSchema {
  name: string
  columns: ColumnSchema[]
}

export interface DatabaseSchema {
  tables: TableSchema[]
}

// Completion context
export type CompletionContext = 
  | 'keyword'      // Start of query or after complete clause
  | 'table'        // After FROM, INTO, UPDATE, JOIN
  | 'column'       // After SELECT, WHERE field position
  | 'operator'     // After column in WHERE
  | 'value'        // After operator
  | 'alias'        // After table reference with alias

// Parser instance (reused)
const parser = new Parser()

// Current database schema (updated via setSchema)
let currentSchema: DatabaseSchema = { tables: [] }

// Table aliases in current query
let tableAliases: Map<string, string> = new Map()

/**
 * Update the schema for autocompletion
 */
export function setSchema(schema: DatabaseSchema) {
  currentSchema = schema
}

/**
 * Extract all field paths from a nested object
 * Returns paths like "metadata.author", "metadata.author.name", etc.
 */
function extractFieldPaths(obj: unknown, prefix = '', maxDepth = 4): string[] {
  if (maxDepth <= 0 || obj === null || typeof obj !== 'object') {
    return []
  }
  
  const paths: string[] = []
  
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullPath = prefix ? `${prefix}.${key}` : key
    paths.push(fullPath)
    
    // Recurse into nested objects (but not arrays)
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...extractFieldPaths(value, fullPath, maxDepth - 1))
    }
  }
  
  return paths
}

/**
 * Infer type from a value
 */
function inferType(value: unknown): string {
  if (value === null || value === undefined) return 'unknown'
  if (typeof value === 'string') return 'text'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'float'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'jsonb'
  return 'unknown'
}

/**
 * Get value at a nested path
 */
function getValueAtPath(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  
  return current
}

/**
 * Server-side metadata schema field
 */
export interface MetadataSchemaField {
  path: string
  field_type: string
  occurrence_count?: number
}

/**
 * Update metadata fields for a specific table from server-side schema response
 * This is more efficient than extracting from documents client-side
 */
export function updateTableMetadataFieldsFromSchema(
  tableName: string,
  fields: MetadataSchemaField[]
) {
  // Find the table in current schema
  const tableIndex = currentSchema.tables.findIndex(
    t => t.name.toLowerCase() === tableName.toLowerCase()
  )
  
  if (tableIndex === -1 || fields.length === 0) {
    return
  }
  
  // Get existing columns (excluding old metadata.* columns to avoid duplicates)
  const existingColumns = currentSchema.tables[tableIndex].columns.filter(
    col => !col.name.startsWith('metadata.')
  )
  
  // Create new columns for metadata fields (prepend "metadata." prefix)
  const metadataColumns: ColumnSchema[] = fields.map(field => ({
    name: `metadata.${field.path}`,
    type: field.field_type,
  }))
  
  // Update the table's columns
  currentSchema.tables[tableIndex].columns = [...existingColumns, ...metadataColumns]
}

/**
 * Update metadata fields for a specific table based on document data (client-side extraction)
 * Use updateTableMetadataFieldsFromSchema for server-side extraction when available
 */
export function updateTableMetadataFields(
  tableName: string,
  documents: Array<{ metadata?: Record<string, unknown> }>
) {
  // Find the table in current schema
  const tableIndex = currentSchema.tables.findIndex(
    t => t.name.toLowerCase() === tableName.toLowerCase()
  )
  
  if (tableIndex === -1) {
    return
  }
  
  // Extract all unique metadata field paths from documents
  const fieldPaths = new Set<string>()
  const fieldTypes = new Map<string, string>()
  
  for (const doc of documents) {
    if (doc.metadata && typeof doc.metadata === 'object') {
      const paths = extractFieldPaths(doc.metadata, 'metadata')
      for (const path of paths) {
        fieldPaths.add(path)
        // Try to infer type from first non-null value
        if (!fieldTypes.has(path)) {
          const value = getValueAtPath(doc, path)
          if (value !== undefined && value !== null) {
            fieldTypes.set(path, inferType(value))
          }
        }
      }
    }
  }
  
  if (fieldPaths.size === 0) {
    return
  }
  
  // Get existing columns (excluding old metadata.* columns to avoid duplicates)
  const existingColumns = currentSchema.tables[tableIndex].columns.filter(
    col => !col.name.startsWith('metadata.')
  )
  
  // Create new columns for metadata fields
  const metadataColumns: ColumnSchema[] = Array.from(fieldPaths)
    .sort()
    .map(path => ({
      name: path,
      type: fieldTypes.get(path) || 'unknown',
    }))
  
  // Update the table's columns
  currentSchema.tables[tableIndex].columns = [...existingColumns, ...metadataColumns]
}

/**
 * Get the current schema
 */
export function getSchema(): DatabaseSchema {
  return currentSchema
}

/**
 * Parse query and extract table aliases
 */
function extractAliases(sql: string): Map<string, string> {
  const aliases = new Map<string, string>()
  
  try {
    // Try to parse - might fail for incomplete queries
    const ast = parser.astify(sql, { database: 'PostgreSQL' })
    
    if (ast && !Array.isArray(ast) && ast.type === 'select' && ast.from && Array.isArray(ast.from)) {
      for (const fromItem of ast.from) {
        if (fromItem && typeof fromItem === 'object' && 'table' in fromItem && 'as' in fromItem) {
          aliases.set(String(fromItem.as), String(fromItem.table))
        }
      }
    }
  } catch {
    // Fallback: regex-based alias extraction for incomplete queries
    const aliasRegex = /\bFROM\s+(\w+)\s+(?:AS\s+)?(\w+)/gi
    let match
    while ((match = aliasRegex.exec(sql)) !== null) {
      aliases.set(match[2], match[1])
    }
    
    const joinAliasRegex = /\bJOIN\s+(\w+)\s+(?:AS\s+)?(\w+)/gi
    while ((match = joinAliasRegex.exec(sql)) !== null) {
      aliases.set(match[2], match[1])
    }
  }
  
  return aliases
}

/**
 * Detect completion context from cursor position
 */
export function detectContext(sql: string, cursorOffset: number): {
  context: CompletionContext
  prefix: string
  tableName?: string  // For alias.column completion
} {
  const textBefore = sql.substring(0, cursorOffset)
  const trimmedText = textBefore.trim()
  const upperText = trimmedText.toUpperCase()
  
  // Update aliases
  tableAliases = extractAliases(sql)
  
  // Check if we're typing after a dot (alias.column or table.column)
  // But NOT if there's a space after it (then we need operator)
  const dotMatch = trimmedText.match(/(\w+)\.(\w*)$/i)
  if (dotMatch && !textBefore.endsWith(' ')) {
    const [, tableOrAlias, columnPrefix] = dotMatch
    // Resolve alias to table name
    const tableName = tableAliases.get(tableOrAlias) || tableOrAlias
    return { context: 'column', prefix: columnPrefix || '', tableName }
  }
  
  // Get the word being typed
  const wordMatch = trimmedText.match(/(\w*)$/i)
  const prefix = wordMatch ? wordMatch[1] : ''
  
  // After FROM, JOIN, INTO, UPDATE - expect table
  if (/\b(FROM|JOIN|INTO|UPDATE|TABLE)\s*$/i.test(upperText)) {
    return { context: 'table', prefix }
  }
  
  // After FROM/JOIN/INTO/UPDATE + partial table name being typed (no space after)
  // This catches cases like "FROM kno" where "kno" is partial table name
  if (/\b(FROM|JOIN|INTO|UPDATE|TABLE)\s+\w+$/i.test(trimmedText) && !textBefore.endsWith(' ')) {
    return { context: 'table', prefix }
  }
  
  // After WHERE/AND/OR + identifier (column or table.column) + space - expect operator
  // This checks if we have a column name followed by space, indicating we need an operator
  if (/\b(WHERE|AND|OR|HAVING)\s+[\w.]+\s+$/i.test(textBefore)) {
    return { context: 'operator', prefix }
  }
  
  // After operator - expect value
  if (/\b(WHERE|AND|OR)\s+[\w.]+\s+(=|!=|<>|>|<|>=|<=|LIKE|IN|BETWEEN)\s*$/i.test(upperText)) {
    return { context: 'value', prefix }
  }
  
  // Right after SELECT - expect columns
  if (/\bSELECT\s*$/i.test(upperText)) {
    return { context: 'column', prefix }
  }
  
  // After SELECT with comma - expect more columns
  if (/\bSELECT\s+.*,\s*$/i.test(upperText) && !/\bFROM\b/i.test(upperText)) {
    return { context: 'column', prefix }
  }
  
  // After WHERE/AND/OR only - expect column
  if (/\b(WHERE|AND|OR|HAVING)\s*$/i.test(upperText)) {
    return { context: 'column', prefix }
  }
  
  // After WHERE/AND/OR + partial column name being typed (no space after)
  // This catches cases like "WHERE kno" where "kno" is partial column name
  if (/\b(WHERE|AND|OR|HAVING)\s+\w+$/i.test(trimmedText) && !textBefore.endsWith(' ')) {
    return { context: 'column', prefix }
  }
  
  // After ORDER BY / GROUP BY - expect column
  if (/\b(ORDER\s+BY|GROUP\s+BY)\s*$/i.test(upperText)) {
    return { context: 'column', prefix }
  }
  
  // After ORDER BY / GROUP BY + partial column name being typed
  if (/\b(ORDER\s+BY|GROUP\s+BY)\s+\w+$/i.test(trimmedText) && !textBefore.endsWith(' ')) {
    return { context: 'column', prefix }
  }
  
  // After SELECT columns (has FROM to add) - expect keyword
  if (/\bSELECT\s+.+$/i.test(upperText) && !/\bFROM\b/i.test(upperText)) {
    return { context: 'keyword', prefix }
  }
  
  // After FROM table - expect keyword (WHERE, ORDER BY, etc)
  if (/\bFROM\s+\w+(\s+\w+)?\s*$/i.test(upperText)) {
    return { context: 'keyword', prefix }
  }
  
  // Default: keyword
  return { context: 'keyword', prefix }
}

/**
 * Generate completion items based on context
 */
export function getCompletions(
  monaco: typeof Monaco,
  sql: string,
  cursorOffset: number,
  range: Monaco.IRange
): Monaco.languages.CompletionItem[] {
  const { context, prefix, tableName } = detectContext(sql, cursorOffset)
  const items: Monaco.languages.CompletionItem[] = []
  const textBefore = sql.substring(0, cursorOffset).toUpperCase()
  
  switch (context) {
    case 'table': {
      // Show table names
      currentSchema.tables.forEach((table, idx) => {
        if (!prefix || table.name.toLowerCase().startsWith(prefix.toLowerCase())) {
          items.push({
            label: table.name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: table.name,
            detail: `Table (${table.columns.length} columns)`,
            documentation: `Columns: ${table.columns.map(c => c.name).join(', ')}`,
            range,
            sortText: idx.toString().padStart(3, '0'),
          })
        }
      })
      break
    }
    
    case 'column': {
      // If specific table, show only its columns
      if (tableName) {
        const table = currentSchema.tables.find(
          t => t.name.toLowerCase() === tableName.toLowerCase()
        )
        if (table) {
          // Found a table with this name - show its columns
          table.columns.forEach((col, idx) => {
            if (!prefix || col.name.toLowerCase().startsWith(prefix.toLowerCase())) {
              items.push({
                label: col.name,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col.name,
                detail: `${col.type}${col.primaryKey ? ' (PK)' : ''}`,
                range,
                sortText: idx.toString().padStart(3, '0'),
              })
            }
          })
        } else {
          // No table found - might be a column prefix like "metadata."
          // Look for columns that start with "tableName." pattern
          const fullPrefix = prefix ? `${tableName}.${prefix}` : `${tableName}.`
          const fullPrefixLower = fullPrefix.toLowerCase()
          
          currentSchema.tables.forEach((t) => {
            t.columns.forEach((col, idx) => {
              if (col.name.toLowerCase().startsWith(fullPrefixLower)) {
                // Extract the part after the dot for display
                const afterPrefix = col.name.substring(tableName.length + 1)
                items.push({
                  label: afterPrefix,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: afterPrefix,
                  detail: `${col.type} (${col.name})`,
                  range,
                  sortText: idx.toString().padStart(3, '0'),
                })
              }
            })
          })
        }
      } else {
        // Show all columns with table prefix
        const seenColumns = new Set<string>()
        
        // First, add columns without prefix (common ones)
        currentSchema.tables.forEach((table) => {
          table.columns.forEach((col, idx) => {
            if (!prefix || col.name.toLowerCase().startsWith(prefix.toLowerCase())) {
              if (!seenColumns.has(col.name)) {
                seenColumns.add(col.name)
                items.push({
                  label: col.name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: col.name,
                  detail: col.type,
                  range,
                  sortText: `0${idx.toString().padStart(3, '0')}`,
                })
              }
            }
          })
        })
        
        // Then, add table.column format
        currentSchema.tables.forEach((table) => {
          table.columns.forEach((col, idx) => {
            const fullName = `${table.name}.${col.name}`
            if (!prefix || fullName.toLowerCase().startsWith(prefix.toLowerCase())) {
              items.push({
                label: fullName,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: fullName,
                detail: `${col.type} from ${table.name}`,
                range,
                sortText: `1${idx.toString().padStart(3, '0')}`,
              })
            }
          })
        })
        
        // Add * for SELECT
        if (/\bSELECT\s*$/i.test(textBefore) || /,\s*$/i.test(textBefore)) {
          items.unshift({
            label: '*',
            kind: monaco.languages.CompletionItemKind.Constant,
            insertText: '* ',
            detail: 'All columns',
            range,
            sortText: '00000',
          })
        }
      }
      break
    }
    
    case 'operator': {
      const operators = [
        { label: '=', detail: 'Equals' },
        { label: '!=', detail: 'Not equals' },
        { label: '<>', detail: 'Not equals' },
        { label: '>', detail: 'Greater than' },
        { label: '<', detail: 'Less than' },
        { label: '>=', detail: 'Greater or equal' },
        { label: '<=', detail: 'Less or equal' },
        { label: 'LIKE', detail: 'Pattern match', insertText: "LIKE '%${1}%'" },
        { label: 'NOT LIKE', detail: 'Not pattern match', insertText: "NOT LIKE '%${1}%'" },
        { label: 'IN', detail: 'In list', insertText: 'IN (${1})' },
        { label: 'NOT IN', detail: 'Not in list', insertText: 'NOT IN (${1})' },
        { label: 'BETWEEN', detail: 'Range', insertText: 'BETWEEN ${1} AND ${2}' },
        { label: 'IS NULL', detail: 'Is null' },
        { label: 'IS NOT NULL', detail: 'Is not null' },
        { label: 'CONTAINS', detail: 'Contains text (ReasonDB)', insertText: "CONTAINS '${1}'" },
      ]
      
      operators.forEach((op, idx) => {
        items.push({
          label: op.label,
          kind: monaco.languages.CompletionItemKind.Operator,
          insertText: op.insertText || `${op.label} `,
          insertTextRules: op.insertText 
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet 
            : undefined,
          detail: op.detail,
          range,
          sortText: idx.toString().padStart(3, '0'),
        })
      })
      break
    }
    
    case 'keyword': {
      const hasSelect = /\bSELECT\b/i.test(textBefore)
      const hasFrom = /\bFROM\b/i.test(textBefore)
      const hasWhere = /\bWHERE\b/i.test(textBefore)
      
      let keywords: { label: string; insertText: string; detail: string }[] = []
      
      if (!hasSelect) {
        // Start of query
        keywords = [
          { label: 'SELECT', insertText: 'SELECT ', detail: 'Select data' },
          { label: 'INSERT INTO', insertText: 'INSERT INTO ${1:table} (${2:columns}) VALUES (${3:values})', detail: 'Insert data' },
          { label: 'UPDATE', insertText: 'UPDATE ${1:table} SET ${2:column} = ${3:value} WHERE ${4:condition}', detail: 'Update data' },
          { label: 'DELETE FROM', insertText: 'DELETE FROM ${1:table} WHERE ${2:condition}', detail: 'Delete data' },
          { label: 'CREATE TABLE', insertText: 'CREATE TABLE ${1:name} (\n  ${2:columns}\n)', detail: 'Create table' },
          // ReasonDB specific
          { label: 'REASON ABOUT', insertText: 'REASON ABOUT "${1:question}" FROM ${2:table}', detail: 'AI reasoning query' },
          { label: 'SEARCH', insertText: 'SEARCH "${1:query}" IN ${2:table}', detail: 'Semantic search' },
        ]
      } else if (!hasFrom) {
        // After SELECT columns
        keywords = [
          { label: 'FROM', insertText: 'FROM ', detail: 'Specify table' },
        ]
      } else if (!hasWhere) {
        // After FROM table
        keywords = [
          { label: 'WHERE', insertText: 'WHERE ', detail: 'Filter results' },
          { label: 'ORDER BY', insertText: 'ORDER BY ${1:column} ${2|ASC,DESC|}', detail: 'Sort results' },
          { label: 'GROUP BY', insertText: 'GROUP BY ${1:column}', detail: 'Group results' },
          { label: 'LIMIT', insertText: 'LIMIT ${1:10}', detail: 'Limit results' },
          { label: 'JOIN', insertText: 'JOIN ${1:table} ON ${2:condition}', detail: 'Join table' },
          { label: 'LEFT JOIN', insertText: 'LEFT JOIN ${1:table} ON ${2:condition}', detail: 'Left join' },
        ]
      } else {
        // After WHERE
        keywords = [
          { label: 'AND', insertText: 'AND ', detail: 'Add condition' },
          { label: 'OR', insertText: 'OR ', detail: 'Alternative condition' },
          { label: 'ORDER BY', insertText: 'ORDER BY ${1:column} ${2|ASC,DESC|}', detail: 'Sort results' },
          { label: 'GROUP BY', insertText: 'GROUP BY ${1:column}', detail: 'Group results' },
          { label: 'LIMIT', insertText: 'LIMIT ${1:10}', detail: 'Limit results' },
        ]
      }
      
      keywords.forEach((kw, idx) => {
        if (!prefix || kw.label.toLowerCase().startsWith(prefix.toLowerCase())) {
          items.push({
            label: kw.label,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw.insertText,
            insertTextRules: kw.insertText.includes('${')
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
            detail: kw.detail,
            range,
            sortText: idx.toString().padStart(3, '0'),
          })
        }
      })
      break
    }
    
    case 'value': {
      // Could suggest common values or leave empty for user input
      items.push({
        label: "'value'",
        kind: monaco.languages.CompletionItemKind.Value,
        insertText: "'${1}'",
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: 'String value',
        range,
      })
      items.push({
        label: 'NULL',
        kind: monaco.languages.CompletionItemKind.Constant,
        insertText: 'NULL',
        detail: 'Null value',
        range,
      })
      break
    }
  }
  
  return items
}
