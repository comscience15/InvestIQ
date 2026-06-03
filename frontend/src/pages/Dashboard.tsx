import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, AlertCircle, ChevronDown, ChevronUp, ChevronsUpDown, Settings2 } from 'lucide-react'
import axios from 'axios'
import { fetchTop20 } from '../api'
import type { StockRecommendation } from '../types'
import { useAppStore } from '../store'
import {
  formatPrice, formatLargeNumber,
  scoreColor, rsiColor, riskColor
} from '../utils'
import SignalBadge from '../components/SignalBadge'
import ScoreBar from '../components/ScoreBar'
import LoadingSpinner from '../components/LoadingSpinner'
import BackendLogs from '../components/BackendLogs'

// ── Types ──────────────────────────────────────────────────────────────────
type SortKey =
  | 'signal_score' | 'technical_score' | 'value_score' | 'momentum_score'
  | 'current_price' | 'price_change_pct' | 'market_cap' | 'rsi' | 'pe'
type SortDir = 'asc' | 'desc'

interface ProgressStep { message: string; elapsed_ms: number; done: boolean }
interface ScreenerStatus {
  running: boolean
  elapsed_ms: number
  total_symbols: number
  downloaded_symbols: number
  analyzed_symbols: number
  steps: ProgressStep[]
  error: string | null
}

// ── Progress feed ──────────────────────────────────────────────────────────
function ProgressFeed({ isLoading }: { isLoading: boolean }) {
  const [status, setStatus] = useState<ScreenerStatus | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isLoading) {
      // Keep last status visible after load, stop polling
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    const poll = async () => {
      try {
        const { data } = await axios.get<ScreenerStatus>('/api/screener/status')
        setStatus(data)
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      } catch { /* ignore */ }
    }

    poll()
    intervalRef.current = setInterval(poll, 800)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isLoading])

  if (!status || status.steps.length === 0) return null

  const elapsed = (status.elapsed_ms / 1000).toFixed(1)

  return (
    <div className="card overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border bg-surface">
        <div className="flex items-center gap-2">
          {status.running ? (
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-green-400" />
          )}
          <span className="text-xs font-medium text-slate-300">
            {status.running ? 'Screener Running' : 'Screener Complete'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
          {status.total_symbols > 0 && (
            <>
              <span>{status.downloaded_symbols}/{status.total_symbols} downloaded</span>
              <span>{status.analyzed_symbols} analyzed</span>
            </>
          )}
          <span className="text-brand-400">{elapsed}s</span>
        </div>
      </div>

      {/* Step log */}
      <div className="px-4 py-2 max-h-52 overflow-y-auto space-y-0.5 font-mono text-xs">
        {status.steps.map((step, i) => {
          const t = (step.elapsed_ms / 1000).toFixed(2)
          const isPhase = step.message.startsWith('Phase') || step.message.startsWith('Starting') || step.message.startsWith('Done')
          const isItem = step.message.startsWith('  [')
          return (
            <div
              key={i}
              className={`flex items-start gap-2 py-0.5 ${
                isPhase ? 'text-brand-400' : isItem ? 'text-slate-400' : 'text-slate-300'
              }`}
            >
              <span className="text-slate-600 shrink-0 w-12 text-right">{t}s</span>
              <span className={`leading-tight ${step.done ? 'text-green-400' : ''}`}>
                {step.message}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Progress bar */}
      {status.running && status.total_symbols > 0 && (
        <div className="px-4 pb-2">
          <div className="h-1 bg-surface-border rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all duration-500"
              style={{
                width: `${Math.min(100, (status.downloaded_symbols / status.total_symbols) * 100)}%`
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sort helpers ───────────────────────────────────────────────────────────
function getVal(rec: StockRecommendation, key: SortKey): number {
  if (key === 'rsi') return rec.technical_indicators.rsi ?? -999
  if (key === 'pe') return rec.value_metrics.pe_ratio ?? 999
  const v = rec[key as keyof StockRecommendation]
  return typeof v === 'number' ? v : 0
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const { screenerFilters, setScreenerFilters, setSelectedSymbol, setActiveTab, activeTab } = useAppStore()
  const [sortKey, setSortKey] = useState<SortKey>('signal_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showSettings, setShowSettings] = useState(false)
  const [limitInput, setLimitInput] = useState(String(screenerFilters.limit))

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['top20', screenerFilters],
    queryFn: () => fetchTop20({
      asset_types: screenerFilters.asset_types,
      limit: screenerFilters.limit,
      sector: screenerFilters.sector || undefined,
      max_pe: screenerFilters.max_pe ?? undefined,
      min_roe: screenerFilters.min_roe ?? undefined,
      signal: screenerFilters.signal || undefined,
    }),
    staleTime: 5 * 60 * 1000,
  })

  const openDetail = (symbol: string) => {
    setSelectedSymbol(symbol)
    setActiveTab('charts')
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const applyLimit = () => {
    const n = parseInt(limitInput)
    if (!isNaN(n) && n >= 1 && n <= 100) {
      setScreenerFilters({ limit: n })
    }
  }

  const sorted = [...(data ?? [])].sort((a, b) => {
    const diff = getVal(a, sortKey) - getVal(b, sortKey)
    return sortDir === 'asc' ? diff : -diff
  })

  const buySignals = data?.filter(s => ['STRONG BUY', 'BUY'].includes(s.signal)) ?? []
  const holdSignals = data?.filter(s => s.signal === 'HOLD') ?? []
  const sellSignals = data?.filter(s => ['SELL', 'STRONG SELL'].includes(s.signal)) ?? []

  return (
    <div className="p-6 space-y-4 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Top {screenerFilters.limit} Recommendations
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Ranked by composite signal score · Technical + Value (VI) + Momentum
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings(v => !v)}
            className="btn-ghost flex items-center gap-1.5 text-sm"
          >
            <Settings2 className="w-4 h-4" />
            Settings
          </button>
          {/* Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="card p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Number of results</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1} max={100}
                value={limitInput}
                onChange={e => setLimitInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyLimit()}
                className="w-24 bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white"
              />
              <button onClick={applyLimit} className="btn-primary text-sm px-3 py-1.5">Apply</button>
            </div>
            <p className="text-xs text-slate-600">1–100 · default 20</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Asset Types</label>
            <select
              value={screenerFilters.asset_types}
              onChange={e => setScreenerFilters({ asset_types: e.target.value })}
              className="bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white"
            >
              <option value="stock,etf">Stocks + ETFs</option>
              <option value="stock">Stocks only</option>
              <option value="etf">ETFs only</option>
              <option value="mutual_fund">Mutual Funds</option>
              <option value="stock,etf,mutual_fund">All</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Signal Filter</label>
            <select
              value={screenerFilters.signal}
              onChange={e => setScreenerFilters({ signal: e.target.value })}
              className="bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-sm text-white"
            >
              <option value="">All Signals</option>
              <option value="STRONG BUY">Strong Buy only</option>
              <option value="BUY">Buy only</option>
              <option value="STRONG BUY,BUY">Buy + Strong Buy</option>
              <option value="HOLD">Hold only</option>
              <option value="SELL,STRONG SELL">Sell signals</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Max P/E</label>
            <input
              type="number"
              placeholder="e.g. 25"
              value={screenerFilters.max_pe ?? ''}
              onChange={e => setScreenerFilters({ max_pe: e.target.value ? parseFloat(e.target.value) : null })}
              className="w-24 bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-600"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Min ROE %</label>
            <input
              type="number"
              placeholder="e.g. 15"
              value={screenerFilters.min_roe ?? ''}
              onChange={e => setScreenerFilters({ min_roe: e.target.value ? parseFloat(e.target.value) : null })}
              className="w-24 bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-600"
            />
          </div>
        </div>
      )}

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Screened" value={data.length.toString()} />
          <StatCard label="Buy Signals" value={buySignals.length.toString()} color="text-green-400" />
          <StatCard label="Hold" value={holdSignals.length.toString()} color="text-yellow-400" />
          <StatCard label="Sell Signals" value={sellSignals.length.toString()} color="text-red-400" />
        </div>
      )}

      {/* Progress feed */}
      <ProgressFeed isLoading={isFetching || isLoading} />

      {/* Backend logs — only poll when Dashboard tab is active */}
      <BackendLogs active={activeTab === 'dashboard'} />

      {/* Error state */}
      {error && !isLoading && (
        <div className="card p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-yellow-400 mt-0.5" />
          <div>
            {(error as any)?.response?.status === 503 ? (
              <>
                <p className="font-medium text-yellow-400">Yahoo Finance Rate Limit</p>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                  Too many requests triggered a temporary block on this IP.
                  Wait 10–15 minutes then click Refresh.
                </p>
              </>
            ) : (error as any)?.response?.status === 422 ? (
              <>
                <p className="font-medium text-red-400">Invalid filter settings</p>
                <p className="text-sm text-slate-400 mt-0.5">
                  {(error as any)?.response?.data?.detail?.[0]?.msg ?? 'Check your filter values and try again.'}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-red-400">Failed to load recommendations</p>
                <p className="text-sm text-slate-400 mt-0.5">
                  {(error as any)?.response?.data?.detail
                    ? String((error as any).response.data.detail)
                    : 'Make sure the backend is running on port 8000.'}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {!isLoading && sorted.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <Th label="#" sortKey={null} current={sortKey} dir={sortDir} onSort={handleSort} />
                  <Th label="Symbol" sortKey={null} current={sortKey} dir={sortDir} onSort={handleSort} left />
                  <Th label="Price" sortKey="current_price" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <Th label="Chg %" sortKey="price_change_pct" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <Th label="Signal" sortKey={null} current={sortKey} dir={sortDir} onSort={handleSort} />
                  <Th label="Score ▾" sortKey="signal_score" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <Th label="Tech" sortKey="technical_score" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <Th label="Value" sortKey="value_score" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <Th label="Mom" sortKey="momentum_score" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <Th label="RSI" sortKey="rsi" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <Th label="P/E" sortKey="pe" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <Th label="Mkt Cap" sortKey="market_cap" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <Th label="Risk" sortKey={null} current={sortKey} dir={sortDir} onSort={handleSort} />
                  <Th label="Action" sortKey={null} current={sortKey} dir={sortDir} onSort={handleSort} left />
                </tr>
              </thead>
              <tbody>
                {sorted.map((rec, i) => (
                  <RecommendationRow
                    key={rec.symbol}
                    rank={i + 1}
                    rec={rec}
                    onClick={() => openDetail(rec.symbol)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" message="Running screener… check the progress feed above" />
        </div>
      )}

      {/* Top 3 detail cards */}
      {!isLoading && sorted.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Top 3 — Detailed View</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sorted.slice(0, 3).map(rec => (
              <DetailCard key={rec.symbol} rec={rec} onClick={() => openDetail(rec.symbol)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sortable column header ─────────────────────────────────────────────────
function Th({
  label, sortKey: sk, current, dir, onSort, left = false
}: {
  label: string
  sortKey: SortKey | null
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
  left?: boolean
}) {
  const active = sk !== null && current === sk
  return (
    <th
      onClick={() => sk && onSort(sk)}
      className={`px-3 py-3 text-slate-400 font-medium text-xs select-none
        ${sk ? 'cursor-pointer hover:text-white' : ''}
        ${left ? 'text-left' : 'text-right'}
        ${active ? 'text-white' : ''}`}
    >
      <span className={`inline-flex items-center gap-0.5 ${left ? '' : 'justify-end'}`}>
        {label}
        {sk && (
          active
            ? (dir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)
            : <ChevronsUpDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  )
}

// ── Table row ──────────────────────────────────────────────────────────────
function RecommendationRow({ rank, rec, onClick }: {
  rank: number; rec: StockRecommendation; onClick: () => void
}) {
  const isPos = rec.price_change_pct >= 0
  return (
    <tr
      onClick={onClick}
      className="border-b border-surface-border hover:bg-surface-hover cursor-pointer transition-colors"
    >
      <td className="px-3 py-3 text-slate-500 font-mono text-xs text-right">{rank}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div>
            <p className="font-semibold text-white">{rec.symbol}</p>
            <p className="text-xs text-slate-500 max-w-[130px] truncate">{rec.name}</p>
          </div>
          <span className="text-xs text-slate-600 bg-surface border border-surface-border px-1 py-0.5 rounded uppercase">
            {rec.asset_type}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 text-right font-mono text-white">{formatPrice(rec.current_price)}</td>
      <td className={`px-3 py-3 text-right font-mono text-xs ${isPos ? 'text-green-400' : 'text-red-400'}`}>
        {isPos ? '+' : ''}{rec.price_change_pct.toFixed(2)}%
      </td>
      <td className="px-3 py-3 text-center"><SignalBadge signal={rec.signal} /></td>
      <td className="px-3 py-3 text-right">
        <span className={`font-bold font-mono text-sm ${scoreColor(rec.signal_score)}`}>
          {rec.signal_score.toFixed(0)}
        </span>
      </td>
      <td className="px-3 py-3 text-right">
        <MiniScorePill value={rec.technical_score} />
      </td>
      <td className="px-3 py-3 text-right">
        <MiniScorePill value={rec.value_score} />
      </td>
      <td className="px-3 py-3 text-right">
        <MiniScorePill value={rec.momentum_score} />
      </td>
      <td className={`px-3 py-3 text-right font-mono text-xs ${rsiColor(rec.technical_indicators.rsi)}`}>
        {rec.technical_indicators.rsi?.toFixed(0) ?? '—'}
      </td>
      <td className="px-3 py-3 text-right font-mono text-xs text-slate-300">
        {rec.value_metrics.pe_ratio?.toFixed(1) ?? '—'}
      </td>
      <td className="px-3 py-3 text-right text-xs text-slate-400">
        {formatLargeNumber(rec.market_cap)}
      </td>
      <td className="px-3 py-3 text-center">
        <span className={`text-xs font-medium ${riskColor(rec.risk_level)}`}>{rec.risk_level}</span>
      </td>
      <td className="px-3 py-3 text-xs text-slate-400 max-w-[180px] truncate">
        {rec.rebalance_action?.split('—')[0]?.trim()}
      </td>
    </tr>
  )
}

function MiniScorePill({ value }: { value: number }) {
  return (
    <span className={`font-mono text-xs ${scoreColor(value)}`}>
      {value.toFixed(0)}
    </span>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, color = 'text-white' }: {
  label: string; value: string; color?: string
}) {
  return (
    <div className="card px-4 py-3">
      <p className="text-slate-400 text-xs font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

// ── Detail card ────────────────────────────────────────────────────────────
function DetailCard({ rec, onClick }: { rec: StockRecommendation; onClick: () => void }) {
  const isPos = rec.price_change_pct >= 0
  return (
    <div
      onClick={onClick}
      className="card p-4 cursor-pointer hover:border-brand-600/40 transition-colors space-y-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white font-bold text-lg">{rec.symbol}</p>
          <p className="text-slate-400 text-xs truncate max-w-[160px]">{rec.name}</p>
        </div>
        <SignalBadge signal={rec.signal} />
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-white text-xl font-mono">{formatPrice(rec.current_price)}</span>
        <span className={`text-sm font-mono ${isPos ? 'text-green-400' : 'text-red-400'}`}>
          {isPos ? '+' : ''}{rec.price_change_pct.toFixed(2)}%
        </span>
      </div>

      <div className="space-y-2">
        <ScoreBar label="Technical" score={rec.technical_score} />
        <ScoreBar label="Value (VI)" score={rec.value_score} />
        <ScoreBar label="Momentum" score={rec.momentum_score} />
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {[
          ['P/E', rec.value_metrics.pe_ratio?.toFixed(1)],
          ['ROE', rec.value_metrics.roe ? `${rec.value_metrics.roe.toFixed(1)}%` : null],
          ['RSI', rec.technical_indicators.rsi?.toFixed(0)],
          ['Risk', rec.risk_level],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface border border-surface-border rounded px-2 py-1 flex justify-between">
            <span className="text-slate-500">{label}</span>
            <span className="text-slate-300 font-medium">{value ?? '—'}</span>
          </div>
        ))}
      </div>

      {rec.reasoning.length > 0 && (
        <div className="border-t border-surface-border pt-3 space-y-1">
          {rec.reasoning.slice(0, 3).map((r, i) => (
            <p key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
              <span className="text-brand-400 mt-0.5 shrink-0">•</span>{r}
            </p>
          ))}
        </div>
      )}

      {rec.target_price && (
        <div className="flex justify-between text-xs border-t border-surface-border pt-2">
          <span className="text-slate-500">Target</span>
          <span className="text-green-400 font-mono">{formatPrice(rec.target_price)}</span>
          <span className="text-slate-500">Stop</span>
          <span className="text-red-400 font-mono">{formatPrice(rec.stop_loss)}</span>
        </div>
      )}
    </div>
  )
}
