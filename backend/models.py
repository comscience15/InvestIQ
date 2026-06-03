from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class AssetType(str, Enum):
    STOCK = "stock"
    ETF = "etf"
    MUTUAL_FUND = "mutual_fund"


class SignalType(str, Enum):
    STRONG_BUY = "STRONG BUY"
    BUY = "BUY"
    HOLD = "HOLD"
    SELL = "SELL"
    STRONG_SELL = "STRONG SELL"


class TechnicalIndicators(BaseModel):
    rsi: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_hist: Optional[float] = None
    bb_upper: Optional[float] = None
    bb_middle: Optional[float] = None
    bb_lower: Optional[float] = None
    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    ema_12: Optional[float] = None
    ema_26: Optional[float] = None
    volume_avg: Optional[float] = None
    atr: Optional[float] = None
    stoch_k: Optional[float] = None
    stoch_d: Optional[float] = None
    adx: Optional[float] = None
    cci: Optional[float] = None
    williams_r: Optional[float] = None
    obv: Optional[float] = None


class ValueMetrics(BaseModel):
    pe_ratio: Optional[float] = None
    pb_ratio: Optional[float] = None
    ps_ratio: Optional[float] = None
    peg_ratio: Optional[float] = None
    ev_ebitda: Optional[float] = None
    roe: Optional[float] = None
    roa: Optional[float] = None
    debt_to_equity: Optional[float] = None
    current_ratio: Optional[float] = None
    quick_ratio: Optional[float] = None
    gross_margin: Optional[float] = None
    operating_margin: Optional[float] = None
    net_margin: Optional[float] = None
    revenue_growth: Optional[float] = None
    earnings_growth: Optional[float] = None
    dividend_yield: Optional[float] = None
    fcf_yield: Optional[float] = None
    intrinsic_value: Optional[float] = None


class ChartPattern(BaseModel):
    pattern: str
    confidence: float
    bullish: bool
    description: str


class StockRecommendation(BaseModel):
    symbol: str
    name: str
    asset_type: AssetType
    sector: Optional[str] = None
    industry: Optional[str] = None
    current_price: float
    price_change: float
    price_change_pct: float
    week_52_high: Optional[float] = None
    week_52_low: Optional[float] = None
    market_cap: Optional[float] = None
    volume: Optional[int] = None
    avg_volume: Optional[int] = None
    signal: SignalType
    signal_score: float  # 0-100
    technical_score: float
    value_score: float
    momentum_score: float
    technical_indicators: TechnicalIndicators
    value_metrics: ValueMetrics
    chart_patterns: List[ChartPattern] = []
    rebalance_action: Optional[str] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    risk_level: str  # Low, Medium, High
    time_horizon: str  # Short, Medium, Long
    reasoning: List[str] = []


class PortfolioHolding(BaseModel):
    symbol: str
    shares: float
    avg_cost: float
    current_price: Optional[float] = None
    current_value: Optional[float] = None
    gain_loss: Optional[float] = None
    gain_loss_pct: Optional[float] = None
    weight: Optional[float] = None
    signal: Optional[SignalType] = None


class Portfolio(BaseModel):
    holdings: List[PortfolioHolding]
    total_value: Optional[float] = None
    total_cost: Optional[float] = None
    total_gain_loss: Optional[float] = None
    total_gain_loss_pct: Optional[float] = None


class OHLCVData(BaseModel):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float


class ScreenerFilter(BaseModel):
    asset_types: List[AssetType] = [AssetType.STOCK, AssetType.ETF]
    min_market_cap: Optional[float] = None
    max_pe_ratio: Optional[float] = None
    min_roe: Optional[float] = None
    min_dividend_yield: Optional[float] = None
    sectors: Optional[List[str]] = None
    signal_filter: Optional[List[SignalType]] = None
    limit: int = 20
