/**
 * AI Tools — MCP + CDP integration guide for InvestIQ.
 *
 * Strategy chosen: Option 2 (MCP + CDP)
 *   • MCP  → Claude calls InvestIQ APIs directly (no browser needed)
 *   • CDP  → Claude controls Chrome/TradingView for chart automation & backtesting
 */
import { useState } from 'react'
import { Copy, Check, Terminal, Zap, Globe, Code2, BookOpen, ChevronDown, ChevronRight } from 'lucide-react'

// ── Copy-to-clipboard hook ─────────────────────────────────────────────────
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }
  return { copied, copy }
}

// ── Collapsible section ────────────────────────────────────────────────────
function Section({ title, icon, badge, defaultOpen = false, children }: {
  title: string; icon: React.ReactNode; badge?: string
  defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: '#161b27', border: '1px solid #1e2736', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', padding: '14px 18px', background: 'transparent', border: 'none',
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
      }}>
        <span style={{ color: '#38bdf8' }}>{icon}</span>
        <span style={{ color: 'white', fontWeight: 600, fontSize: 15, flex: 1, textAlign: 'left' }}>{title}</span>
        {badge && (
          <span style={{ background: '#0c4a6e', color: '#38bdf8', fontSize: 11, padding: '2px 8px',
            borderRadius: 20, fontWeight: 600 }}>{badge}</span>
        )}
        <span style={{ color: '#64748b' }}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
      </button>
      {open && <div style={{ padding: '0 18px 16px' }}>{children}</div>}
    </div>
  )
}

// ── Code block with copy button ────────────────────────────────────────────
function CodeBlock({ id, code, lang = 'json', note }: {
  id: string; code: string; lang?: string; note?: string
}) {
  const { copied, copy } = useCopy()
  return (
    <div style={{ marginTop: 10 }}>
      {note && <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>{note}</p>}
      <div style={{ position: 'relative', background: '#0f1117', border: '1px solid #1e2736',
        borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 12px', borderBottom: '1px solid #1e2736', background: '#161b27' }}>
          <span style={{ color: '#64748b', fontSize: 11, fontFamily: 'monospace' }}>{lang}</span>
          <button onClick={() => copy(id, code)} style={{
            display: 'flex', alignItems: 'center', gap: 4, background: 'transparent',
            border: 'none', cursor: 'pointer', color: copied === id ? '#22c55e' : '#64748b', fontSize: 11,
          }}>
            {copied === id ? <Check size={12} /> : <Copy size={12} />}
            {copied === id ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre style={{ margin: 0, padding: '12px 14px', color: '#e2e8f0', fontSize: 12,
          fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {code}
        </pre>
      </div>
    </div>
  )
}

// ── Pine Script templates ──────────────────────────────────────────────────
const PINE_SCRIPTS: Record<string, { title: string; desc: string; tags: string[]; code: string }> = {
  cdc: {
    title: 'CDC ActionZone V3 Strategy',
    desc: 'Color-coded buy/sell zones based on EMA crossovers — great for trending markets.',
    tags: ['Trend', 'EMA', 'Signals'],
    code: `//@version=5
strategy("CDC ActionZone V3 Strategy", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

fast = input.int(12, "Fast EMA")
slow = input.int(26, "Slow EMA")

emaFast = ta.ema(close, fast)
emaSlow = ta.ema(close, slow)

bullZone = emaFast > emaSlow and close > emaFast
bearZone = emaFast < emaSlow and close < emaFast

barColor = bullZone ? color.green : bearZone ? color.red : color.gray
barcolor(barColor)

plot(emaFast, "Fast EMA", color=color.yellow, linewidth=2)
plot(emaSlow, "Slow EMA", color=color.blue, linewidth=2)

if bullZone and not bullZone[1]
    strategy.entry("Long", strategy.long)
if bearZone and not bearZone[1]
    strategy.close("Long")
    strategy.entry("Short", strategy.short)`,
  },
  rsi_divergence: {
    title: 'RSI Divergence Scanner',
    desc: 'Detects bullish and bearish RSI divergences — high-probability reversal signals.',
    tags: ['RSI', 'Divergence', 'Reversal'],
    code: `//@version=5
indicator("RSI Divergence Scanner", overlay=false)

rsiLen  = input.int(14, "RSI Length")
rsiVal  = ta.rsi(close, rsiLen)
rsiOb   = input.int(70, "Overbought")
rsiOs   = input.int(30, "Oversold")

plot(rsiVal, "RSI", color=color.purple, linewidth=2)
hline(rsiOb, "OB", color=color.red,   linestyle=hline.style_dashed)
hline(rsiOs, "OS", color=color.green, linestyle=hline.style_dashed)
hline(50,    "Mid",color=color.gray,  linestyle=hline.style_dotted)

// Bullish divergence: lower price low, higher RSI low
priceLow  = ta.lowest(close, 20)
rsiLow    = ta.lowest(rsiVal, 20)
bullDiv   = close == priceLow and rsiVal > rsiLow and rsiVal < rsiOs + 10
bearDiv   = close == ta.highest(close, 20) and rsiVal < ta.highest(rsiVal, 20) and rsiVal > rsiOb - 10

plotshape(bullDiv, "Bull Div", shape.labelup,   location.bottom, color=color.green, text="Bull")
plotshape(bearDiv, "Bear Div", shape.labeldown, location.top,    color=color.red,   text="Bear")

bgcolor(rsiVal < rsiOs ? color.new(color.green, 90) : rsiVal > rsiOb ? color.new(color.red, 90) : na)`,
  },
  value_vi: {
    title: 'Value Investing Screener Overlay',
    desc: 'Marks Graham intrinsic value zones; highlights when price dips below fair value.',
    tags: ['Value', 'Graham', 'Fundamentals'],
    code: `//@version=5
indicator("Value Investing Zones", overlay=true)

// Use 200-period SMA as a proxy for long-term value trend
sma200  = ta.sma(close, 200)
sma50   = ta.sma(close, 50)
sma20   = ta.sma(close, 20)

// Value zone: price below 200 SMA = potentially undervalued
valueZone  = close < sma200 * 0.95
growthZone = close > sma200 * 1.05

plot(sma200, "200 SMA (Value)", color=color.orange,   linewidth=2)
plot(sma50,  "50 SMA",          color=color.yellow,   linewidth=1)
plot(sma20,  "20 SMA",          color=color.aqua,     linewidth=1)

bgcolor(valueZone  ? color.new(color.green, 88) : na, title="Value Zone")
bgcolor(growthZone ? color.new(color.blue,  92) : na, title="Growth Zone")

plotshape(ta.crossover(close, sma200),  "Break Above 200",  shape.triangleup,   location.belowbar, color=color.green, size=size.small)
plotshape(ta.crossunder(close, sma200), "Break Below 200",  shape.triangledown, location.abovebar, color=color.red,   size=size.small)`,
  },
  momentum: {
    title: 'Momentum + MACD Signal',
    desc: 'MACD histogram momentum with trend strength coloring and signal arrows.',
    tags: ['MACD', 'Momentum', 'Trend'],
    code: `//@version=5
indicator("Momentum + MACD Signal", overlay=false)

[macdLine, signalLine, hist] = ta.macd(close, 12, 26, 9)

histColor = hist > 0 and hist > hist[1] ? color.new(color.green, 0)
           : hist > 0                   ? color.new(color.green, 50)
           : hist < 0 and hist < hist[1] ? color.new(color.red,  0)
           :                              color.new(color.red,  50)

plot(macdLine,   "MACD",   color=color.blue,        linewidth=2)
plot(signalLine, "Signal", color=color.orange,      linewidth=1)
plot(hist,       "Hist",   color=histColor,         style=plot.style_histogram, linewidth=3)
hline(0, "Zero", color=color.gray, linestyle=hline.style_dashed)

bullCross = ta.crossover(macdLine, signalLine)
bearCross = ta.crossunder(macdLine, signalLine)

plotshape(bullCross, "Buy", shape.labelup,   location.bottom, color=color.green, text="B", textcolor=color.white)
plotshape(bearCross, "Sell",shape.labeldown, location.top,    color=color.red,   text="S", textcolor=color.white)`,
  },
  golden_death: {
    title: 'Golden / Death Cross Alert',
    desc: '50/200 SMA crossovers — the classic long-term trend change signal.',
    tags: ['SMA', 'Crossover', 'Trend'],
    code: `//@version=5
strategy("Golden / Death Cross", overlay=true)

sma50  = ta.sma(close, 50)
sma200 = ta.sma(close, 200)

goldenCross = ta.crossover(sma50, sma200)
deathCross  = ta.crossunder(sma50, sma200)

plot(sma50,  "50 SMA",  color=color.yellow, linewidth=2)
plot(sma200, "200 SMA", color=color.orange, linewidth=3)

plotshape(goldenCross, "Golden Cross", shape.labelup,   location.belowbar, color=color.gold,  size=size.normal, text="GOLDEN")
plotshape(deathCross,  "Death Cross",  shape.labeldown, location.abovebar, color=color.white, size=size.normal, text="DEATH")

if goldenCross
    alert("Golden Cross on " + syminfo.ticker, alert.freq_once_per_bar_close)
    strategy.entry("Long", strategy.long)
if deathCross
    alert("Death Cross on " + syminfo.ticker, alert.freq_once_per_bar_close)
    strategy.close("Long")`,
  },
  bb_squeeze: {
    title: 'Bollinger Band Squeeze Breakout',
    desc: 'Detects low-volatility squeezes that precede explosive price moves.',
    tags: ['Bollinger', 'Squeeze', 'Volatility'],
    code: `//@version=5
indicator("BB Squeeze Breakout", overlay=true)

length  = input.int(20, "BB Length")
mult    = input.float(2.0, "BB Mult")

basis   = ta.sma(close, length)
dev     = mult * ta.stdev(close, length)
upper   = basis + dev
lower   = basis - dev
bbWidth = (upper - lower) / basis

// Squeeze = BB width at 6-month low
squeeze = bbWidth == ta.lowest(bbWidth, 120)

plot(upper, "Upper BB", color=color.blue)
plot(basis, "Mid BB",   color=color.gray)
plot(lower, "Lower BB", color=color.blue)
bgcolor(squeeze ? color.new(color.yellow, 80) : na, title="Squeeze Zone")

breakoutUp   = squeeze[1] and close > upper
breakoutDown = squeeze[1] and close < lower

plotshape(breakoutUp,   "Breakout Up",   shape.triangleup,   location.belowbar, color=color.green, size=size.small)
plotshape(breakoutDown, "Breakout Down", shape.triangledown, location.abovebar, color=color.red,   size=size.small)`,
  },
}

// ── Claude prompt templates for MCP ────────────────────────────────────────
const MCP_PROMPTS = [
  { label: 'Top Buy Signals', prompt: 'Using InvestIQ, show me the top 10 stocks with BUY or STRONG BUY signals today, sorted by signal score.' },
  { label: 'Analyze a Symbol', prompt: 'Using InvestIQ, give me a full analysis of AAPL — technical indicators, value metrics, chart patterns, and your recommendation.' },
  { label: 'Value Stocks', prompt: 'Using InvestIQ, find stocks with P/E < 15, ROE > 15%, and a BUY signal. Show me the top 5.' },
  { label: 'ETF Scan', prompt: 'Using InvestIQ, scan the top ETFs and show me which ones have momentum BUY signals right now.' },
  { label: 'Portfolio Review', prompt: 'Using InvestIQ, analyze my portfolio: [{"symbol":"AAPL","shares":10,"avg_cost":150},{"symbol":"MSFT","shares":5,"avg_cost":300}]' },
  { label: 'Market Overview', prompt: 'Using InvestIQ, give me a quick market overview: how many stocks are BUY vs HOLD vs SELL today?' },
]

// ── Claude CDP prompts for TradingView ─────────────────────────────────────
const CDP_PROMPTS = [
  { label: 'Open Symbol on TV', prompt: 'Open TradingView in Chrome and navigate to the chart for AAPL on the daily timeframe.' },
  { label: 'Apply Pine Script', prompt: 'In TradingView, open the Pine Script editor, paste the CDC ActionZone V3 script, and add it to the chart for QCOM.' },
  { label: 'Take Chart Screenshot', prompt: 'Take a screenshot of the current TradingView chart and describe what the price action looks like — trend, support/resistance, any patterns.' },
  { label: 'Run Backtest', prompt: 'In TradingView, apply the Golden Cross strategy Pine Script to SPY on the weekly chart and run the Strategy Tester. Report the win rate and profit factor.' },
  { label: 'Multi-symbol Scan', prompt: 'Open TradingView and check the charts for AAPL, MSFT, and NVDA. Take a screenshot of each and tell me which looks technically strongest.' },
]

// ──────────────────────────────────────────────────────────────────────────
export default function AITools() {
  const { copied, copy } = useCopy()
  const [selectedScript, setSelectedScript] = useState<string>('cdc')

  const script = PINE_SCRIPTS[selectedScript]

  const claudeDesktopConfig = `{
  "mcpServers": {
    "investiq": {
      "url": "http://127.0.0.1:8000/mcp"
    }
  }
}`

  const cursorMcpConfig = `{
  "mcpServers": {
    "investiq": {
      "url": "http://127.0.0.1:8000/mcp"
    }
  }
}`

  const chromeDebugCmd = `# Run this ONCE — then close this PowerShell window
# The browser keeps running in debug mode on port 9222

# Option A — Microsoft Edge (use if Chrome is not installed)
& "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" \`
  --remote-debugging-port=9222 \`
  --user-data-dir="C:\\EdgeDebug" \`
  --no-first-run

# Option B — Google Chrome (use if Chrome is installed)
# & "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" \`
#   --remote-debugging-port=9222 \`
#   --user-data-dir="C:\\ChromeDebug" \`
#   --no-first-run`

  const tradingviewUrl = `https://www.tradingview.com/chart/`

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Zap style={{ width: 22, height: 22, color: '#facc15' }} />
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0 }}>AI Tools</h1>
          <span style={{ background: '#0c4a6e', color: '#38bdf8', fontSize: 11,
            padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Strategy 2: MCP + CDP</span>
        </div>
        <p style={{ color: '#94a3b8', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          Connect Claude to InvestIQ for instant AI-powered market analysis (MCP), and automate
          TradingView chart interactions including Pine Script backtesting (CDP).
          No manual browsing required.
        </p>
      </div>

      {/* Strategy overview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#0c1a2e', border: '1px solid #0284c7', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Globe style={{ width: 16, height: 16, color: '#38bdf8' }} />
            <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>MCP — Data via Chat</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
            InvestIQ backend is now an MCP server at <code style={{ color: '#38bdf8' }}>http://127.0.0.1:8000/mcp</code>.
            Claude can call <strong style={{ color: 'white' }}>analyze_symbol</strong>,{' '}
            <strong style={{ color: 'white' }}>get_top20</strong>, and all other API endpoints directly from chat.
            No browser needed.
          </p>
        </div>
        <div style={{ background: '#1a0c0c', border: '1px solid #dc2626', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Terminal style={{ width: 16, height: 16, color: '#f87171' }} />
            <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>CDP — TradingView Control</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
            Launch Chrome once in debug mode. Claude then uses the built-in Chrome DevTools MCP to
            navigate TradingView, draw indicators, apply Pine Scripts, run backtests,
            and take screenshots — all from chat.
          </p>
        </div>
      </div>

      {/* ── Step 1: MCP Setup ──────────────────────────────────────────── */}
      <Section title="Step 1 — Connect Claude to InvestIQ (MCP)" icon={<Globe size={18} />} defaultOpen badge="Required">

        <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
          The InvestIQ backend now serves an MCP endpoint. Add it to your Claude config file to give
          Claude direct access to all InvestIQ tools.
        </p>

        <p style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, marginTop: 12 }}>A) Cursor IDE (recommended)</p>
        <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>
          Open <code style={{ color: '#38bdf8' }}>Settings → MCP</code> and add:
        </p>
        <CodeBlock id="cursor" code={cursorMcpConfig} lang="json (Cursor MCP settings)"
          note="File location: %APPDATA%\Cursor\User\globalStorage\cursor.cursor\mcp.json (or via Cursor Settings → MCP)" />

        <p style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, marginTop: 16 }}>B) Claude Desktop app</p>
        <CodeBlock id="desktop" code={claudeDesktopConfig} lang="json (claude_desktop_config.json)"
          note="File location: %APPDATA%\Claude\claude_desktop_config.json" />

        <div style={{ marginTop: 14, background: '#0f2011', border: '1px solid #166534',
          borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#86efac' }}>
          <strong>✓ Make sure the InvestIQ backend is running</strong> on port 8000 before connecting.
          Start it with: <code style={{ color: '#4ade80' }}>uvicorn main:app --reload --host 127.0.0.1 --port 8000</code>
          <br />Use <code style={{ color: '#4ade80' }}>127.0.0.1</code> not <code style={{ color: '#4ade80' }}>localhost</code> on Windows to avoid IPv6 issues.
        </div>
      </Section>

      {/* ── Step 2: CDP Setup ─────────────────────────────────────────────── */}
      <Section title="Step 2 — TradingView Automation (CDP)" icon={<Terminal size={18} />} badge="Optional">
        <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>
          Run this PowerShell command <strong style={{ color: 'white' }}>once</strong>.
          Chrome stays open with remote debugging enabled. You can then close the PowerShell window.
          Claude's built-in Chrome DevTools MCP connects on port <code style={{ color: '#38bdf8' }}>9222</code>.
        </p>
        <CodeBlock id="chrome" code={chromeDebugCmd} lang="PowerShell — Run once to start Chrome in debug mode" />

        <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 14, marginBottom: 6 }}>
          Then navigate Chrome to TradingView:
        </p>
        <CodeBlock id="tvurl" code={tradingviewUrl} lang="URL — Paste into the debug Chrome window" />

        <div style={{ marginTop: 14, background: '#1c1a08', border: '1px solid #854d0e',
          borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#fde68a' }}>
          <strong>Tip:</strong> Edge and Chrome both work — they use the same Chromium DevTools Protocol.
          Use whichever is installed. To check your Edge path, run in PowerShell:{' '}
          <code style={{ color: '#fbbf24' }}>Get-Item "$env:PROGRAMFILES\Microsoft\Edge\Application\msedge.exe"</code>
        </div>
      </Section>

      {/* ── Step 3: MCP Prompt Examples ───────────────────────────────────── */}
      <Section title="Step 3 — Ask Claude via MCP (Example Prompts)" icon={<BookOpen size={18} />} defaultOpen>
        <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
          Copy any prompt below and paste it into Claude chat. Claude will call InvestIQ's MCP tools automatically.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MCP_PROMPTS.map((p) => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10,
              background: '#0f1117', border: '1px solid #1e2736', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#38bdf8', fontSize: 11, fontWeight: 600, margin: '0 0 4px' }}>{p.label}</p>
                <p style={{ color: '#cbd5e1', fontSize: 12, margin: 0, fontStyle: 'italic' }}>"{p.prompt}"</p>
              </div>
              <button onClick={() => copy(p.label, p.prompt)} style={{
                background: 'transparent', border: '1px solid #1e2736', borderRadius: 6,
                padding: '4px 8px', cursor: 'pointer', color: copied === p.label ? '#22c55e' : '#64748b',
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, flexShrink: 0,
              }}>
                {copied === p.label ? <Check size={12} /> : <Copy size={12} />}
                {copied === p.label ? 'Copied' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Step 4: CDP Prompt Examples ───────────────────────────────────── */}
      <Section title="Step 4 — Ask Claude via CDP (TradingView Prompts)" icon={<Globe size={18} />}>
        <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
          These prompts use Chrome DevTools (CDP) to control TradingView directly.
          Chrome must be running in debug mode (Step 2).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CDP_PROMPTS.map((p) => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10,
              background: '#0f1117', border: '1px solid #1e2736', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#f87171', fontSize: 11, fontWeight: 600, margin: '0 0 4px' }}>{p.label}</p>
                <p style={{ color: '#cbd5e1', fontSize: 12, margin: 0, fontStyle: 'italic' }}>"{p.prompt}"</p>
              </div>
              <button onClick={() => copy(p.label, p.prompt)} style={{
                background: 'transparent', border: '1px solid #1e2736', borderRadius: 6,
                padding: '4px 8px', cursor: 'pointer', color: copied === p.label ? '#22c55e' : '#64748b',
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, flexShrink: 0,
              }}>
                {copied === p.label ? <Check size={12} /> : <Copy size={12} />}
                {copied === p.label ? 'Copied' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Pine Script Library ───────────────────────────────────────────── */}
      <Section title="Pine Script Library — Copy & Apply to TradingView" icon={<Code2 size={18} />} defaultOpen>
        <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>
          Select a strategy, copy the Pine Script, then either paste it manually in TradingView's Pine Script
          editor — or ask Claude: <em style={{ color: '#e2e8f0' }}>"Apply [script name] to the current TradingView chart for AAPL"</em>.
        </p>

        {/* Script selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {Object.entries(PINE_SCRIPTS).map(([key, s]) => (
            <button key={key} onClick={() => setSelectedScript(key)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid',
              borderColor: selectedScript === key ? '#0284c7' : '#1e2736',
              background: selectedScript === key ? '#0c4a6e' : 'transparent',
              color: selectedScript === key ? '#38bdf8' : '#94a3b8',
              fontWeight: selectedScript === key ? 600 : 400,
            }}>{s.title}</button>
          ))}
        </div>

        {/* Selected script detail */}
        {script && (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              marginBottom: 8, gap: 12 }}>
              <div>
                <h3 style={{ color: 'white', fontWeight: 600, fontSize: 14, margin: '0 0 4px' }}>{script.title}</h3>
                <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>{script.desc}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {script.tags.map(t => (
                  <span key={t} style={{ background: '#1e2736', color: '#64748b',
                    fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>{t}</span>
                ))}
              </div>
            </div>
            <CodeBlock id={`pine-${selectedScript}`} code={script.code} lang="pine" />

            <div style={{ marginTop: 10, background: '#0f1117', border: '1px solid #1e2736',
              borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
              <p style={{ color: '#64748b', margin: '0 0 4px', fontWeight: 600 }}>Ask Claude to apply this:</p>
              <p style={{ color: '#cbd5e1', margin: 0, fontStyle: 'italic' }}>
                "Apply the {script.title} Pine Script to the TradingView chart for [SYMBOL] on the daily timeframe,
                then take a screenshot and tell me what the signals show."
              </p>
            </div>
          </div>
        )}
      </Section>

      {/* ── MCP Tools reference ───────────────────────────────────────────── */}
      <Section title="Available MCP Tools (auto-generated from InvestIQ API)" icon={<Zap size={18} />}>
        <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
          Once connected, Claude can call these tools directly. Full interactive docs at{' '}
          <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer"
            style={{ color: '#38bdf8' }}>http://localhost:8000/docs</a>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            ['get_top20', 'Top N ranked recommendations with filters'],
            ['get_symbol_detail', 'Full technical + value analysis for any symbol'],
            ['get_chart_data', 'OHLCV candle data for a symbol'],
            ['get_stocks', 'Top stock picks only'],
            ['get_etfs', 'Top ETF picks only'],
            ['get_mutual_funds', 'Top mutual fund picks'],
            ['analyze_portfolio', 'P&L + rebalancing for a list of holdings'],
            ['search_symbols', 'Search symbols in the screener universe'],
            ['get_screener_status', 'Check live screener progress'],
            ['get_sectors', 'Available sector filter values'],
          ].map(([name, desc]) => (
            <div key={name} style={{ background: '#0f1117', border: '1px solid #1e2736',
              borderRadius: 8, padding: '8px 12px' }}>
              <p style={{ color: '#38bdf8', fontSize: 12, fontFamily: 'monospace', margin: '0 0 3px' }}>{name}</p>
              <p style={{ color: '#64748b', fontSize: 11, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
