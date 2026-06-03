/**
 * Lightweight chart component using TradingView's open-source library (v5).
 * Renders OHLCV candles + volume + optional indicator overlays.
 */
import { useEffect, useRef, useCallback } from 'react'
import {
  createChart,
  ColorType,
  type IChartApi,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type Time,
} from 'lightweight-charts'
import type { OHLCVData } from '../types'

interface Props {
  data: OHLCVData[]
  symbol: string
  sma20?: number | null
  sma50?: number | null
  sma200?: number | null
  bbUpper?: number | null
  bbMiddle?: number | null
  bbLower?: number | null
  currentPrice?: number
  targetPrice?: number | null
  stopLoss?: number | null
  height?: number
}

export default function LightweightChart({
  data,
  symbol,
  sma20,
  sma50,
  sma200,
  bbUpper,
  bbMiddle,
  bbLower,
  currentPrice,
  targetPrice,
  stopLoss,
  height = 420,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  const buildChart = useCallback(() => {
    if (!containerRef.current || !data.length) return

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#161b27' },
        textColor: '#94a3b8',
        fontSize: 12,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: '#1e2736', style: LineStyle.Dotted },
        horzLines: { color: '#1e2736', style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#475569', labelBackgroundColor: '#1e2736' },
        horzLine: { color: '#475569', labelBackgroundColor: '#1e2736' },
      },
      rightPriceScale: { borderColor: '#1e2736' },
      timeScale: {
        borderColor: '#1e2736',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: height - 40,
    })

    chartRef.current = chart

    // Candlestick series (v5 API)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    candleSeries.setData(
      data.map((d) => ({
        time: d.timestamp as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    )

    // Volume series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      color: '#22c55e30',
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })
    volumeSeries.setData(
      data.map((d, i) => ({
        time: d.timestamp as Time,
        value: d.volume,
        color: i > 0 && d.close >= data[i - 1].close ? '#22c55e30' : '#ef444430',
      }))
    )

    const last = data[data.length - 1].timestamp as Time

    const addLine = (color: string, value: number, title: string, from: number) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1, title } as Parameters<typeof chart.addSeries>[1])
      s.setData([
        { time: data[Math.max(0, from)].timestamp as Time, value },
        { time: last, value },
      ])
    }

    if (sma20 != null && currentPrice != null) addLine('#60a5fa', sma20, 'SMA20', data.length - 21)
    if (sma50 != null && currentPrice != null) addLine('#f59e0b', sma50, 'SMA50', data.length - 51)
    if (sma200 != null && currentPrice != null) addLine('#a78bfa', sma200, 'SMA200', data.length - 201)

    if (bbUpper != null && bbLower != null && bbMiddle != null) {
      const fromIdx = data.length - 21
      addLine('#6366f130', bbUpper, 'BB Upper', fromIdx)
      addLine('#6366f160', bbMiddle, 'BB Mid', fromIdx)
      addLine('#6366f130', bbLower, 'BB Lower', fromIdx)
    }

    if (targetPrice != null) {
      const s = chart.addSeries(LineSeries, {
        color: '#22c55e80', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'Target'
      } as Parameters<typeof chart.addSeries>[1])
      const fromIdx = Math.max(0, data.length - 30)
      s.setData([
        { time: data[fromIdx].timestamp as Time, value: targetPrice },
        { time: last, value: targetPrice },
      ])
    }

    if (stopLoss != null) {
      const s = chart.addSeries(LineSeries, {
        color: '#ef444480', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'Stop'
      } as Parameters<typeof chart.addSeries>[1])
      const fromIdx = Math.max(0, data.length - 30)
      s.setData([
        { time: data[fromIdx].timestamp as Time, value: stopLoss },
        { time: last, value: stopLoss },
      ])
    }

    chart.timeScale().fitContent()

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [data, sma20, sma50, sma200, bbUpper, bbMiddle, bbLower, currentPrice, targetPrice, stopLoss, height])

  useEffect(() => {
    const cleanup = buildChart()
    return () => {
      cleanup?.()
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [buildChart])

  return (
    <div className="w-full rounded-xl overflow-hidden" style={{ border: '1px solid #1e2736', background: '#161b27' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', borderBottom: '1px solid #1e2736' }}>
        <span style={{ color: 'white', fontWeight: 600 }}>{symbol}</span>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b' }}>
          <span><span style={{ display: 'inline-block', width: 12, height: 2, background: '#60a5fa', verticalAlign: 'middle', marginRight: 4 }} />SMA20</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 2, background: '#f59e0b', verticalAlign: 'middle', marginRight: 4 }} />SMA50</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 2, background: '#a78bfa', verticalAlign: 'middle', marginRight: 4 }} />SMA200</span>
          {targetPrice && <span style={{ color: '#22c55e' }}><span style={{ display: 'inline-block', width: 12, height: 2, background: '#22c55e', verticalAlign: 'middle', marginRight: 4 }} />Target</span>}
          {stopLoss && <span style={{ color: '#ef4444' }}><span style={{ display: 'inline-block', width: 12, height: 2, background: '#ef4444', verticalAlign: 'middle', marginRight: 4 }} />Stop</span>}
        </div>
      </div>
      <div ref={containerRef} style={{ height: height - 40 }} />
    </div>
  )
}
