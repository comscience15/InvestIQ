/**
 * TradingView Advanced Chart widget — fully responsive with drag-to-resize.
 * Uses the free TradingView embed (tv.js loaded in index.html).
 * autosize:true makes it fill its container exactly — the container height
 * is the only thing we control, and we expose a drag handle for that.
 */
import { useEffect, useRef, useCallback, useState, memo } from 'react'
import { GripHorizontal, Maximize2, Minimize2 } from 'lucide-react'

interface Props {
  symbol: string
  interval?: string
  theme?: 'dark' | 'light'
  /** Initial height in pixels. User can drag to resize. */
  initialHeight?: number
  studies?: string[]
  /** Called whenever the user changes the chart height */
  onHeightChange?: (h: number) => void
}

declare global {
  interface Window {
    TradingView?: { widget: new (config: object) => void }
  }
}

const MIN_HEIGHT = 300
const MAX_HEIGHT = 1200
const PRESET_HEIGHTS = [380, 520, 680, 900]

function TradingViewWidget({
  symbol,
  interval = 'D',
  theme = 'dark',
  initialHeight = 520,
  studies = ['RSI@tv-basicstudies', 'MACD@tv-basicstudies', 'BB@tv-basicstudies'],
  onHeightChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(initialHeight)
  const [isResizing, setIsResizing] = useState(false)
  const dragStartY = useRef(0)
  const dragStartH = useRef(0)

  // ── Build / rebuild widget whenever symbol or interval changes ──────────
  const buildWidget = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    // Clear previous widget content
    el.innerHTML = ''
    const containerId = `tv_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`
    el.id = containerId

    const doCreate = () => {
      if (!window.TradingView || !document.getElementById(containerId)) return
      try {
        new window.TradingView.widget({
          autosize: true,
          symbol,
          interval,
          timezone: 'America/New_York',
          theme,
          style: '1',           // Candlestick
          locale: 'en',
          toolbar_bg: '#161b27',
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: containerId,
          hide_side_toolbar: false,
          withdateranges: true,
          save_image: true,
          show_popup_button: false,
          studies,
          overrides: {
            'paneProperties.background': '#161b27',
            'paneProperties.backgroundType': 'solid',
            'paneProperties.vertGridProperties.color': '#1e2736',
            'paneProperties.horzGridProperties.color': '#1e2736',
            'symbolWatermarkProperties.transparency': 90,
            'scalesProperties.textColor': '#94a3b8',
            'mainSeriesProperties.candleStyle.upColor': '#22c55e',
            'mainSeriesProperties.candleStyle.downColor': '#ef4444',
            'mainSeriesProperties.candleStyle.borderUpColor': '#22c55e',
            'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
            'mainSeriesProperties.candleStyle.wickUpColor': '#22c55e',
            'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
          },
          studies_overrides: {
            'volume.volume.color.0': '#ef444440',
            'volume.volume.color.1': '#22c55e40',
          },
        })
      } catch (err) {
        console.warn('TradingView widget error:', err)
      }
    }

    if (window.TradingView) {
      doCreate()
    } else {
      const timer = setInterval(() => {
        if (window.TradingView) { clearInterval(timer); doCreate() }
      }, 150)
    }
  }, [symbol, interval, theme, studies])

  useEffect(() => {
    buildWidget()
  }, [buildWidget])

  // ── Drag-to-resize logic ────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartY.current = e.clientY
    dragStartH.current = height
    setIsResizing(true)
  }, [height])

  useEffect(() => {
    if (!isResizing) return
    const onMove = (e: MouseEvent) => {
      const delta = e.clientY - dragStartY.current
      const newH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStartH.current + delta))
      setHeight(newH)
    }
    const onUp = () => {
      setIsResizing(false)
      onHeightChange?.(height)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isResizing, height, onHeightChange])

  // ── Preset height buttons ───────────────────────────────────────────────
  const setPreset = (h: number) => {
    setHeight(h)
    onHeightChange?.(h)
  }

  const isFullscreen = height >= 900

  return (
    <div ref={wrapperRef} className="w-full flex flex-col" style={{ userSelect: isResizing ? 'none' : undefined }}>
      {/* Toolbar: preset heights + fullscreen */}
      <div
        style={{ background: '#161b27', borderBottom: '1px solid #1e2736' }}
        className="flex items-center justify-between px-3 py-1.5 rounded-t-xl"
      >
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500 mr-1">Height:</span>
          {PRESET_HEIGHTS.map(h => (
            <button
              key={h}
              onClick={() => setPreset(h)}
              style={{
                background: height === h ? '#0284c7' : 'transparent',
                color: height === h ? 'white' : '#94a3b8',
                border: '1px solid',
                borderColor: height === h ? '#0284c7' : '#1e2736',
                borderRadius: 4,
                padding: '1px 7px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {h < 400 ? 'S' : h < 600 ? 'M' : h < 750 ? 'L' : 'XL'}
            </button>
          ))}
          <span className="text-xs text-slate-600 ml-2 font-mono">{height}px</span>
        </div>
        <button
          onClick={() => setPreset(isFullscreen ? 520 : 900)}
          style={{ color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}
          title={isFullscreen ? 'Restore' : 'Maximize'}
        >
          {isFullscreen
            ? <Minimize2 style={{ width: 14, height: 14 }} />
            : <Maximize2 style={{ width: 14, height: 14 }} />
          }
        </button>
      </div>

      {/* Chart container — height controlled here, widget fills it via autosize */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height,
          transition: isResizing ? 'none' : 'height 0.2s ease',
        }}
      />

      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          background: '#161b27',
          borderTop: '1px solid #1e2736',
          borderRadius: '0 0 12px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 0',
          cursor: 'ns-resize',
          userSelect: 'none',
        }}
        title="Drag to resize chart"
      >
        <GripHorizontal style={{ width: 16, height: 16, color: isResizing ? '#0ea5e9' : '#334155' }} />
      </div>
    </div>
  )
}

export default memo(TradingViewWidget)
