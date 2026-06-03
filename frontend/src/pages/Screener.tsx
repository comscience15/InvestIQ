import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Filter, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { fetchTop20 } from '../api'
import type { StockRecommendation } from '../types'
import { useAppStore } from '../store'
import {
  formatPrice, formatLargeNumber, scoreColor, rsiColor, riskColor
} from '../utils'
import SignalBadge from '../components/SignalBadge'
import LoadingSpinner from '../components/LoadingSpinner'

const SECTORS = [
  '', 'Technology', 'Healthcare', 'Financials', 'Consumer Discretionary',
  'Communication Services', 'Industrials', 'Consumer Staples',
  'Energy', 'Materials', 'Utilities', 'Real Estate',
]

const SIGNALS = ['', 'STRONG BUY', 'BUY', 'HOLD', 'SELL', 'STRONG SELL']

type SortKey = keyof StockRecommendation | 'rsi' | 'pe'
type SortDir = 'asc' | 'desc'

export default function Screener() {
  const { setSelectedSymbol, setActiveTab } = useAppStore()
  const [assetTypes, setAssetTypes] = useState('stock,etf')
  const [sector, setSector] = useState('')
  const [signal, setSignal] = useState('')
  const [maxPE, setMaxPE] = useState('')
  const [minROE, setMinROE] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('signal_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showFilters, setShowFilters] = useState(true)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['screener', assetTypes, sector, signal, maxPE, minROE],
    queryFn: () => fetchTop20({
      asset_types: assetTypes,
      limit: 50,
      sector: sector || undefined,
      signal: signal || undefined,
      max_pe: maxPE ? parseFloat(maxPE) : undefined,
      min_roe: minROE ? parseFloat(minROE) : undefined,
    }),
    staleTime: 5 * 60 * 1000,
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const getVal = (rec: StockRecommendation, key: SortKey): number => {
    if (key === 'rsi') return rec.technical_indicators.rsi ?? -999
    if (key === 'pe') return rec.value_metrics.pe_ratio ?? 999
    const v = rec[key as keyof StockRecommendation]
    return typeof v === 'number' ? v : 0
  }

  const filtered = (data ?? [])
    .filter((r) => {
      if (!search) return true
      const q = search.toUpperCase()
      return r.symbol.includes(q) || r.name.toUpperCase().includes(q)
    })
    .sort((a, b) => {
      const diff = getVal(a, sortKey) - getVal(b, sortKey)
      return sortDir === 'asc' ? diff : -diff
    })

  const openChart = (symbol: string) => {
    setSelectedSymbol(symbol)
    setActiveTab('charts')
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
    ) : null

  const Th = ({ label, k, right = false }: { label: string; k: SortKey; right?: boolean }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-3 text-slate-400 font-medium cursor-pointer hover:text-white select-none ${right ? 'text-right' : 'text-left'}`}
    >
      <span className="flex items-center gap-1 justify-end">
        {label}
        <SortIcon k={k} />
      </span>
    </th>
  )

  return (
    <div className="p-6 space-y-4 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Stock Screener</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Filter & rank stocks, ETFs, and mutual funds by any metric
          </p>
        </div>
        <button
          onClick={() => setShowFilters((f) => !f)}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Asset type */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Asset Types</label>
            <select
              value={assetTypes}
              onChange={(e) => setAssetTypes(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white"
            >
              <option value="stock,etf">Stocks + ETFs</option>
              <option value="stock">Stocks only</option>
              <option value="etf">ETFs only</option>
              <option value="mutual_fund">Mutual Funds</option>
              <option value="stock,etf,mutual_fund">All</option>
            </select>
          </div>

          {/* Sector */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Sector</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white"
            >
              {SECTORS.map((s) => <option key={s} value={s}>{s || 'All Sectors'}</option>)}
            </select>
          </div>

          {/* Signal */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Signal Filter</label>
            <select
              value={signal}
              onChange={(e) => setSignal(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white"
            >
              {SIGNALS.map((s) => <option key={s} value={s}>{s || 'All Signals'}</option>)}
            </select>
          </div>

          {/* Max PE */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Max P/E Ratio</label>
            <input
              type="number"
              value={maxPE}
              onChange={(e) => setMaxPE(e.target.value)}
              placeholder="e.g. 25"
              className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white placeholder:text-slate-600"
            />
          </div>

          {/* Min ROE */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Min ROE (%)</label>
            <input
              type="number"
              value={minROE}
              onChange={(e) => setMinROE(e.target.value)}
              placeholder="e.g. 15"
              className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white placeholder:text-slate-600"
            />
          </div>

          {/* Search */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Search Symbol</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value.toUpperCase())}
                placeholder="AAPL, SPY…"
                className="w-full bg-surface border border-surface-border rounded-lg pl-7 pr-2 py-1.5 text-sm text-white placeholder:text-slate-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* Count & loading */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {filtered.length} results
          {isFetching && <span className="ml-2 text-brand-400">· Updating…</span>}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <LoadingSpinner size="lg" message="Running screener…" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left px-3 py-3 text-slate-400 font-medium">Symbol</th>
                  <Th label="Score" k="signal_score" right />
                  <th className="text-center px-3 py-3 text-slate-400 font-medium">Signal</th>
                  <Th label="Price" k="current_price" right />
                  <Th label="Chg%" k="price_change_pct" right />
                  <Th label="Tech" k="technical_score" right />
                  <Th label="Value" k="value_score" right />
                  <Th label="Momentum" k="momentum_score" right />
                  <Th label="RSI" k="rsi" right />
                  <Th label="P/E" k="pe" right />
                  <th className="text-right px-3 py-3 text-slate-400 font-medium">Mkt Cap</th>
                  <th className="text-center px-3 py-3 text-slate-400 font-medium">Risk</th>
                  <th className="text-left px-3 py-3 text-slate-400 font-medium">Horizon</th>
                  <th className="text-left px-3 py-3 text-slate-400 font-medium">Sector</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((rec) => {
                  const isPos = rec.price_change_pct >= 0
                  return (
                    <tr
                      key={rec.symbol}
                      onClick={() => openChart(rec.symbol)}
                      className="border-b border-surface-border hover:bg-surface-hover cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-white">{rec.symbol}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[120px]">{rec.name}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`font-bold font-mono ${scoreColor(rec.signal_score)}`}>
                          {rec.signal_score.toFixed(0)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <SignalBadge signal={rec.signal} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-white">
                        {formatPrice(rec.current_price)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono ${isPos ? 'text-green-400' : 'text-red-400'}`}>
                        {isPos ? '+' : ''}{rec.price_change_pct.toFixed(2)}%
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs ${scoreColor(rec.technical_score)}`}>
                        {rec.technical_score.toFixed(0)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs ${scoreColor(rec.value_score)}`}>
                        {rec.value_score.toFixed(0)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs ${scoreColor(rec.momentum_score)}`}>
                        {rec.momentum_score.toFixed(0)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs ${rsiColor(rec.technical_indicators.rsi)}`}>
                        {rec.technical_indicators.rsi?.toFixed(0) ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-300">
                        {rec.value_metrics.pe_ratio?.toFixed(1) ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-slate-400">
                        {formatLargeNumber(rec.market_cap)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs font-medium ${riskColor(rec.risk_level)}`}>
                          {rec.risk_level}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 max-w-[120px] truncate">
                        {rec.time_horizon}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[100px] truncate">
                        {rec.sector ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
