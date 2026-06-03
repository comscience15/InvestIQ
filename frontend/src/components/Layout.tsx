import { type ReactNode } from 'react'
import {
  LayoutDashboard, TrendingUp, BarChart2, Briefcase,
  Activity, Star, Zap
} from 'lucide-react'
import { cn } from '../utils'
import { useAppStore } from '../store'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'screener',  label: 'Screener',  icon: TrendingUp },
  { id: 'charts',    label: 'Charts',    icon: BarChart2 },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'watchlist', label: 'Watchlist', icon: Star },
  { id: 'aitools',   label: 'AI Tools',  icon: Zap },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { activeTab, setActiveTab } = useAppStore()

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Top bar */}
      <header className="h-14 border-b border-surface-border flex items-center px-6 gap-4 bg-surface-card sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <Activity className="w-6 h-6 text-brand-400" />
          <span className="text-white font-semibold text-lg tracking-tight">InvestIQ</span>
          <span className="text-slate-500 text-xs font-medium bg-surface border border-surface-border px-1.5 py-0.5 rounded">
            BETA
          </span>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1 ml-4">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                activeTab === id
                  ? 'text-white bg-surface-hover'
                  : 'text-slate-400 hover:text-white hover:bg-surface-hover'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden md:block">{label}</span>
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span>Live Data</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border px-6 py-3 flex items-center justify-between text-xs text-slate-600">
        <span>InvestIQ v1.0 · Open Source · For informational purposes only</span>
        <span>Data: Yahoo Finance · Charts: TradingView</span>
      </footer>
    </div>
  )
}
