import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Connection {
  id: string
  name: string
  host: string
  port: number
  apiKey?: string
  ssl: boolean
  color?: string
  group?: string
  createdAt: string
  lastUsedAt?: string
}

export interface ConnectionState {
  connections: Connection[]
  activeConnectionId: string | null
  isConnecting: boolean
  connectionError: string | null

  // Actions
  addConnection: (connection: Omit<Connection, 'id' | 'createdAt'>) => void
  updateConnection: (id: string, updates: Partial<Connection>) => void
  deleteConnection: (id: string) => void
  setActiveConnection: (id: string | null) => void
  setConnecting: (isConnecting: boolean) => void
  setConnectionError: (error: string | null) => void
  getConnection: (id: string) => Connection | undefined
  reset: () => void
}

const initialState = {
  connections: [],
  activeConnectionId: null,
  isConnecting: false,
  connectionError: null,
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      ...initialState,

      addConnection: (connection) =>
        set((state) => ({
          connections: [
            ...state.connections,
            {
              ...connection,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      updateConnection: (id, updates) =>
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === id ? { ...conn, ...updates } : conn
          ),
        })),

      deleteConnection: (id) =>
        set((state) => ({
          connections: state.connections.filter((conn) => conn.id !== id),
          activeConnectionId:
            state.activeConnectionId === id ? null : state.activeConnectionId,
        })),

      setActiveConnection: (id) =>
        set((state) => {
          // Update lastUsedAt when connecting
          if (id) {
            return {
              activeConnectionId: id,
              connections: state.connections.map((conn) =>
                conn.id === id
                  ? { ...conn, lastUsedAt: new Date().toISOString() }
                  : conn
              ),
            }
          }
          return { activeConnectionId: id }
        }),

      setConnecting: (isConnecting) => set({ isConnecting }),

      setConnectionError: (connectionError) => set({ connectionError }),

      getConnection: (id) => get().connections.find((conn) => conn.id === id),

      reset: () => set(initialState),
    }),
    {
      name: 'reasondb-connections',
      partialize: (state) => ({
        connections: state.connections.map((conn) => ({
          ...conn,
          apiKey: undefined, // Don't persist API keys to localStorage
        })),
        activeConnectionId: state.activeConnectionId,
      }),
    }
  )
)
