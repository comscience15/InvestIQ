import { describe, it, expect } from 'vitest'
import {
  formatPrice,
  formatPct,
  formatLargeNumber,
  formatVolume,
  signalColor,
  scoreColor,
  rsiColor,
} from '../utils'
describe('formatPrice', () => {
  it('formats USD prices', () => {
    expect(formatPrice(150.5)).toBe('$150.50')
    expect(formatPrice(0)).toBe('$0.00')
    expect(formatPrice(null)).toBe('—')
  })
})

describe('formatPct', () => {
  it('includes sign', () => {
    expect(formatPct(5.23)).toBe('+5.23%')
    expect(formatPct(-3.1)).toBe('-3.10%')
    expect(formatPct(null)).toBe('—')
  })
})

describe('formatLargeNumber', () => {
  it('abbreviates large numbers', () => {
    expect(formatLargeNumber(2_500_000_000_000)).toBe('$2.50T')
    expect(formatLargeNumber(1_500_000_000)).toBe('$1.50B')
    expect(formatLargeNumber(3_000_000)).toBe('$3.00M')
  })
})

describe('formatVolume', () => {
  it('abbreviates volume', () => {
    expect(formatVolume(5_400_000)).toBe('5.4M')
    expect(formatVolume(120_000)).toBe('120K')
  })
})

describe('signalColor', () => {
  it('maps signals to colors', () => {
    expect(signalColor('STRONG BUY')).toBe('text-green-400')
    expect(signalColor('STRONG SELL')).toBe('text-red-500')
    expect(signalColor('HOLD')).toBe('text-yellow-400')
  })
})

describe('scoreColor', () => {
  it('returns green for high scores', () => {
    expect(scoreColor(80)).toBe('text-green-400')
    expect(scoreColor(60)).toBe('text-yellow-400')
    expect(scoreColor(30)).toBe('text-red-400')
  })
})

describe('rsiColor', () => {
  it('oversold is green, overbought is red', () => {
    expect(rsiColor(25)).toBe('text-green-400')
    expect(rsiColor(75)).toBe('text-red-400')
    expect(rsiColor(50)).toBe('text-slate-300')
    expect(rsiColor(null)).toBe('text-slate-400')
  })
})
