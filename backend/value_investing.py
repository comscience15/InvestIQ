"""
Value Investing (VI) metrics engine.
Computes fundamental scores using Benjamin Graham / Warren Buffett criteria.
"""
import math
from typing import Optional
from models import ValueMetrics


def fetch_value_metrics(ticker_info: dict) -> ValueMetrics:
    """Extract and compute value metrics from yfinance ticker info."""
    info = ticker_info or {}

    def safe_get(key):
        val = info.get(key)
        if val is None or val != val:  # NaN check
            return None
        try:
            return float(val)
        except Exception:
            return None

    pe = safe_get("trailingPE") or safe_get("forwardPE")
    pb = safe_get("priceToBook")
    ps = safe_get("priceToSalesTrailing12Months")
    peg = safe_get("pegRatio")
    ev_ebitda = safe_get("enterpriseToEbitda")
    roe = safe_get("returnOnEquity")
    roa = safe_get("returnOnAssets")
    de = safe_get("debtToEquity")
    cr = safe_get("currentRatio")
    qr = safe_get("quickRatio")
    gm = safe_get("grossMargins")
    om = safe_get("operatingMargins")
    nm = safe_get("profitMargins")
    rev_growth = safe_get("revenueGrowth")
    earn_growth = safe_get("earningsGrowth")
    div_yield = safe_get("dividendYield")

    # Free cash flow yield
    fcf = safe_get("freeCashflow")
    market_cap = safe_get("marketCap")
    fcf_yield = None
    if fcf and market_cap and market_cap > 0:
        fcf_yield = fcf / market_cap

    # Rough Graham intrinsic value: V = EPS * (8.5 + 2g) * 4.4/Y
    # Where g = expected growth %, Y = current AAA bond yield (approx 4.5%)
    intrinsic = None
    eps = safe_get("trailingEps")
    growth_rate = earn_growth or rev_growth
    if eps and eps > 0 and growth_rate is not None:
        g = min(max(growth_rate * 100, -5), 30)
        Y = 4.5
        intrinsic = eps * (8.5 + 2 * g) * (4.4 / Y)

    # Convert ratios to percentages where needed
    if roe is not None:
        roe = roe * 100
    if roa is not None:
        roa = roa * 100
    if gm is not None:
        gm = gm * 100
    if om is not None:
        om = om * 100
    if nm is not None:
        nm = nm * 100
    if rev_growth is not None:
        rev_growth = rev_growth * 100
    if earn_growth is not None:
        earn_growth = earn_growth * 100
    if div_yield is not None:
        div_yield = div_yield * 100

    return ValueMetrics(
        pe_ratio=pe,
        pb_ratio=pb,
        ps_ratio=ps,
        peg_ratio=peg,
        ev_ebitda=ev_ebitda,
        roe=roe,
        roa=roa,
        debt_to_equity=de,
        current_ratio=cr,
        quick_ratio=qr,
        gross_margin=gm,
        operating_margin=om,
        net_margin=nm,
        revenue_growth=rev_growth,
        earnings_growth=earn_growth,
        dividend_yield=div_yield,
        fcf_yield=fcf_yield * 100 if fcf_yield else None,
        intrinsic_value=intrinsic,
    )


def calculate_value_score(vm: ValueMetrics, current_price: float) -> float:
    """
    Score 0-100 based on Graham/Buffett criteria.
    Higher = better value.
    """
    score = 50.0
    signals = []

    # P/E: < 15 is great, < 25 ok, > 40 bad
    if vm.pe_ratio is not None:
        if vm.pe_ratio < 10:
            signals.append(20)
        elif vm.pe_ratio < 15:
            signals.append(15)
        elif vm.pe_ratio < 25:
            signals.append(5)
        elif vm.pe_ratio < 40:
            signals.append(-5)
        else:
            signals.append(-15)

    # P/B: < 1.5 great, < 3 ok, > 5 bad
    if vm.pb_ratio is not None:
        if vm.pb_ratio < 1:
            signals.append(15)
        elif vm.pb_ratio < 1.5:
            signals.append(10)
        elif vm.pb_ratio < 3:
            signals.append(0)
        else:
            signals.append(-10)

    # ROE: > 20% excellent, > 15% good
    if vm.roe is not None:
        if vm.roe > 25:
            signals.append(15)
        elif vm.roe > 15:
            signals.append(10)
        elif vm.roe > 10:
            signals.append(5)
        else:
            signals.append(-5)

    # Debt/Equity: < 0.5 great, > 2 bad
    if vm.debt_to_equity is not None:
        de_pct = vm.debt_to_equity / 100 if vm.debt_to_equity > 5 else vm.debt_to_equity
        if de_pct < 0.3:
            signals.append(10)
        elif de_pct < 0.5:
            signals.append(5)
        elif de_pct < 1.0:
            signals.append(0)
        else:
            signals.append(-10)

    # Revenue growth
    if vm.revenue_growth is not None:
        if vm.revenue_growth > 20:
            signals.append(10)
        elif vm.revenue_growth > 10:
            signals.append(5)
        elif vm.revenue_growth < 0:
            signals.append(-10)

    # Margins
    if vm.net_margin is not None:
        if vm.net_margin > 20:
            signals.append(10)
        elif vm.net_margin > 10:
            signals.append(5)
        elif vm.net_margin < 0:
            signals.append(-15)

    # Intrinsic value vs current price
    if vm.intrinsic_value is not None and current_price > 0:
        margin_of_safety = (vm.intrinsic_value - current_price) / current_price
        if margin_of_safety > 0.30:
            signals.append(20)   # 30%+ margin of safety
        elif margin_of_safety > 0.10:
            signals.append(10)
        elif margin_of_safety < -0.30:
            signals.append(-15)  # Significantly overvalued

    # FCF yield
    if vm.fcf_yield is not None:
        if vm.fcf_yield > 5:
            signals.append(10)
        elif vm.fcf_yield > 2:
            signals.append(5)
        elif vm.fcf_yield < 0:
            signals.append(-10)

    # Dividend yield (bonus for income investors)
    if vm.dividend_yield is not None and vm.dividend_yield > 2:
        signals.append(5)

    if signals:
        avg_signal = sum(signals) / len(signals)
        score = min(100, max(0, 50 + avg_signal * 1.5))

    return round(score, 1)


def determine_rebalance_action(
    signal_score: float,
    current_weight: Optional[float],
    tech_score: float,
    value_score: float
) -> str:
    """Recommend rebalancing action for portfolio position."""
    combined = (signal_score * 0.4 + tech_score * 0.3 + value_score * 0.3)

    if combined >= 75:
        if current_weight and current_weight < 0.05:
            return "Increase Position — Strong signals suggest underweight"
        return "Hold / Add on Dips — Strong buy signals"
    elif combined >= 60:
        return "Hold — Moderate signals, maintain position"
    elif combined >= 45:
        return "Neutral — Review position size"
    elif combined >= 30:
        return "Reduce Position — Weakening signals"
    else:
        return "Exit Position — Multiple sell signals detected"


def calculate_momentum_score(df) -> float:
    """Price momentum score based on 1M, 3M, 6M, 12M returns."""
    try:
        close = df["Close"]
        if len(close) < 20:
            return 50.0

        current = close.iloc[-1]
        score = 50.0
        signals = []

        if len(close) >= 21:
            ret_1m = (current - close.iloc[-21]) / close.iloc[-21] * 100
            if ret_1m > 5:
                signals.append(15)
            elif ret_1m > 0:
                signals.append(5)
            else:
                signals.append(-10)

        if len(close) >= 63:
            ret_3m = (current - close.iloc[-63]) / close.iloc[-63] * 100
            if ret_3m > 10:
                signals.append(15)
            elif ret_3m > 0:
                signals.append(5)
            else:
                signals.append(-10)

        if len(close) >= 126:
            ret_6m = (current - close.iloc[-126]) / close.iloc[-126] * 100
            if ret_6m > 15:
                signals.append(10)
            elif ret_6m > 0:
                signals.append(5)
            else:
                signals.append(-10)

        if len(close) >= 252:
            ret_12m = (current - close.iloc[-252]) / close.iloc[-252] * 100
            if ret_12m > 20:
                signals.append(10)
            elif ret_12m > 0:
                signals.append(5)
            else:
                signals.append(-8)

        if signals:
            avg = sum(signals) / len(signals)
            score = min(100, max(0, 50 + avg * 1.5))

        return round(score, 1)
    except Exception:
        return 50.0


def determine_signal(signal_score: float) -> str:
    if signal_score >= 80:
        return "STRONG BUY"
    elif signal_score >= 65:
        return "BUY"
    elif signal_score >= 45:
        return "HOLD"
    elif signal_score >= 30:
        return "SELL"
    else:
        return "STRONG SELL"


def generate_reasoning(
    indicators,
    vm: ValueMetrics,
    patterns,
    current_price: float,
    signal: str
) -> list:
    reasons = []

    if indicators.rsi is not None:
        if indicators.rsi < 30:
            reasons.append(f"RSI {indicators.rsi:.0f} — oversold, potential reversal")
        elif indicators.rsi > 70:
            reasons.append(f"RSI {indicators.rsi:.0f} — overbought, caution advised")
        else:
            reasons.append(f"RSI {indicators.rsi:.0f} — neutral momentum")

    if indicators.sma_50 is not None and indicators.sma_200 is not None:
        if indicators.sma_50 > indicators.sma_200:
            reasons.append("SMA50 > SMA200: long-term uptrend intact")
        else:
            reasons.append("SMA50 < SMA200: long-term downtrend caution")

    if indicators.macd is not None and indicators.macd_signal is not None:
        if indicators.macd > indicators.macd_signal:
            reasons.append("MACD above signal line — bullish momentum")
        else:
            reasons.append("MACD below signal line — bearish momentum")

    if vm.pe_ratio is not None:
        if vm.pe_ratio < 15:
            reasons.append(f"P/E {vm.pe_ratio:.1f} — attractively valued")
        elif vm.pe_ratio > 35:
            reasons.append(f"P/E {vm.pe_ratio:.1f} — premium valuation")

    if vm.intrinsic_value is not None and current_price > 0:
        mos = (vm.intrinsic_value - current_price) / current_price * 100
        if mos > 20:
            reasons.append(f"~{mos:.0f}% margin of safety vs Graham value")
        elif mos < -20:
            reasons.append(f"Trades {abs(mos):.0f}% above estimated intrinsic value")

    if vm.roe is not None and vm.roe > 15:
        reasons.append(f"ROE {vm.roe:.1f}% — excellent capital efficiency")

    for p in patterns[:2]:
        reasons.append(f"Chart: {p.pattern} detected ({p.confidence*100:.0f}% confidence)")

    return reasons[:6]
