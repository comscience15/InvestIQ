export type AssetType = 'stock' | 'etf' | 'mutual_fund'
export type SignalType = 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL'

export interface TechnicalIndicators {
  rsi: number | null
  macd: number | null
  macd_signal: number | null
  macd_hist: number | null
  bb_upper: number | null
  bb_middle: number | null
  bb_lower: number | null
  sma_20: number | null
  sma_50: number | null
  sma_200: number | null
  ema_12: number | null
  ema_26: number | null
  volume_avg: number | null
  atr: number | null
  stoch_k: number | null
  stoch_d: number | null
  adx: number | null
  cci: number | null
  williams_r: number | null
  obv: number | null
}

export interface ValueMetrics {
  pe_ratio: number | null
  pb_ratio: number | null
  ps_ratio: number | null
  peg_ratio: number | null
  ev_ebitda: number | null
  roe: number | null
  roa: number | null
  debt_to_equity: number | null
  current_ratio: number | null
  quick_ratio: number | null
  gross_margin: number | null
  operating_margin: number | null
  net_margin: number | null
  revenue_growth: number | null
  earnings_growth: number | null
  dividend_yield: number | null
  fcf_yield: number | null
  intrinsic_value: number | null
}

export interface ChartPattern {
  pattern: string
  confidence: number
  bullish: boolean
  description: string
}

export interface StockRecommendation {
  symbol: string
  name: string
  asset_type: AssetType
  sector: string | null
  industry: string | null
  current_price: number
  price_change: number
  price_change_pct: number
  week_52_high: number | null
  week_52_low: number | null
  market_cap: number | null
  volume: number | null
  avg_volume: number | null
  signal: SignalType
  signal_score: number
  technical_score: number
  value_score: number
  momentum_score: number
  technical_indicators: TechnicalIndicators
  value_metrics: ValueMetrics
  chart_patterns: ChartPattern[]
  rebalance_action: string | null
  target_price: number | null
  stop_loss: number | null
  risk_level: string
  time_horizon: string
  reasoning: string[]
}

export interface OHLCVData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface PortfolioHolding {
  symbol: string
  shares: number
  avg_cost: number
  current_price?: number
  current_value?: number
  gain_loss?: number
  gain_loss_pct?: number
  weight?: number
  signal?: SignalType
}

export interface PortfolioResult {
  holdings: PortfolioHolding[]
  total_value: number
  total_cost: number
  total_gain_loss: number
  total_gain_loss_pct: number
}
