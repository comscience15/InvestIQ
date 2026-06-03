import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { SignalType } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number | null | undefined, decimals = 2): string {
  if (price == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price)
}

export function formatNumber(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—'
  return n.toFixed(decimals)
}

export function formatPct(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`
}

export function formatLargeNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

export function formatVolume(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toString()
}

export function signalColor(signal: SignalType): string {
  switch (signal) {
    case 'STRONG BUY': return 'text-green-400'
    case 'BUY': return 'text-green-500'
    case 'HOLD': return 'text-yellow-400'
    case 'SELL': return 'text-red-400'
    case 'STRONG SELL': return 'text-red-500'
  }
}

export function signalBadgeClass(signal: SignalType): string {
  switch (signal) {
    case 'STRONG BUY': return 'badge-bull border-green-400/30 bg-green-400/15 text-green-400'
    case 'BUY': return 'badge-bull'
    case 'HOLD': return 'badge-neutral'
    case 'SELL': return 'badge-bear'
    case 'STRONG SELL': return 'badge-bear border-red-500/30 bg-red-500/15 text-red-500'
  }
}

export function rsiColor(rsi: number | null): string {
  if (rsi == null) return 'text-slate-400'
  if (rsi < 30) return 'text-green-400'
  if (rsi > 70) return 'text-red-400'
  return 'text-slate-300'
}

export function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

export function scoreBarColor(score: number): string {
  if (score >= 70) return 'bg-green-500'
  if (score >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function riskColor(risk: string): string {
  switch (risk.toLowerCase()) {
    case 'low': return 'text-green-400'
    case 'medium': return 'text-yellow-400'
    case 'high': return 'text-red-400'
    default: return 'text-slate-400'
  }
}
