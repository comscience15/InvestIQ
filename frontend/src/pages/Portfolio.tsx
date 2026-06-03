import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Plus, Trash2, RefreshCw, TrendingUp, TrendingDown, PieChart, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { analyzePortfolio } from '../api'
import { useAppStore } from '../store'
import type { PortfolioResult } from '../types'
import { formatPrice } from '../utils'
import SignalBadge from '../components/SignalBadge'
import LoadingSpinner from '../components/LoadingSpinner'

type HoldingRow = {
  symbol: string; shares: number; avg_cost: number
  current_price?: number; current_value?: number
  gain_loss?: number; gain_loss_pct?: number
  weight?: number; signal?: string
  rebalance_action?: string; score?: number
}

type SortKey = 'symbol' | 'shares' | 'avg_cost' | 'current_price' | 'current_value' | 'gain_loss' | 'gain_loss_pct' | 'weight' | 'score'
type SortDir = 'asc' | 'desc'

function sortRows(rows: HoldingRow[], key: SortKey, dir: SortDir): HoldingRow[] {
  return [...rows].sort((a, b) => {
    let av: number | string = key === 'symbol' ? a.symbol : (a[key as keyof HoldingRow] as number ?? -Infinity)
    let bv: number | string = key === 'symbol' ? b.symbol : (b[key as keyof HoldingRow] as number ?? -Infinity)
    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    const diff = (av as number) - (bv as number)
    return dir === 'asc' ? diff : -diff
  })
}

// ── Sortable column header ────────────────────────────────────────────────
function Th({
  label, col, current, dir, onSort, right = false,
}: {
  label: string; col: SortKey | null; current: SortKey; dir: SortDir
  onSort: (k: SortKey) => void; right?: boolean
}) {
  const active = col && col === current
  return (
    <th
      onClick={() => col && onSort(col)}
      style={{
        padding: '10px 14px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
        textAlign: right ? 'right' : 'left', userSelect: 'none',
        cursor: col ? 'pointer' : 'default',
        color: active ? '#38bdf8' : '#64748b',
        borderBottom: '1px solid #1e2736',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        {col && (
          active
            ? dir === 'asc'
              ? <ChevronUp style={{ width: 12, height: 12 }} />
              : <ChevronDown style={{ width: 12, height: 12 }} />
            : <ChevronsUpDown style={{ width: 12, height: 12, opacity: 0.3 }} />
        )}
      </span>
    </th>
  )
}

export default function Portfolio() {
  const { portfolioHoldings, addHolding, removeHolding } = useAppStore()
  const [symbol, setSymbol]   = useState('')
  const [shares, setShares]   = useState('')
  const [avgCost, setAvgCost] = useState('')
  const [result, setResult]   = useState<PortfolioResult | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('weight')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const { mutate: analyze, isPending } = useMutation({
    mutationFn: () => analyzePortfolio(portfolioHoldings),
    onSuccess: (data) => setResult(data),
  })

  const handleAdd = () => {
    if (!symbol || !shares || !avgCost) return
    addHolding({ symbol: symbol.toUpperCase(), shares: parseFloat(shares), avg_cost: parseFloat(avgCost) })
    setSymbol(''); setShares(''); setAvgCost('')
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  // Build row data — use analysis result if available, else holdings as-is
  const rawRows: HoldingRow[] = result?.holdings
    ? (result.holdings as HoldingRow[])
    : portfolioHoldings.map(h => ({ ...h }))

  const rows = sortRows(rawRows, sortKey, sortDir)

  const totalGL    = result?.total_gain_loss ?? 0
  const totalGLPct = result?.total_gain_loss_pct ?? 0

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Portfolio Tracker</h1>
        <p style={{ color: '#64748b', fontSize: 13 }}>
          Track holdings, P&L, and get AI-powered rebalancing recommendations
        </p>
      </div>

      {/* ── Add holding form ─────────────────────────────────────────────── */}
      <div className="card p-4">
        <h2 style={{ color: 'white', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Add Holding</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
            placeholder="Symbol (e.g. AAPL)" onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={inputStyle} />
          <input value={shares} onChange={e => setShares(e.target.value)} placeholder="Shares"
            type="number" min="0" onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{ ...inputStyle, width: 100 }} />
          <input value={avgCost} onChange={e => setAvgCost(e.target.value)} placeholder="Avg Cost ($)"
            type="number" min="0" step="0.01" onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{ ...inputStyle, width: 130 }} />
          <button onClick={handleAdd} className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus style={{ width: 14, height: 14 }} /> Add
          </button>
          {portfolioHoldings.length > 0 && (
            <button onClick={() => analyze()} disabled={isPending} className="btn-primary"
              style={{ background: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw style={{ width: 14, height: 14, animation: isPending ? 'spin 1s linear infinite' : 'none' }} />
              Analyze Portfolio
            </button>
          )}
        </div>
      </div>

      {/* ── Holdings table ───────────────────────────────────────────────── */}
      {portfolioHoldings.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e2736',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>
              Holdings ({portfolioHoldings.length})
            </h2>
            <span style={{ color: '#64748b', fontSize: 11 }}>Click column headers to sort</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <Th label="Symbol"   col="symbol"       current={sortKey} dir={sortDir} onSort={handleSort} />
                  <Th label="Shares"   col="shares"       current={sortKey} dir={sortDir} onSort={handleSort} right />
                  <Th label="Avg Cost" col="avg_cost"     current={sortKey} dir={sortDir} onSort={handleSort} right />
                  <Th label="Current"  col="current_price" current={sortKey} dir={sortDir} onSort={handleSort} right />
                  <Th label="Value"    col="current_value" current={sortKey} dir={sortDir} onSort={handleSort} right />
                  <Th label="G/L $"   col="gain_loss"    current={sortKey} dir={sortDir} onSort={handleSort} right />
                  <Th label="G/L %"   col="gain_loss_pct" current={sortKey} dir={sortDir} onSort={handleSort} right />
                  <Th label="Weight"  col="weight"       current={sortKey} dir={sortDir} onSort={handleSort} right />
                  <Th label="Signal"  col={null}         current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th style={{ padding: '10px 14px', borderBottom: '1px solid #1e2736' }} />
                </tr>
              </thead>
              <tbody>
                {rows.map(h => {
                  const gl = h.gain_loss ?? 0
                  const isPos = gl >= 0
                  return (
                    <tr key={h.symbol} style={{ borderBottom: '1px solid #1e2736' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1a2030')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: 'white' }}>{h.symbol}</td>
                      <td style={numCell}>{h.shares}</td>
                      <td style={numCell}>{formatPrice(h.avg_cost)}</td>
                      <td style={numCell}>{h.current_price ? formatPrice(h.current_price) : '—'}</td>
                      <td style={numCell}>{h.current_value ? formatPrice(h.current_value) : '—'}</td>
                      <td style={{ ...numCell, color: h.gain_loss !== undefined ? (isPos ? '#22c55e' : '#ef4444') : '#64748b' }}>
                        {h.gain_loss !== undefined ? `${isPos ? '+' : ''}${formatPrice(h.gain_loss)}` : '—'}
                      </td>
                      <td style={{ ...numCell, color: h.gain_loss_pct !== undefined ? (isPos ? '#22c55e' : '#ef4444') : '#64748b' }}>
                        {h.gain_loss_pct !== undefined ? `${isPos ? '+' : ''}${h.gain_loss_pct.toFixed(2)}%` : '—'}
                      </td>
                      <td style={{ ...numCell, color: '#94a3b8', fontSize: 12 }}>
                        {h.weight !== undefined ? `${h.weight.toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {h.signal
                          ? <SignalBadge signal={h.signal as any} />
                          : <span style={{ color: '#475569' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <button onClick={() => removeHolding(h.symbol)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer',
                            color: '#475569', transition: 'color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
                        >
                          <Trash2 style={{ width: 14, height: 14 }} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Portfolio summary ────────────────────────────────────────────── */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <SummaryCard label="Total Value"  value={formatPrice(result.total_value)}
              icon={<PieChart style={{ width: 14, height: 14, color: '#38bdf8' }} />} />
            <SummaryCard label="Cost Basis"   value={formatPrice(result.total_cost)} />
            <SummaryCard label="Total G/L"    value={`${totalGL >= 0 ? '+' : ''}${formatPrice(totalGL)}`}
              valueColor={totalGL >= 0 ? '#22c55e' : '#ef4444'}
              icon={totalGL >= 0
                ? <TrendingUp  style={{ width: 14, height: 14, color: '#22c55e' }} />
                : <TrendingDown style={{ width: 14, height: 14, color: '#ef4444' }} />}
            />
            <SummaryCard label="Return"
              value={`${totalGLPct >= 0 ? '+' : ''}${totalGLPct.toFixed(2)}%`}
              valueColor={totalGLPct >= 0 ? '#22c55e' : '#ef4444'} />
          </div>

          {/* Allocation bar */}
          {result.holdings.length > 0 && result.holdings[0].weight !== undefined && (
            <div className="card p-4">
              <h3 style={{ color: 'white', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                Portfolio Allocation
              </h3>
              <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden', gap: 1 }}>
                {[...result.holdings]
                  .filter(h => (h.weight ?? 0) > 0)
                  .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
                  .map((h, i) => (
                    <div key={h.symbol}
                      style={{ width: `${h.weight}%`, background: COLORS[i % COLORS.length] }}
                      title={`${h.symbol}: ${h.weight?.toFixed(1)}%`}
                    />
                  ))
                }
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
                {[...result.holdings]
                  .filter(h => (h.weight ?? 0) > 0)
                  .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
                  .map((h, i) => (
                    <div key={h.symbol} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                      <span style={{ color: 'white', fontWeight: 600 }}>{h.symbol}</span>
                      <span style={{ color: '#64748b' }}>{h.weight?.toFixed(1)}%</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      )}

      {isPending && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <LoadingSpinner size="lg" message="Analyzing portfolio…" />
        </div>
      )}

      {portfolioHoldings.length === 0 && (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <PieChart style={{ width: 40, height: 40, color: '#475569', margin: '0 auto 12px' }} />
          <p style={{ color: '#94a3b8', fontWeight: 500 }}>No holdings yet</p>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>
            Add symbols above to track your portfolio
          </p>
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: '#0f1117', border: '1px solid #1e2736', borderRadius: 8,
  padding: '7px 12px', color: 'white', fontSize: 13, width: 150, outline: 'none',
}
const numCell: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#cbd5e1',
}
const COLORS = [
  '#0284c7', '#22c55e', '#eab308', '#8b5cf6',
  '#ec4899', '#f97316', '#14b8a6', '#ef4444', '#6366f1', '#06b6d4',
]

function SummaryCard({ label, value, valueColor = 'white', icon }: {
  label: string; value: string; valueColor?: string; icon?: React.ReactNode
}) {
  return (
    <div className="card p-4" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#64748b', fontSize: 12 }}>{label}</span>
        {icon}
      </div>
      <span style={{ color: valueColor, fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}
