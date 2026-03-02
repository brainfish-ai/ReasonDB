/**
 * Re-exports the centralized Monaco theme from the shared @reasondb/rql-editor package.
 * Keeping this file so existing imports inside the client app don't need to change.
 */
export {
  palette,
  editorColors,
  THEME_NAME,
  ensureTheme,
} from '@reasondb/rql-editor'
