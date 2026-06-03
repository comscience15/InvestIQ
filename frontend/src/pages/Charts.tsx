import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Star, StarOff, Plus, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { fetchSymbolDetail, searchSymbols } from '../api'
import { useAppStore } from '../store'
import {
  formatPrice, formatLargeNumber, formatVolume, scoreColor, rsiColor
} from '../utils'
import TradingViewWidget from '../components/TradingViewWidget'
import SignalBadge from '../components/SignalBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import ScoreBar from '../components/ScoreBar'

// TradingView interval codes
const TV_INTERVALS = [
  { label: '1H',  value: '60'  },
  { label: '4H',  value: '240' },
  { label: '1D',  value: 'D'   },
  { label: '1W',  value: 'W'   },
  { label: '1M',  value: 'M'   },
]

/**
 * Studies presets.
 * - Built-in indicators use  Name@tv-basicstudies
 * - CDC ActionZone V3 2020 is a community Pine Script. The TradingView
 *   embed widget will attempt to load it; if it silently fails the user can
 *   click the "Indicators" button inside the TradingView chart and search for
 *   "CDC ActionZone" to add it manually.
 */
const STUDY_PRESETS: Record<string, string[]> = {
  'RSI + MACD + BB':        ['RSI@tv-basicstudies', 'MACD@tv-basicstudies', 'BB@tv-basicstudies'],
  'RSI + MACD':             ['RSI@tv-basicstudies', 'MACD@tv-basicstudies'],
  'CDC ActionZone V3':      ['RSI@tv-basicstudies', 'MACD@tv-basicstudies', 'CDC ActionZone V3 2020'],
  'Volume + RSI':           ['Volume@tv-basicstudies', 'RSI@tv-basicstudies'],
  'Stoch + RSI':            ['Stochastic@tv-basicstudies', 'RSI@tv-basicstudies'],
  'Stoch + MACD':           ['Stochastic@tv-basicstudies', 'MACD@tv-basicstudies'],
  'ADX + RSI':              ['ADX@tv-basicstudies', 'RSI@tv-basicstudies'],
  'MACD only':              ['MACD@tv-basicstudies'],
  'RSI only':               ['RSI@tv-basicstudies'],
  'No indicators':          [],
}

export default function Charts() {
  const {
    selectedSymbol, setSelectedSymbol,
    watchlist, addToWatchlist, removeFromWatchlist,
    addHolding,
  } = useAppStore()

  const [symbol, setSymbol]           = useState(selectedSymbol ?? 'AAPL')
  const [inputVal, setInputVal]       = useState(symbol)
  const [tvInterval, setTvInterval]   = useState('D')
  const [studyPreset, setStudyPreset] = useState('RSI + MACD + BB')
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; type: string }>>([])
  const [showSearch, setShowSearch]   = useState(false)
  const [addSharesMode, setAddSharesMode] = useState(false)
  const [shares, setShares]           = useState('')
  const [avgCost, setAvgCost]         = useState('')
  /** Hide/show the right side panel so the chart can fill the full width */
  const [panelOpen, setPanelOpen]     = useState(true)

  useEffect(() => {
    if (selectedSymbol) {
      setSymbol(selectedSymbol)
      setInputVal(selectedSymbol)
    }
  }, [selectedSymbol])

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['detail', symbol],
    queryFn: () => fetchSymbolDetail(symbol),
    staleTime: 5 * 60 * 1000,
  })

  const handleSearch = async (q: string) => {
    setInputVal(q.toUpperCase())
    if (!q) { setSearchResults([]); setShowSearch(false); return }
    const results = await searchSymbols(q)
    setSearchResults(results)
    setShowSearch(results.length > 0)
  }

  const selectSymbol = (sym: string) => {
    const s = sym.toUpperCase()
    setSymbol(s)
    setInputVal(s)
    setSelectedSymbol(s)
    setShowSearch(false)
    setSearchResults([])
  }

  const handleAddToPortfolio = () => {
    const s = parseFloat(shares)
    const c = parseFloat(avgCost)
    if (!isNaN(s) && s > 0 && !isNaN(c) && c > 0) {
      addHolding({ symbol, shares: s, avg_cost: c })
      setAddSharesMode(false)
      setShares('')
      setAvgCost('')
    }
  }

  const isWatched = watchlist.includes(symbol)
  const studies   = STUDY_PRESETS[studyPreset] ?? []

  return (
    // No max-width when panel is hidden so chart can use the full viewport
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
      maxWidth: panelOpen ? undefined : '100%' }}>

      {/* ── Control bar ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

        {/* Symbol search */}
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            width: 14, height: 14, color: '#64748b' }} />
          <input
            type="text"
            value={inputVal}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') selectSymbol(inputVal) }}
            placeholder="Symbol (e.g. QCOM)…"
            style={{ background: '#161b27', border: '1px solid #1e2736', borderRadius: 8,
              paddingLeft: 32, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
              color: 'white', fontSize: 14, width: 200, outline: 'none' }}
          />
          {showSearch && searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', marginTop: 4,
              background: '#161b27', border: '1px solid #1e2736', borderRadius: 8,
              zIndex: 50, overflow: 'hidden' }}>
              {searchResults.map(r => (
                <button key={r.symbol} onClick={() => selectSymbol(r.symbol)}
                  style={{ width: '100%', padding: '6px 12px', textAlign: 'left',
                    background: 'transparent', border: 'none', color: 'white',
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}
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

        {/* Watchlist */}
        <button onClick={() => isWatched ? removeFromWatchlist(symbol) : addToWatchlist(symbol)}
          className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          {isWatched
            ? <><Star style={{ width: 14, height: 14, color: '#facc15', fill: '#facc15' }} /><span>Watching</span></>
            : <><StarOff style={{ width: 14, height: 14 }} /><span>Watch</span></>
          }
        </button>

        {/* Portfolio add */}
        <button onClick={() => setAddSharesMode(v => !v)}
          className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus style={{ width: 14, height: 14 }} /> Portfolio
        </button>

        {addSharesMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="number" value={shares} onChange={e => setShares(e.target.value)} placeholder="Shares"
              style={{ width: 80, background: '#0f1117', border: '1px solid #1e2736',
                borderRadius: 6, padding: '4px 8px', color: 'white', fontSize: 13, outline: 'none' }} />
            <input type="number" value={avgCost} onChange={e => setAvgCost(e.target.value)} placeholder="Avg $"
              style={{ width: 90, background: '#0f1117', border: '1px solid #1e2736',
                borderRadius: 6, padding: '4px 8px', color: 'white', fontSize: 13, outline: 'none' }} />
            <button onClick={handleAddToPortfolio} className="btn-primary"
              style={{ fontSize: 12, padding: '4px 12px' }}>Add</button>
          </div>
        )}

        {/* Interval selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <span style={{ color: '#64748b', fontSize: 12, marginRight: 4 }}>Interval:</span>
          {TV_INTERVALS.map(({ label, value }) => (
            <button key={value} onClick={() => setTvInterval(value)} style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              border: '1px solid', outline: 'none',
              borderColor: tvInterval === value ? '#0284c7' : 'transparent',
              background: tvInterval === value ? '#0284c7' : 'transparent',
              color: tvInterval === value ? 'white' : '#94a3b8',
            }}>{label}</button>
          ))}
        </div>

        {/* Studies preset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#64748b', fontSize: 12 }}>Studies:</span>
          <select value={studyPreset} onChange={e => setStudyPreset(e.target.value)}
            style={{ background: '#161b27', border: '1px solid #1e2736', borderRadius: 6,
              color: '#cbd5e1', fontSize: 12, padding: '4px 8px', outline: 'none', cursor: 'pointer' }}>
            {Object.keys(STUDY_PRESETS).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        {/* Panel toggle — lets chart go full width */}
        <button
          onClick={() => setPanelOpen(v => !v)}
          title={panelOpen ? 'Hide analysis panel (full-width chart)' : 'Show analysis panel'}
          style={{ background: '#161b27', border: '1px solid #1e2736', borderRadius: 8,
            padding: '5px 8px', cursor: 'pointer', color: '#94a3b8', display: 'flex',
            alignItems: 'center', gap: 5, fontSize: 12 }}
        >
          {panelOpen
            ? <><PanelRightClose style={{ width: 15, height: 15 }} /><span>Hide Panel</span></>
            : <><PanelRightOpen  style={{ width: 15, height: 15 }} /><span>Show Panel</span></>
          }
        </button>
      </div>

      {/* CDC ActionZone note */}
      {studyPreset === 'CDC ActionZone V3' && (
        <div style={{ background: '#1c2133', border: '1px solid #2d3a50', borderRadius: 8,
          padding: '8px 12px', fontSize: 12, color: '#94a3b8' }}>
          <strong style={{ color: '#38bdf8' }}>CDC ActionZone V3 2020</strong> is a community Pine Script.
          If it doesn't appear automatically, click the{' '}
          <strong style={{ color: 'white' }}>Indicators</strong> button inside the TradingView chart and
          search for <em>"CDC ActionZone"</em> to add it manually.
        </div>
      )}

      {/* ── Main layout ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: panelOpen ? 'minmax(0, 3fr) 320px' : '1fr',
        gap: 12,
        alignItems: 'start',
        width: '100%',
      }}>

        {/* Chart column — fills all available width */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, width: '100%' }}>

          {/* TradingView widget — key forces full remount on symbol/interval/panel change */}
          <div style={{ width: '100%', border: '1px solid #1e2736', borderRadius: 12, overflow: 'hidden' }}>
            <TradingViewWidget
              key={`${symbol}-${tvInterval}-${panelOpen}`}
              symbol={symbol}
              interval={tvInterval}
              initialHeight={520}
              studies={studies}
            />
          </div>

          {/* Chart patterns */}
          {detail?.chart_patterns && detail.chart_patterns.length > 0 && (
            <div className="card p-4">
              <h3 style={{ color: 'white', fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
                Detected Chart Patterns
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {detail.chart_patterns.map((p, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px', borderRadius: 8, fontSize: 12,
                    border: `1px solid ${p.bullish ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    background: p.bullish ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  }}>
                    <span style={{ color: p.bullish ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{p.pattern}</span>
                    <span style={{ color: '#64748b' }}>{(p.confidence * 100).toFixed(0)}%</span>
                    <span style={{ color: '#94a3b8' }}>{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Side panel (hidden when panelOpen = false) ────────────────── */}
        {panelOpen && (
          detailLoading ? (
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
              <LoadingSpinner size="md" message="Loading analysis…" />
            </div>
          ) : detail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10,
              maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', paddingRight: 2 }}>

              {/* Price & signal */}
              <div className="card p-4" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>{detail.symbol}</p>
                    <p style={{ color: '#64748b', fontSize: 12, marginTop: 2, maxWidth: 160, lineHeight: 1.4 }}>{detail.name}</p>
                  </div>
                  <SignalBadge signal={detail.signal} />
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 22, color: 'white', fontFamily: 'monospace', fontWeight: 700 }}>
                    {formatPrice(detail.current_price)}
                  </span>
                  <span style={{ fontSize: 13, fontFamily: 'monospace', color: detail.price_change_pct >= 0 ? '#22c55e' : '#ef4444' }}>
                    {detail.price_change_pct >= 0 ? '+' : ''}{detail.price_change_pct.toFixed(2)}%
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, fontSize: 12 }}>
                  <IR label="52W High" value={formatPrice(detail.week_52_high)} />
                  <IR label="52W Low"  value={formatPrice(detail.week_52_low)} />
                  <IR label="Mkt Cap"  value={formatLargeNumber(detail.market_cap)} />
                  <IR label="Volume"   value={formatVolume(detail.volume)} />
                  <IR label="Risk"     value={detail.risk_level} />
                  <IR label="Horizon"  value={detail.time_horizon.split('(')[0].trim()} />
                </div>

                {detail.target_price && (
                  <div style={{ borderTop: '1px solid #1e2736', paddingTop: 8,
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, fontSize: 12 }}>
                    <IR label="Target"    value={formatPrice(detail.target_price)} highlight="green" />
                    <IR label="Stop Loss" value={formatPrice(detail.stop_loss)}    highlight="red" />
                  </div>
                )}
              </div>

              {/* Scores */}
              <div className="card p-4" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>Signal Score</span>
                  <span className={scoreColor(detail.signal_score)}
                    style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 18 }}>
                    {detail.signal_score.toFixed(0)}/100
                  </span>
                </div>
                <ScoreBar label="Technical"  score={detail.technical_score} />
                <ScoreBar label="Value (VI)" score={detail.value_score} />
                <ScoreBar label="Momentum"   score={detail.momentum_score} />
              </div>

              {/* Technical indicators */}
              <CollapsibleSection title="Technical Indicators">
                <Ind label="RSI (14)"    value={detail.technical_indicators.rsi?.toFixed(1)}
                  valueStyle={{ color: rsiColor(detail.technical_indicators.rsi) as string }} />
                <Ind label="MACD"        value={detail.technical_indicators.macd?.toFixed(3)} />
                <Ind label="MACD Signal" value={detail.technical_indicators.macd_signal?.toFixed(3)} />
                <Ind label="BB Upper"    value={formatPrice(detail.technical_indicators.bb_upper)} />
                <Ind label="BB Middle"   value={formatPrice(detail.technical_indicators.bb_middle)} />
                <Ind label="BB Lower"    value={formatPrice(detail.technical_indicators.bb_lower)} />
                <Ind label="SMA 20"      value={formatPrice(detail.technical_indicators.sma_20)} />
                <Ind label="SMA 50"      value={formatPrice(detail.technical_indicators.sma_50)} />
                <Ind label="SMA 200"     value={formatPrice(detail.technical_indicators.sma_200)} />
                <Ind label="EMA 12"      value={formatPrice(detail.technical_indicators.ema_12)} />
                <Ind label="EMA 26"      value={formatPrice(detail.technical_indicators.ema_26)} />
                <Ind label="ATR (14)"    value={detail.technical_indicators.atr?.toFixed(3)} />
                <Ind label="ADX"         value={detail.technical_indicators.adx?.toFixed(1)} />
                <Ind label="Stoch K"     value={detail.technical_indicators.stoch_k?.toFixed(1)} />
                <Ind label="Stoch D"     value={detail.technical_indicators.stoch_d?.toFixed(1)} />
                <Ind label="CCI"         value={detail.technical_indicators.cci?.toFixed(0)} />
                <Ind label="Williams %R" value={detail.technical_indicators.williams_r?.toFixed(1)} />
              </CollapsibleSection>

              {/* Value Investing */}
              <CollapsibleSection title="Value Investing (VI)">
                <Ind label="P/E Ratio"    value={detail.value_metrics.pe_ratio?.toFixed(1)} />
                <Ind label="P/B Ratio"    value={detail.value_metrics.pb_ratio?.toFixed(2)} />
                <Ind label="P/S Ratio"    value={detail.value_metrics.ps_ratio?.toFixed(2)} />
                <Ind label="PEG Ratio"    value={detail.value_metrics.peg_ratio?.toFixed(2)} />
                <Ind label="EV/EBITDA"    value={detail.value_metrics.ev_ebitda?.toFixed(1)} />
                <Ind label="ROE"          value={detail.value_metrics.roe != null ? `${detail.value_metrics.roe.toFixed(1)}%` : undefined} />
                <Ind label="ROA"          value={detail.value_metrics.roa != null ? `${detail.value_metrics.roa.toFixed(1)}%` : undefined} />
                <Ind label="Debt / Equity" value={detail.value_metrics.debt_to_equity?.toFixed(2)} />
                <Ind label="Current Ratio" value={detail.value_metrics.current_ratio?.toFixed(2)} />
                <Ind label="Gross Margin"  value={detail.value_metrics.gross_margin != null ? `${detail.value_metrics.gross_margin.toFixed(1)}%` : undefined} />
                <Ind label="Net Margin"    value={detail.value_metrics.net_margin != null ? `${detail.value_metrics.net_margin.toFixed(1)}%` : undefined} />
                <Ind label="Rev Growth"    value={detail.value_metrics.revenue_growth != null ? `${detail.value_metrics.revenue_growth.toFixed(1)}%` : undefined} />
                <Ind label="EPS Growth"    value={detail.value_metrics.earnings_growth != null ? `${detail.value_metrics.earnings_growth.toFixed(1)}%` : undefined} />
                <Ind label="Div Yield"     value={detail.value_metrics.dividend_yield != null ? `${detail.value_metrics.dividend_yield.toFixed(2)}%` : undefined} />
                <Ind label="FCF Yield"     value={detail.value_metrics.fcf_yield != null ? `${detail.value_metrics.fcf_yield.toFixed(2)}%` : undefined} />
                {detail.value_metrics.intrinsic_value != null && (
                  <Ind label="Graham Value" value={formatPrice(detail.value_metrics.intrinsic_value)} accent />
                )}
              </CollapsibleSection>

              {/* Reasoning */}
              {detail.reasoning.length > 0 && (
                <CollapsibleSection title="AI Reasoning">
                  {detail.reasoning.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <span style={{ color: '#38bdf8', flexShrink: 0 }}>•</span>
                      <span style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>{r}</span>
                    </div>
                  ))}
                </CollapsibleSection>
              )}

              {/* Rebalance */}
              {detail.rebalance_action && (
                <div style={{ background: '#161b27', border: '1px solid #1e2736',
                  borderLeft: '3px solid #0284c7', borderRadius: 8, padding: '10px 12px' }}>
                  <p style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>Portfolio Recommendation</p>
                  <p style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{detail.rebalance_action}</p>
                </div>
              )}
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────
function IR({ label, value, highlight }: { label: string; value?: string; highlight?: 'green' | 'red' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color: highlight === 'green' ? '#22c55e' : highlight === 'red' ? '#ef4444' : 'white' }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function Ind({ label, value, accent, valueStyle }: {
  label: string; value?: string | null; accent?: boolean; valueStyle?: React.CSSProperties
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '2px 0',
      borderTop: accent ? '1px solid #1e2736' : undefined,
      marginTop: accent ? 4 : 0,
    }}>
      <span style={{ color: '#64748b', fontSize: 12 }}>{label}</span>
      <span style={{
        color: accent ? '#38bdf8' : '#cbd5e1', fontSize: 12,
        fontWeight: accent ? 600 : 400, ...valueStyle
      }}>{value ?? '—'}</span>
    </div>
  )
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ background: '#161b27', border: '1px solid #1e2736', borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', padding: '10px 14px', background: 'transparent', border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
      }}>
        <span style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>{title}</span>
        <span style={{ color: '#64748b', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '0 14px 10px' }}>{children}</div>}
    </div>
  )
}
