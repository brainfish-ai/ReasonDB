/**
 * Persistent API key storage via tauri-plugin-store.
 *
 * Keys are written to the app data directory
 * (~/.../Application Support/com.reasondb.desktop/api-keys.json) as JSON.
 * This avoids OS keychain prompts while still keeping secrets out of
 * localStorage (which is visible in the webview devtools).
 *
 * The file is protected by normal filesystem permissions — only the
 * logged-in user can read it.  For an application-level API key (not a
 * user password) this is the right trade-off: no UX friction, no prompts.
 */

import { load } from '@tauri-apps/plugin-store'

const STORE_FILE = 'api-keys.json'

async function getStore() {
  return load(STORE_FILE, { autoSave: true })
}

export async function storeApiKey(connectionId: string, apiKey: string): Promise<void> {
  const store = await getStore()
  await store.set(connectionId, apiKey)
}

export async function getApiKey(connectionId: string): Promise<string | null> {
  const store = await getStore()
  const val = await store.get<string>(connectionId)
  return val ?? null
}

export async function deleteApiKey(connectionId: string): Promise<void> {
  const store = await getStore()
  await store.delete(connectionId)
}
