import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Star, X, BarChart2, Plus, Search } from 'lucide-react'
import { fetchSymbolDetail, searchSymbols } from '../api'
import { useAppStore } from '../store'
import { formatPrice, scoreColor } from '../utils'
import SignalBadge from '../components/SignalBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import ScoreBar from '../components/ScoreBar'

// ── Individual watchlist card ───────────────────────────────────────────────
function WatchlistItem({ symbol }: { symbol: string }) {
  const { removeFromWatchlist, setSelectedSymbol, setActiveTab } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: ['detail', symbol],
    queryFn: () => fetchSymbolDetail(symbol),
    staleTime: 5 * 60 * 1000,
  })

  const openChart = () => {
    setSelectedSymbol(symbol)
    setActiveTab('charts')
  }

  return (
    <div style={{
      background: '#161b27', border: '1px solid #1e2736', borderRadius: 12,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <LoadingSpinner size="sm" />
          <button onClick={() => removeFromWatchlist(symbol)}
            title={`Remove ${symbol} from watchlist`}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#475569', padding: 2, flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
          >
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>
      ) : data ? (
        <>
          {/* Header row: name | badge | X — all inline, no absolute positioning */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'white', fontWeight: 700, fontSize: 15, margin: 0 }}>{data.symbol}</p>
              <p style={{ color: '#64748b', fontSize: 11, marginTop: 2, margin: '2px 0 0',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {data.name}
              </p>
            </div>
            <SignalBadge signal={data.signal} />
            <button onClick={() => removeFromWatchlist(symbol)}
              title={`Remove ${symbol} from watchlist`}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#475569', padding: '2px 0 0 2px', flexShrink: 0, lineHeight: 1 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
            >
              <X style={{ width: 13, height: 13 }} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: 'white', fontFamily: 'monospace', fontSize: 17, fontWeight: 700 }}>
              {formatPrice(data.current_price)}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 12,
              color: data.price_change_pct >= 0 ? '#22c55e' : '#ef4444' }}>
              {data.price_change_pct >= 0 ? '+' : ''}{data.price_change_pct.toFixed(2)}%
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ScoreBar label="Technical" score={data.technical_score} />
            <ScoreBar label="Value"     score={data.value_score} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            {[
              { label: 'RSI',   value: data.technical_indicators.rsi?.toFixed(0) },
              { label: 'P/E',   value: data.value_metrics.pe_ratio?.toFixed(1) },
              { label: 'Score', value: data.signal_score.toFixed(0), color: scoreColor(data.signal_score) },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: '#0f1117', border: '1px solid #1e2736',
                borderRadius: 6, padding: '4px 0', textAlign: 'center' }}>
                <p style={{ color: '#64748b', fontSize: 10 }}>{label}</p>
                <p style={{ fontFamily: 'monospace', fontSize: 12, color: color ?? '#cbd5e1', fontWeight: 600 }}>
                  {value ?? '—'}
                </p>
              </div>
            ))}
          </div>

          <button onClick={openChart} className="btn-ghost"
            style={{ width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 6, fontSize: 12 }}>
            <BarChart2 style={{ width: 13, height: 13 }} />
            View Chart
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>
            ⚠ Failed to load {symbol}
          </p>
          <button onClick={() => removeFromWatchlist(symbol)}
            title={`Remove ${symbol}`}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#475569', padding: 2, flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
          >
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function Watchlist() {
  const { watchlist, addToWatchlist } = useAppStore()
  const [input, setInput]           = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ symbol: string; type: string }>>([])
  const [showSug, setShowSug]       = useState(false)

  const handleInput = async (val: string) => {
    setInput(val.toUpperCase())
    if (!val) { setSuggestions([]); setShowSug(false); return }
    const res = await searchSymbols(val)
    setSuggestions(res)
    setShowSug(res.length > 0)
  }

  const add = (sym: string) => {
    const s = sym.trim().toUpperCase()
    if (!s) return
    addToWatchlist(s)
    setInput('')
    setSuggestions([])
    setShowSug(false)
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header + Add form */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Star style={{ width: 22, height: 22, color: '#facc15', fill: 'rgba(250,204,21,0.25)' }} />
          <div>
            <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0 }}>Watchlist</h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
              {watchlist.length} {watchlist.length === 1 ? 'symbol' : 'symbols'} · Saved automatically
            </p>
          </div>
        </div>

        {/* Add symbol input */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 10, top: '50%',
                transform: 'translateY(-50%)', width: 14, height: 14, color: '#64748b' }} />
              <input
                value={input}
                onChange={e => handleInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') add(input) }}
                placeholder="Add symbol (e.g. NVDA)…"
                style={{ background: '#161b27', border: '1px solid #1e2736', borderRadius: 8,
                  paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                  color: 'white', fontSize: 13, width: 220, outline: 'none' }}
              />
            </div>
            <button onClick={() => add(input)} className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}>
              <Plus style={{ width: 14, height: 14 }} /> Add
            </button>
          </div>

          {/* Autocomplete suggestions */}
          {showSug && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, width: 260, marginTop: 4,
              background: '#161b27', border: '1px solid #1e2736', borderRadius: 8,
              zIndex: 50, overflow: 'hidden',
            }}>
              {suggestions.map(r => (
                <button key={r.symbol} onClick={() => add(r.symbol)}
                  style={{ width: '100%', padding: '7px 12px', textAlign: 'left',
                    background: 'transparent', border: 'none', color: 'white',
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                    fontSize: 13, borderBottom: '1px solid #1e2736' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1e2d3d')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontWeight: 600 }}>{r.symbol}</span>
                  <span style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>{r.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick-add tips */}
      <div style={{ background: '#0c1a2e', border: '1px solid #1e3a5f', borderRadius: 8,
        padding: '8px 14px', fontSize: 12, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>💡 Type above to add any symbol directly</span>
        <span>· Click <Star style={{ width: 11, height: 11, display: 'inline' }} /> on any row in Dashboard or Charts</span>
        <span>· Click ✕ on a card to remove</span>
      </div>

      {/* Empty state */}
      {watchlist.length === 0 && (
        <div style={{ background: '#161b27', border: '1px solid #1e2736', borderRadius: 12,
          padding: 48, textAlign: 'center' }}>
          <Star style={{ width: 40, height: 40, color: '#334155', margin: '0 auto 12px' }} />
          <p style={{ color: '#94a3b8', fontWeight: 500, marginBottom: 4 }}>Your watchlist is empty</p>
          <p style={{ color: '#475569', fontSize: 13 }}>
            Use the search box above, or click the ★ icon next to any symbol.
          </p>
        </div>
      )}

      {/* Cards grid */}
      {watchlist.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
        }}>
          {watchlist.map(sym => (
            <WatchlistItem key={sym} symbol={sym} />
          ))}
        </div>
      )}
    </div>
  )
}
