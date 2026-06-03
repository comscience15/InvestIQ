/**
 * Global app state — Zustand with two-layer persistence:
 *
 *  1. localStorage  (instant restore, survives page refresh)
 *  2. backend/data/user_data.json  (survives port changes, browser clears,
 *                                   machine restarts — true local file)
 *
 * On startup: localStorage is loaded first (instant), then the backend file
 * is fetched and used if it has data (backend wins for portfolio/watchlist).
 * On every portfolio/watchlist/filter change: debounced POST to /api/user-data.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'

// ── Types ──────────────────────────────────────────────────────────────────
export interface Holding { symbol: string; shares: number; avg_cost: number }

interface AppState {
  selectedSymbol: string | null
  watchlist: string[]
  portfolioHoldings: Holding[]
  activeTab: string
  screenerFilters: {
    asset_types: string
    limit: number
    sector: string
    max_pe: number | null
    min_roe: number | null
    signal: string
  }

  setSelectedSymbol: (symbol: string | null) => void
  addToWatchlist: (symbol: string) => void
  removeFromWatchlist: (symbol: string) => void
  addHolding: (h: Holding) => void
  updateHolding: (symbol: string, h: Partial<Holding>) => void
  removeHolding: (symbol: string) => void
  setActiveTab: (tab: string) => void
  setScreenerFilters: (filters: Partial<AppState['screenerFilters']>) => void
  /** Load portfolio + watchlist + filters from backend file (called on startup) */
  hydrateFromBackend: () => Promise<void>
}

// ── Debounced backend save ─────────────────────────────────────────────────
let _saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(state: AppState) {
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(async () => {
    try {
      await axios.post('/api/user-data', {
        portfolioHoldings: state.portfolioHoldings,
        watchlist: state.watchlist,
        screenerFilters: state.screenerFilters,
      })
    } catch {
      // Backend might be starting up — localStorage is the fallback
    }
  }, 500)
}

// ── Store ──────────────────────────────────────────────────────────────────
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedSymbol: null,
      watchlist: [],
      portfolioHoldings: [],
      activeTab: 'dashboard',
      screenerFilters: {
        asset_types: 'stock,etf',
        limit: 20,
        sector: '',
        max_pe: null,
        min_roe: null,
        signal: '',
      },

      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),

      addToWatchlist: (symbol) =>
        set((s) => {
          if (s.watchlist.includes(symbol)) return s
          const next = { watchlist: [...s.watchlist, symbol] }
          scheduleSave({ ...s, ...next })
          return next
        }),

      removeFromWatchlist: (symbol) =>
        set((s) => {
          const next = { watchlist: s.watchlist.filter(w => w !== symbol) }
          scheduleSave({ ...s, ...next })
          return next
        }),

      addHolding: (h) =>
        set((s) => {
          if (s.portfolioHoldings.find(p => p.symbol === h.symbol)) return s
          const next = { portfolioHoldings: [...s.portfolioHoldings, h] }
          scheduleSave({ ...s, ...next })
          return next
        }),

      updateHolding: (symbol, update) =>
        set((s) => {
          const next = {
            portfolioHoldings: s.portfolioHoldings.map(h =>
              h.symbol === symbol ? { ...h, ...update } : h
            ),
          }
          scheduleSave({ ...s, ...next })
          return next
        }),

      removeHolding: (symbol) =>
        set((s) => {
          const next = { portfolioHoldings: s.portfolioHoldings.filter(h => h.symbol !== symbol) }
          scheduleSave({ ...s, ...next })
          return next
        }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setScreenerFilters: (filters) =>
        set((s) => {
          const next = { screenerFilters: { ...s.screenerFilters, ...filters } }
          scheduleSave({ ...s, ...next })
          return next
        }),

      hydrateFromBackend: async () => {
        try {
          const { data } = await axios.get('/api/user-data')
          // Only overwrite if backend has meaningful data
          set((s) => ({
            portfolioHoldings:
              Array.isArray(data.portfolioHoldings) && data.portfolioHoldings.length > 0
                ? data.portfolioHoldings
                : s.portfolioHoldings,
            watchlist:
              Array.isArray(data.watchlist) && data.watchlist.length > 0
                ? data.watchlist
                : s.watchlist,
            screenerFilters:
              data.screenerFilters
                ? { ...s.screenerFilters, ...data.screenerFilters }
                : s.screenerFilters,
          }))
        } catch {
          // Backend not available — localStorage data is used as-is
        }
      },
    }),
    {
      name: 'investiq-store',
      // Only persist UI-state keys in localStorage; data keys sync via backend
      partialize: (s) => ({
        portfolioHoldings: s.portfolioHoldings,
        watchlist: s.watchlist,
        screenerFilters: s.screenerFilters,
        activeTab: s.activeTab,
      }),
    }
  )
)
