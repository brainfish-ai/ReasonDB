import type * as Monaco from 'monaco-editor'
import { 
  getCompletions, 
  updateTableMetadataFields, 
  updateTableMetadataFieldsFromSchema,
  setValueFetcher,
  type DatabaseSchema, 
} from './sql-completion'
import { useSchemaStore, type MetadataSchemaField } from '@/stores/schemaStore'
import {
  RQL_LANGUAGE_ID,
  RQL_THEME_NAME,
  rqlLanguageConfig,
  rqlTokensProvider,
  rqlThemeData,
  palette,
  editorColors,
} from '@reasondb/rql-editor'

// Re-export shared language primitives so existing imports inside this app don't break
export {
  RQL_LANGUAGE_ID,
  RQL_THEME_NAME,
  rqlLanguageConfig,
  rqlTokensProvider,
  rqlThemeData,
  palette,
  editorColors,
}

// Re-export for convenience
export { 
  updateTableMetadataFields, 
  updateTableMetadataFieldsFromSchema,
  setValueFetcher,
  type DatabaseSchema, 
  type MetadataSchemaField,
}

// Re-export store for direct access
export { useSchemaStore }

// Update tables for autocompletion (converts to store format)
export function updateRqlTables(tables: { id: string; name: string; fields: { name: string; type: string }[] }[]) {
  useSchemaStore.getState().setTables(
    tables.map(t => ({
      id: t.id,
      name: t.name,
      columns: t.fields.map(f => ({ name: f.name, type: f.type }))
    }))
  )
}

// Re-export the shared theme data under the legacy name the client app uses
export { rqlThemeData as rqlTheme }

// Track if language is already registered
let isRegistered = false

// Register RQL language with Monaco (client-app version — adds autocomplete on top of shared base)
export function registerRqlLanguage(monaco: typeof Monaco) {
  if (isRegistered) return
  isRegistered = true

  monaco.languages.register({ id: RQL_LANGUAGE_ID })
  monaco.languages.setLanguageConfiguration(RQL_LANGUAGE_ID, rqlLanguageConfig)
  monaco.languages.setMonarchTokensProvider(RQL_LANGUAGE_ID, rqlTokensProvider as Monaco.languages.IMonarchLanguage)

  // Client-app theme name kept as 'rql-catppuccin' for backwards compat
  monaco.editor.defineTheme('rql-catppuccin', rqlThemeData)

  // Register completion provider using the SQL completion engine
  monaco.languages.registerCompletionItemProvider(RQL_LANGUAGE_ID, {
    triggerCharacters: [' ', '.', ','],
    provideCompletionItems: async (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }
      const fullText = model.getValue()
      const cursorOffset = model.getOffsetAt(position)
      const suggestions = await getCompletions(monaco, fullText, cursorOffset, range)
      return { suggestions }
    },
  })
}

// Re-export for testing (kept for backward compatibility)
export { detectContext as getCompletionContext } from './sql-completion'
