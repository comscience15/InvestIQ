"""
Technical analysis engine: indicators + chart pattern detection.
All indicators are computed natively with pandas/numpy (no pandas-ta dependency).
"""
import numpy as np
import pandas as pd
from typing import List, Optional
from models import TechnicalIndicators, ChartPattern


def compute_indicators(df: pd.DataFrame) -> TechnicalIndicators:
    """Compute all technical indicators from OHLCV dataframe."""
    if df.empty or len(df) < 20:
        return TechnicalIndicators()

    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    volume = df["Volume"]

    def safe(val):
        try:
            v = float(val)
            return v if not np.isnan(v) and not np.isinf(v) else None
        except Exception:
            return None

    result = TechnicalIndicators()

    try:
        # RSI
        rsi = compute_rsi(close, 14)
        result.rsi = safe(rsi.iloc[-1]) if rsi is not None else None

        # MACD
        macd_line, signal_line, histogram = compute_macd(close)
        result.macd = safe(macd_line.iloc[-1]) if macd_line is not None else None
        result.macd_signal = safe(signal_line.iloc[-1]) if signal_line is not None else None
        result.macd_hist = safe(histogram.iloc[-1]) if histogram is not None else None

        # Bollinger Bands
        bb_upper, bb_middle, bb_lower = compute_bollinger_bands(close)
        result.bb_upper = safe(bb_upper.iloc[-1]) if bb_upper is not None else None
        result.bb_middle = safe(bb_middle.iloc[-1]) if bb_middle is not None else None
        result.bb_lower = safe(bb_lower.iloc[-1]) if bb_lower is not None else None

        # SMAs
        if len(close) >= 20:
            result.sma_20 = safe(close.rolling(20).mean().iloc[-1])
        if len(close) >= 50:
            result.sma_50 = safe(close.rolling(50).mean().iloc[-1])
        if len(close) >= 200:
            result.sma_200 = safe(close.rolling(200).mean().iloc[-1])

        # EMAs
        result.ema_12 = safe(close.ewm(span=12, adjust=False).mean().iloc[-1])
        result.ema_26 = safe(close.ewm(span=26, adjust=False).mean().iloc[-1])

        # Volume avg
        result.volume_avg = safe(volume.rolling(20).mean().iloc[-1])

        # ATR
        atr = compute_atr(high, low, close, 14)
        result.atr = safe(atr.iloc[-1]) if atr is not None else None

        # Stochastic
        stoch_k, stoch_d = compute_stochastic(high, low, close)
        result.stoch_k = safe(stoch_k.iloc[-1]) if stoch_k is not None else None
        result.stoch_d = safe(stoch_d.iloc[-1]) if stoch_d is not None else None

        # ADX
        adx = compute_adx(high, low, close)
        result.adx = safe(adx.iloc[-1]) if adx is not None else None

        # CCI
        cci = compute_cci(high, low, close)
        result.cci = safe(cci.iloc[-1]) if cci is not None else None

        # Williams %R
        williams = compute_williams_r(high, low, close)
        result.williams_r = safe(williams.iloc[-1]) if williams is not None else None

        # OBV
        obv = compute_obv(close, volume)
        result.obv = safe(obv.iloc[-1]) if obv is not None else None

    except Exception:
        pass

    return result


def compute_rsi(close: pd.Series, period: int = 14) -> Optional[pd.Series]:
    try:
        delta = close.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
        avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))
    except Exception:
        return None


def compute_macd(close: pd.Series, fast=12, slow=26, signal=9):
    try:
        ema_fast = close.ewm(span=fast, adjust=False).mean()
        ema_slow = close.ewm(span=slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        histogram = macd_line - signal_line
        return macd_line, signal_line, histogram
    except Exception:
        return None, None, None


def compute_bollinger_bands(close: pd.Series, period=20, std_dev=2):
    try:
        sma = close.rolling(period).mean()
        std = close.rolling(period).std()
        upper = sma + (std * std_dev)
        lower = sma - (std * std_dev)
        return upper, sma, lower
    except Exception:
        return None, None, None


def compute_atr(high, low, close, period=14) -> Optional[pd.Series]:
    try:
        prev_close = close.shift(1)
        tr = pd.concat([
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs()
        ], axis=1).max(axis=1)
        return tr.ewm(com=period - 1, min_periods=period).mean()
    except Exception:
        return None


def compute_stochastic(high, low, close, k_period=14, d_period=3):
    try:
        lowest_low = low.rolling(k_period).min()
        highest_high = high.rolling(k_period).max()
        stoch_k = 100 * (close - lowest_low) / (highest_high - lowest_low)
        stoch_d = stoch_k.rolling(d_period).mean()
        return stoch_k, stoch_d
    except Exception:
        return None, None


def compute_adx(high, low, close, period=14) -> Optional[pd.Series]:
    try:
        tr = compute_atr(high, low, close, period)
        dm_plus = high.diff()
        dm_minus = -low.diff()
        dm_plus = dm_plus.where((dm_plus > dm_minus) & (dm_plus > 0), 0)
        dm_minus = dm_minus.where((dm_minus > dm_plus) & (dm_minus > 0), 0)
        di_plus = 100 * dm_plus.ewm(com=period - 1, min_periods=period).mean() / (tr + 1e-10)
        di_minus = 100 * dm_minus.ewm(com=period - 1, min_periods=period).mean() / (tr + 1e-10)
        dx = 100 * (di_plus - di_minus).abs() / (di_plus + di_minus + 1e-10)
        adx = dx.ewm(com=period - 1, min_periods=period).mean()
        return adx
    except Exception:
        return None


def compute_cci(high, low, close, period=20) -> Optional[pd.Series]:
    try:
        typical = (high + low + close) / 3
        sma = typical.rolling(period).mean()
        mad = typical.rolling(period).apply(lambda x: np.abs(x - x.mean()).mean())
        return (typical - sma) / (0.015 * mad)
    except Exception:
        return None


def compute_williams_r(high, low, close, period=14) -> Optional[pd.Series]:
    try:
        highest_high = high.rolling(period).max()
        lowest_low = low.rolling(period).min()
        return -100 * (highest_high - close) / (highest_high - lowest_low + 1e-10)
    except Exception:
        return None


def compute_obv(close, volume) -> Optional[pd.Series]:
    try:
        direction = np.sign(close.diff()).fillna(0)
        return (direction * volume).cumsum()
    except Exception:
        return None


def calculate_technical_score(indicators: TechnicalIndicators, current_price: float) -> float:
    """Score from 0-100 based on technical signals."""
    score = 50.0
    signals = []

    # RSI signals
    if indicators.rsi is not None:
        if indicators.rsi < 30:
            signals.append(20)   # oversold → bullish
        elif indicators.rsi < 40:
            signals.append(10)
        elif indicators.rsi > 70:
            signals.append(-20)  # overbought → bearish
        elif indicators.rsi > 60:
            signals.append(-5)
        else:
            signals.append(5)

    # MACD signals
    if indicators.macd is not None and indicators.macd_signal is not None:
        if indicators.macd > indicators.macd_signal:
            signals.append(10)
        else:
            signals.append(-10)
    if indicators.macd_hist is not None:
        if indicators.macd_hist > 0:
            signals.append(5)
        else:
            signals.append(-5)

    # Price vs SMAs (Golden/Death cross)
    if indicators.sma_50 is not None and indicators.sma_200 is not None:
        if indicators.sma_50 > indicators.sma_200:
            signals.append(15)  # Golden cross territory
        else:
            signals.append(-15)  # Death cross territory

    if indicators.sma_20 is not None:
        if current_price > indicators.sma_20:
            signals.append(5)
        else:
            signals.append(-5)

    # Bollinger Bands
    if indicators.bb_lower is not None and indicators.bb_upper is not None:
        bb_range = indicators.bb_upper - indicators.bb_lower
        if bb_range > 0:
            bb_pct = (current_price - indicators.bb_lower) / bb_range
            if bb_pct < 0.2:
                signals.append(10)   # Near lower band → buy zone
            elif bb_pct > 0.8:
                signals.append(-10)  # Near upper band → caution

    # Stochastic
    if indicators.stoch_k is not None:
        if indicators.stoch_k < 20:
            signals.append(10)
        elif indicators.stoch_k > 80:
            signals.append(-10)

    # ADX (trend strength)
    if indicators.adx is not None:
        if indicators.adx > 25:
            signals.append(5)   # Strong trend

    # CCI
    if indicators.cci is not None:
        if indicators.cci < -100:
            signals.append(8)
        elif indicators.cci > 100:
            signals.append(-8)

    if signals:
        avg_signal = sum(signals) / len(signals)
        score = min(100, max(0, 50 + avg_signal * 1.5))

    return round(score, 1)


def detect_chart_patterns(df: pd.DataFrame) -> List[ChartPattern]:
    """Detect common chart patterns from OHLCV data."""
    patterns: List[ChartPattern] = []
    if len(df) < 20:
        return patterns

    close = df["Close"].values
    high = df["High"].values
    low = df["Low"].values

    detectors = [
        _detect_golden_cross,
        _detect_death_cross,
        _detect_double_bottom,
        _detect_double_top,
        _detect_cup_and_handle,
        _detect_bull_flag,
        _detect_support_bounce,
        _detect_oversold_bounce,
        _detect_breakout,
        _detect_consolidation,
    ]

    for fn in detectors:
        try:
            if fn in (_detect_golden_cross, _detect_death_cross):
                result = fn(df)
            else:
                result = fn(close, high, low) if fn not in (_detect_cup_and_handle, _detect_bull_flag) else fn(close, high, low)
            patterns.extend(result)
        except Exception:
            pass

    # Deduplicate by pattern name
    seen = set()
    unique = []
    for p in patterns:
        if p.pattern not in seen:
            seen.add(p.pattern)
            unique.append(p)

    return unique[:6]


def _find_local_extrema(arr, order=5):
    """Find local minima and maxima indices."""
    from scipy.signal import argrelextrema
    mins = argrelextrema(arr, np.less, order=order)[0]
    maxs = argrelextrema(arr, np.greater, order=order)[0]
    return mins, maxs


def _detect_double_bottom(close, high, low):
    try:
        from scipy.signal import argrelextrema
        window = min(len(low), 120)
        recent = np.array(low[-window:], dtype=float)
        order = max(3, window // 20)
        mins = argrelextrema(recent, np.less, order=order)[0]
        if len(mins) >= 2:
            m1, m2 = mins[-2], mins[-1]
            tolerance = abs(recent[m1] - recent[m2]) / (recent[m1] + 1e-10)
            if tolerance < 0.05 and (m2 - m1) >= 5:
                conf = min(0.88, 0.65 + (0.05 - tolerance) * 4)
                return [ChartPattern(
                    pattern="Double Bottom",
                    confidence=round(conf, 2),
                    bullish=True,
                    description="Two lows at similar price — W-shape reversal signal"
                )]
    except Exception:
        pass
    return []


def _detect_double_top(close, high, low):
    try:
        from scipy.signal import argrelextrema
        window = min(len(high), 120)
        recent = np.array(high[-window:], dtype=float)
        order = max(3, window // 20)
        maxs = argrelextrema(recent, np.greater, order=order)[0]
        if len(maxs) >= 2:
            m1, m2 = maxs[-2], maxs[-1]
            tolerance = abs(recent[m1] - recent[m2]) / (recent[m1] + 1e-10)
            if tolerance < 0.05 and (m2 - m1) >= 5:
                conf = min(0.85, 0.62 + (0.05 - tolerance) * 4)
                return [ChartPattern(
                    pattern="Double Top",
                    confidence=round(conf, 2),
                    bullish=False,
                    description="Two peaks at similar price — M-shape bearish reversal"
                )]
    except Exception:
        pass
    return []


def _detect_golden_cross(df: pd.DataFrame):
    try:
        close = df["Close"]
        if len(close) < 55:
            return []
        sma50 = close.rolling(min(50, len(close) - 5)).mean()
        sma200 = close.rolling(min(200, len(close))).mean()
        lookback = min(10, len(sma50) - 1)
        if (sma50.iloc[-1] > sma200.iloc[-1]
                and sma50.iloc[-lookback] <= sma200.iloc[-lookback]):
            return [ChartPattern(
                pattern="Golden Cross",
                confidence=0.85,
                bullish=True,
                description="SMA50 crossed above SMA200 — confirmed bullish trend change"
            )]
        # Also flag if SMA50 is above SMA200 (ongoing uptrend)
        if (sma50.iloc[-1] > sma200.iloc[-1]
                and (sma50.iloc[-1] - sma200.iloc[-1]) / sma200.iloc[-1] > 0.01):
            return [ChartPattern(
                pattern="Above 200 SMA",
                confidence=0.70,
                bullish=True,
                description="Price & SMA50 above SMA200 — long-term uptrend intact"
            )]
    except Exception:
        pass
    return []


def _detect_death_cross(df: pd.DataFrame):
    try:
        close = df["Close"]
        if len(close) < 55:
            return []
        sma50 = close.rolling(min(50, len(close) - 5)).mean()
        sma200 = close.rolling(min(200, len(close))).mean()
        lookback = min(10, len(sma50) - 1)
        if (sma50.iloc[-1] < sma200.iloc[-1]
                and sma50.iloc[-lookback] >= sma200.iloc[-lookback]):
            return [ChartPattern(
                pattern="Death Cross",
                confidence=0.85,
                bullish=False,
                description="SMA50 crossed below SMA200 — confirmed bearish trend change"
            )]
    except Exception:
        pass
    return []


def _detect_cup_and_handle(close, high, low):
    try:
        if len(close) < 40:
            return []
        window = min(len(close), 80)
        w = np.array(close[-window:], dtype=float)
        mid = len(w) // 2
        left_peak = w[:mid].max()
        right_peak = w[mid:].max()
        cup_bottom = w.min()
        if (left_peak > 0 and right_peak > 0
                and abs(left_peak - right_peak) / left_peak < 0.08
                and (left_peak - cup_bottom) / left_peak > 0.08):
            return [ChartPattern(
                pattern="Cup and Handle",
                confidence=0.62,
                bullish=True,
                description="U-shaped consolidation — potential bullish continuation"
            )]
    except Exception:
        pass
    return []


def _detect_bull_flag(close, high, low):
    try:
        if len(close) < 15:
            return []
        c = np.array(close, dtype=float)
        prior = c[-20:-8] if len(c) >= 20 else c[:-8]
        recent = c[-8:]
        if len(prior) < 5:
            return []
        prior_gain = (prior[-1] - prior[0]) / (prior[0] + 1e-10)
        recent_range = (recent.max() - recent.min()) / (recent.mean() + 1e-10)
        if prior_gain > 0.04 and recent_range < 0.05:
            return [ChartPattern(
                pattern="Bull Flag",
                confidence=0.67,
                bullish=True,
                description="Tight consolidation after strong upswing — continuation likely"
            )]
    except Exception:
        pass
    return []


def _detect_support_bounce(close, high, low):
    try:
        if len(close) < 20:
            return []
        c = np.array(close, dtype=float)
        l = np.array(low, dtype=float)
        recent_low = l[-5:].min()
        hist_low = l[-30:-5].min() if len(l) >= 30 else l[:-5].min()
        if hist_low > 0 and abs(recent_low - hist_low) / hist_low < 0.03 and c[-1] > c[-4]:
            return [ChartPattern(
                pattern="Support Bounce",
                confidence=0.62,
                bullish=True,
                description="Price bouncing from key horizontal support level"
            )]
    except Exception:
        pass
    return []


def _detect_oversold_bounce(close, high, low):
    """Detect oversold RSI with price starting to recover."""
    try:
        c = pd.Series(close, dtype=float)
        rsi = compute_rsi(c, 14)
        if rsi is None or len(rsi) < 5:
            return []
        rsi_now = float(rsi.iloc[-1])
        rsi_prev = float(rsi.iloc[-5])
        if rsi_prev < 35 and rsi_now > rsi_prev and c.iloc[-1] > c.iloc[-3]:
            conf = min(0.80, 0.55 + (35 - rsi_prev) * 0.01)
            return [ChartPattern(
                pattern="Oversold Bounce",
                confidence=round(conf, 2),
                bullish=True,
                description=f"RSI recovering from oversold ({rsi_prev:.0f} → {rsi_now:.0f}) — potential reversal"
            )]
    except Exception:
        pass
    return []


def _detect_breakout(close, high, low):
    """Price breaking above recent resistance."""
    try:
        if len(close) < 20:
            return []
        c = np.array(close, dtype=float)
        h = np.array(high, dtype=float)
        recent_high = h[-21:-1].max()  # resistance level (last 20 bars excl. today)
        if c[-1] > recent_high * 1.005:  # 0.5% above resistance
            gain = (c[-1] - recent_high) / recent_high * 100
            conf = min(0.80, 0.60 + gain * 0.02)
            return [ChartPattern(
                pattern="Resistance Breakout",
                confidence=round(conf, 2),
                bullish=True,
                description=f"Price broke above 20-day resistance (+{gain:.1f}%) — bullish momentum"
            )]
    except Exception:
        pass
    return []


def _detect_consolidation(close, high, low):
    """Tight price range (coiling) — potential energy buildup."""
    try:
        if len(close) < 15:
            return []
        c = np.array(close[-15:], dtype=float)
        price_range = (c.max() - c.min()) / (c.mean() + 1e-10)
        if price_range < 0.04:  # less than 4% range over 15 days
            return [ChartPattern(
                pattern="Consolidation / Coiling",
                confidence=0.58,
                bullish=True,  # neutral but usually resolves with breakout
                description=f"Price coiling in tight {price_range*100:.1f}% range — breakout pending"
            )]
    except Exception:
        pass
    return []
