/**
 * All pages are rendered simultaneously (never unmounted).
 * Inactive pages are hidden with display:none so:
 *   - Local React state (sort order, scroll, filters) is preserved across tab switches
 *   - React Query cache stays associated with mounted components
 *   - TradingView widgets stay initialised
 */
import { useEffect } from 'react'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import Dashboard  from './pages/Dashboard'
import Screener   from './pages/Screener'
import Charts     from './pages/Charts'
import Portfolio  from './pages/Portfolio'
import Watchlist  from './pages/Watchlist'
import AITools    from './pages/AITools'
import { useAppStore } from './store'

const TABS = ['dashboard', 'screener', 'charts', 'portfolio', 'watchlist', 'aitools'] as const
type Tab = typeof TABS[number]

const PAGE_MAP: Record<Tab, React.ReactNode> = {
  dashboard: <ErrorBoundary tab="Dashboard"><Dashboard /></ErrorBoundary>,
  screener:  <ErrorBoundary tab="Screener"><Screener /></ErrorBoundary>,
  charts:    <ErrorBoundary tab="Charts"><Charts /></ErrorBoundary>,
  portfolio: <ErrorBoundary tab="Portfolio"><Portfolio /></ErrorBoundary>,
  watchlist: <ErrorBoundary tab="Watchlist"><Watchlist /></ErrorBoundary>,
  aitools:   <ErrorBoundary tab="AI Tools"><AITools /></ErrorBoundary>,
}

export default function App() {
  const { activeTab, hydrateFromBackend } = useAppStore()

  // On startup: load data from backend/data/user_data.json (survives port changes)
  useEffect(() => { hydrateFromBackend() }, [])

  return (
    <Layout>
      {TABS.map(tab => (
        <div
          key={tab}
          style={{ display: activeTab === tab ? 'block' : 'none' }}
          aria-hidden={activeTab !== tab}
        >
          {PAGE_MAP[tab]}
        </div>
      ))}
    </Layout>
  )
}
