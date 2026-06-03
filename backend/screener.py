"""
Stock/ETF/Mutual Fund screener engine.

Two-phase approach to avoid Yahoo Finance rate limits:
  Phase 1: yf.download() — ONE bulk OHLCV call for all symbols (~1–3 s)
  Phase 2: ticker.info — only for top-30 technical scorers, sequential w/ delay
"""
import asyncio
import logging
import time
from typing import List, Optional, Dict
from cachetools import TTLCache
import yfinance as yf
import pandas as pd
import numpy as np

from models import (
    StockRecommendation, AssetType, SignalType, ScreenerFilter, OHLCVData
)
from technical_analysis import compute_indicators, detect_chart_patterns, calculate_technical_score
from value_investing import (
    fetch_value_metrics, calculate_value_score, calculate_momentum_score,
    determine_signal, determine_rebalance_action, generate_reasoning
)
from progress import progress as _progress

logger = logging.getLogger(__name__)

# 30-minute cache
_cache: TTLCache = TTLCache(maxsize=500, ttl=1800)
# Cache for individual ticker OHLCV DataFrames keyed by symbol
_ohlcv_cache: TTLCache = TTLCache(maxsize=300, ttl=1800)

STOCK_UNIVERSE = [
    # Mega-cap
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "BRK-B",
    "JPM", "V", "UNH", "JNJ", "PG", "HD", "MA", "XOM",
    "LLY", "AVGO", "COST", "ABBV", "MRK",
    # Large-cap growth/value
    "CVX", "TXN", "IBM", "QCOM", "HON", "CAT", "GS",
    "MCD", "ADBE", "CRM",
    # Growth
    "PLTR", "NET", "DDOG", "CRWD", "SHOP",
    # Dividend/Income
    "T", "VZ", "KO", "PEP", "WFC",
]

ETF_UNIVERSE = [
    "SPY", "QQQ", "IWM", "VOO", "VTI",
    "XLK", "XLF", "XLE", "XLV", "XLI", "XLC", "XLY", "XLP",
    "VTV", "VUG", "USMV", "QUAL",
    "AGG", "TLT",
    "ARKK", "BOTZ", "ICLN",
    "EFA", "EEM",
    "SCHD", "VYM",
]

MUTUAL_FUND_UNIVERSE = [
    "FXAIX", "VFIAX", "SWTSX", "FSKAX", "VTSAX",
    "FCNTX", "FDGRX",
]


def _bulk_download_ohlcv(symbols: List[str]) -> Dict[str, pd.DataFrame]:
    """
    Download OHLCV for symbols.
    Uses threads=False to avoid overwhelming Yahoo Finance.
    Falls back to individual downloads if bulk fails.
    """
    cached = {}
    missing = []
    for sym in symbols:
        if sym in _ohlcv_cache:
            cached[sym] = _ohlcv_cache[sym]
        else:
            missing.append(sym)

    if not missing:
        return cached

    result: Dict[str, pd.DataFrame] = {}

    # --- Attempt bulk download (no threads to avoid rate limiting) ---
    try:
        logger.info(f"Bulk downloading {len(missing)} symbols (no threads)…")
        raw = yf.download(
            tickers=missing,
            period="2y",
            interval="1d",
            auto_adjust=True,
            group_by="ticker",
            progress=False,
            threads=False,   # sequential inside yfinance
        )

        if raw.empty:
            raise ValueError("Bulk download returned empty DataFrame")

        if len(missing) == 1:
            sym = missing[0]
            df = raw.dropna(how="all")
            if not df.empty and len(df) >= 20:
                # Rename Adj Close → Close if present
                df = _normalize_columns(df)
                result[sym] = df
                _ohlcv_cache[sym] = df
        else:
            for sym in missing:
                try:
                    df = raw[sym].dropna(how="all")
                    if not df.empty and len(df) >= 20:
                        df = _normalize_columns(df)
                        result[sym] = df
                        _ohlcv_cache[sym] = df
                except (KeyError, Exception):
                    pass

        logger.info(f"Bulk: downloaded {len(result)}/{len(missing)}")

    except Exception as e:
        logger.warning(f"Bulk download failed ({e}), falling back to individual downloads…")

        # --- Fallback: sequential individual downloads with delay ---
        for sym in missing:
            if sym in result:
                continue
            try:
                time.sleep(0.5)
                ticker = yf.Ticker(sym)
                df = ticker.history(period="2y", interval="1d", auto_adjust=True)
                if not df.empty and len(df) >= 20:
                    df = _normalize_columns(df)
                    result[sym] = df
                    _ohlcv_cache[sym] = df
            except Exception as ex:
                logger.debug(f"Individual download failed for {sym}: {ex}")

        logger.info(f"Fallback: downloaded {len(result)}/{len(missing)}")

    cached.update(result)
    return cached


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Ensure DataFrame has standard flat OHLCV column names.
    Handles yfinance MultiIndex columns like ('AAPL', 'Close') by flattening
    to the price-column level first.
    """
    # ── Flatten MultiIndex columns ──────────────────────────────────────────
    if isinstance(df.columns, pd.MultiIndex):
        # yfinance group_by="ticker" single-ticker result: ('AAPL', 'Close') etc.
        # Take the innermost level (the OHLCV name), not the ticker name.
        inner = df.columns.get_level_values(-1).tolist()
        ohlcv_set = {"open", "high", "low", "close", "volume", "adj close"}
        if any(str(c).lower() in ohlcv_set for c in inner):
            df = df.copy()
            df.columns = inner
        else:
            # Fallback: use the outermost level
            df = df.copy()
            df.columns = df.columns.get_level_values(0).tolist()

    # ── Rename to standard casing ───────────────────────────────────────────
    rename = {}
    seen_close = False
    for col in df.columns:
        cl = str(col).lower().replace(" ", "_")
        if "adj" in cl and "close" in cl:
            rename[col] = "Close"
            seen_close = True
        elif cl == "open":
            rename[col] = "Open"
        elif cl == "high":
            rename[col] = "High"
        elif cl == "low":
            rename[col] = "Low"
        elif cl == "close" and not seen_close:
            rename[col] = "Close"
        elif cl == "volume":
            rename[col] = "Volume"
    if rename:
        df = df.rename(columns=rename)
    return df


_FAST_INFO_ATTRS = [
    "currency", "exchange", "quote_type",
    "market_cap", "shares",
    "fifty_day_average", "two_hundred_day_average",
    "year_high", "year_low",
    "last_price", "previous_close",
    "ten_day_average_volume", "three_month_average_volume",
]


def _fetch_ticker_info(symbol: str, delay: float = 0.5) -> dict:
    """
    Fetch lightweight fast_info only — avoids the heavy /quoteSummary/ endpoint
    that gets rate-limited when called for many symbols.
    """
    cache_key = f"info_{symbol}"
    if cache_key in _cache:
        return _cache[cache_key]

    try:
        time.sleep(delay)
        fi = yf.Ticker(symbol).fast_info
        result: dict = {}
        for attr in _FAST_INFO_ATTRS:
            try:
                result[attr] = getattr(fi, attr, None)
            except Exception:
                result[attr] = None

        # Map to keys our models expect
        result["quoteType"] = (result.get("quote_type") or "").upper()
        result["marketCap"] = result.get("market_cap")
        result["fiftyTwoWeekHigh"] = result.get("year_high")
        result["fiftyTwoWeekLow"] = result.get("year_low")

        _cache[cache_key] = result
        return result
    except Exception as e:
        logger.debug(f"fast_info failed for {symbol}: {e}")
        return {}


def _fetch_full_info(symbol: str) -> dict:
    """
    Deep fundamentals (PE, ROE, margins, Graham value, etc.).
    yfinance 1.4+ uses curl_cffi which handles Yahoo Finance auth properly.
    """
    cache_key = f"full_info_{symbol}"
    if cache_key in _cache:
        return _cache[cache_key]

    try:
        time.sleep(0.3)   # small polite delay
        info = yf.Ticker(symbol).info or {}
        _cache[cache_key] = info
        return info
    except Exception as e:
        logger.debug(f"Full info failed for {symbol}: {e}")
        # Fallback to fast_info only
        return _fetch_ticker_info(symbol, delay=0)


def classify_asset_type(symbol: str, info: dict) -> AssetType:
    if symbol in MUTUAL_FUND_UNIVERSE:
        return AssetType.MUTUAL_FUND
    quote_type = (info.get("quoteType") or info.get("quote_type") or "").upper()
    if quote_type == "ETF":
        return AssetType.ETF
    if quote_type == "MUTUALFUND":
        return AssetType.MUTUAL_FUND
    if symbol in ETF_UNIVERSE:
        return AssetType.ETF
    return AssetType.STOCK


def _analyze_ohlcv_only(symbol: str, df: pd.DataFrame) -> Optional[dict]:
    """Quick technical-only scoring from OHLCV (phase 1)."""
    try:
        indicators = compute_indicators(df)
        current_price = float(df["Close"].iloc[-1])
        prev_price = float(df["Close"].iloc[-2]) if len(df) > 1 else current_price
        tech_score = calculate_technical_score(indicators, current_price)
        momentum_score = calculate_momentum_score(df)
        return {
            "symbol": symbol,
            "df": df,
            "indicators": indicators,
            "tech_score": tech_score,
            "momentum_score": momentum_score,
            "current_price": current_price,
            "prev_price": prev_price,
        }
    except Exception:
        return None


def _build_recommendation(pre: dict, info: dict) -> Optional[StockRecommendation]:
    """Build full recommendation from pre-computed OHLCV data + fetched info."""
    try:
        symbol = pre["symbol"]
        df = pre["df"]
        indicators = pre["indicators"]
        current_price = pre["current_price"]
        prev_price = pre["prev_price"]

        price_change = current_price - prev_price
        price_change_pct = (price_change / prev_price * 100) if prev_price > 0 else 0

        asset_type = classify_asset_type(symbol, info)
        tech_score = pre["tech_score"]
        momentum_score = pre["momentum_score"]

        vm = fetch_value_metrics(info)
        value_score = calculate_value_score(vm, current_price)

        patterns = detect_chart_patterns(df)

        if asset_type == AssetType.STOCK:
            signal_score = tech_score * 0.35 + value_score * 0.40 + momentum_score * 0.25
        else:
            signal_score = tech_score * 0.50 + value_score * 0.15 + momentum_score * 0.35

        signal = determine_signal(signal_score)

        target_price = None
        stop_loss = None
        if indicators.atr and indicators.atr > 0:
            target_price = round(current_price + indicators.atr * 3, 2)
            stop_loss = round(current_price - indicators.atr * 1.5, 2)

        if indicators.atr:
            atr_pct = indicators.atr / current_price * 100
            risk = "Low" if atr_pct < 1.5 else ("Medium" if atr_pct < 3.0 else "High")
        else:
            risk = "Medium"

        if value_score >= 60 and signal in ("BUY", "STRONG BUY"):
            time_horizon = "Long (1-5 Years)"
        elif signal in ("BUY", "STRONG BUY"):
            time_horizon = "Medium (6-18 Months)"
        else:
            time_horizon = "Short (1-6 Months)"

        rebalance = determine_rebalance_action(signal_score, None, tech_score, value_score)
        reasoning = generate_reasoning(indicators, vm, patterns, current_price, signal)

        market_cap = info.get("marketCap") or info.get("market_cap")
        if market_cap:
            try:
                market_cap = float(market_cap)
            except Exception:
                market_cap = None

        vol = df["Volume"].iloc[-1] if "Volume" in df else None
        avg_vol = df["Volume"].rolling(20).mean().iloc[-1] if "Volume" in df and len(df) >= 20 else None

        name = info.get("longName") or info.get("shortName") or symbol
        week_52_high = info.get("fiftyTwoWeekHigh") or info.get("year_high")
        week_52_low = info.get("fiftyTwoWeekLow") or info.get("year_low")

        return StockRecommendation(
            symbol=symbol,
            name=name,
            asset_type=asset_type,
            sector=info.get("sector"),
            industry=info.get("industry"),
            current_price=round(current_price, 2),
            price_change=round(price_change, 2),
            price_change_pct=round(price_change_pct, 2),
            week_52_high=week_52_high,
            week_52_low=week_52_low,
            market_cap=market_cap,
            volume=int(vol) if vol and not np.isnan(float(vol)) else None,
            avg_volume=int(avg_vol) if avg_vol and not np.isnan(float(avg_vol)) else None,
            signal=SignalType(signal),
            signal_score=round(signal_score, 1),
            technical_score=round(tech_score, 1),
            value_score=round(value_score, 1),
            momentum_score=round(momentum_score, 1),
            technical_indicators=indicators,
            value_metrics=vm,
            chart_patterns=patterns,
            rebalance_action=rebalance,
            target_price=target_price,
            stop_loss=stop_loss,
            risk_level=risk,
            time_horizon=time_horizon,
            reasoning=reasoning,
        )
    except Exception as e:
        logger.warning(f"Build recommendation failed for {pre.get('symbol')}: {e}")
        return None


async def run_screener(
    asset_types: List[AssetType] = None,
    limit: int = 20,
    filters: Optional[ScreenerFilter] = None,
) -> List[StockRecommendation]:
    """Run the two-phase screener with progress tracking."""
    if asset_types is None:
        asset_types = [AssetType.STOCK, AssetType.ETF]

    universe = []
    if AssetType.STOCK in asset_types:
        universe.extend(STOCK_UNIVERSE)
    if AssetType.ETF in asset_types:
        universe.extend(ETF_UNIVERSE)
    if AssetType.MUTUAL_FUND in asset_types:
        universe.extend(MUTUAL_FUND_UNIVERSE)

    _progress.reset(total=len(universe))
    _progress.log(f"Starting screener — {len(universe)} symbols across {', '.join(t.value for t in asset_types)}")

    loop = asyncio.get_event_loop()
    try:
        # ── Phase 1: bulk OHLCV download ──────────────────────────────────────
        _progress.log(f"Phase 1 — Downloading price history for {len(universe)} symbols via Yahoo Finance…")
        ohlcv_map = await loop.run_in_executor(None, _bulk_download_ohlcv, universe)
        _progress.downloaded_symbols = len(ohlcv_map)
        _progress.log(f"Phase 1 complete — {len(ohlcv_map)} symbols downloaded successfully")

        # ── Phase 1b: technical scoring (CPU only) ────────────────────────────
        _progress.log("Phase 2 — Computing technical indicators (RSI, MACD, Bollinger Bands, SMA/EMA, ATR, ADX…)")
        pre_results = []
        for sym, df in ohlcv_map.items():
            pre = _analyze_ohlcv_only(sym, df)
            if pre:
                pre_results.append(pre)
        _progress.analyzed_symbols = len(pre_results)
        _progress.log(f"Phase 2 complete — Scored {len(pre_results)} symbols technically + momentum")

        # Detect chart patterns on top technical candidates
        _progress.log("Phase 3 — Detecting chart patterns (Double Bottom/Top, Golden/Death Cross, Cup & Handle, Bull Flag…)")

        # Sort and take top candidates for fundamentals phase
        top_n = max(limit * 3, 30)
        pre_results.sort(key=lambda x: x["tech_score"] * 0.6 + x["momentum_score"] * 0.4, reverse=True)
        top_candidates = pre_results[:top_n]
        _progress.log(f"Phase 3 — Top {len(top_candidates)} candidates selected for fundamental analysis")

        # ── Phase 2: fetch fundamentals ────────────────────────────────────────
        _progress.log(f"Phase 4 — Fetching fundamentals (P/E, ROE, margins, Graham value) for {len(top_candidates)} symbols…")
        recommendations = []
        for i, pre in enumerate(top_candidates):
            sym = pre["symbol"]
            cache_key = f"rec_{sym}"

            if cache_key in _cache:
                rec = _cache[cache_key]
                _progress.log(f"  [{i+1}/{len(top_candidates)}] {sym} — loaded from cache ✓")
            else:
                _progress.log(f"  [{i+1}/{len(top_candidates)}] {sym} — fetching fundamentals…")
                info = await loop.run_in_executor(None, _fetch_full_info, sym)
                rec = _build_recommendation(pre, info)
                if rec:
                    _cache[cache_key] = rec
                _progress.log(f"  [{i+1}/{len(top_candidates)}] {sym} — done (signal={rec.signal.value if rec else 'N/A'}, score={rec.signal_score if rec else 0:.0f})")

            if rec is None:
                continue

            # Apply filters
            if filters:
                if filters.min_market_cap and rec.market_cap and rec.market_cap < filters.min_market_cap:
                    continue
                if filters.max_pe_ratio and rec.value_metrics.pe_ratio:
                    if rec.value_metrics.pe_ratio > filters.max_pe_ratio:
                        continue
                if filters.min_roe and rec.value_metrics.roe:
                    if rec.value_metrics.roe < filters.min_roe:
                        continue
                if filters.signal_filter:
                    if rec.signal not in filters.signal_filter:
                        continue
                if filters.sectors and rec.sector:
                    if rec.sector not in filters.sectors:
                        continue

            recommendations.append(rec)

        recommendations.sort(key=lambda x: x.signal_score, reverse=True)
        result = recommendations[:limit]
        _progress.finish(len(result))
        return result

    except Exception as e:
        _progress.fail(str(e))
        logger.error(f"Screener failed: {e}")
        raise


async def fetch_asset_data(symbol: str) -> Optional[dict]:
    """Fetch data for a single symbol (used by chart/detail endpoints).
    Uses full .info to get all fundamental metrics."""
    cache_key = f"asset_{symbol}"
    if cache_key in _cache:
        return _cache[cache_key]

    loop = asyncio.get_event_loop()
    ohlcv_map = await loop.run_in_executor(None, _bulk_download_ohlcv, [symbol])
    if symbol not in ohlcv_map:
        return None

    # Use full info for detail view (includes PE, ROE, margins, etc.)
    info = await loop.run_in_executor(None, _fetch_full_info, symbol)
    result = {"symbol": symbol, "info": info, "hist": ohlcv_map[symbol]}
    _cache[cache_key] = result
    return result


def analyze_asset(data: dict) -> Optional[StockRecommendation]:
    """Analyze a single asset from its data dict."""
    pre = _analyze_ohlcv_only(data["symbol"], data["hist"])
    if not pre:
        return None
    return _build_recommendation(pre, data.get("info", {}))


async def get_ohlcv(symbol: str, period: str = "1y", interval: str = "1d") -> List[OHLCVData]:
    """Return OHLCV data for charting (not cached — period/interval specific)."""
    try:
        loop = asyncio.get_event_loop()

        def _download():
            return yf.download(
                tickers=symbol,
                period=period,
                interval=interval,
                auto_adjust=True,
                progress=False,
            )

        hist = await loop.run_in_executor(None, _download)
        if hist.empty:
            return []

        hist = _normalize_columns(hist)

        ohlcv = []
        for ts, row in hist.iterrows():
            try:
                ohlcv.append(OHLCVData(
                    timestamp=int(ts.timestamp()),
                    open=round(float(row["Open"]), 4),
                    high=round(float(row["High"]), 4),
                    low=round(float(row["Low"]), 4),
                    close=round(float(row["Close"]), 4),
                    volume=float(row["Volume"]) if not pd.isna(row["Volume"]) else 0,
                ))
            except Exception:
                continue
        return ohlcv
    except Exception as e:
        logger.error(f"OHLCV fetch failed for {symbol}: {e}")
        return []


async def get_portfolio_analysis(holdings: List[dict]) -> dict:
    """Analyze a portfolio of holdings."""
    enriched = []
    total_value = 0.0
    total_cost = 0.0

    symbols = [h.get("symbol", "") for h in holdings if h.get("symbol")]
    loop = asyncio.get_event_loop()
    ohlcv_map = await loop.run_in_executor(None, _bulk_download_ohlcv, symbols)

    for h in holdings:
        symbol = h.get("symbol", "")
        shares = float(h.get("shares", 0))
        avg_cost = float(h.get("avg_cost", 0))

        current_price = avg_cost
        signal = None

        if symbol in ohlcv_map:
            pre = _analyze_ohlcv_only(symbol, ohlcv_map[symbol])
            if pre:
                current_price = pre["current_price"]
                info = await loop.run_in_executor(None, _fetch_ticker_info, symbol, 0.5)
                rec = _build_recommendation(pre, info)
                if rec:
                    signal = rec.signal.value

        cost_basis = shares * avg_cost
        current_val = shares * current_price
        gl = current_val - cost_basis
        gl_pct = (gl / cost_basis * 100) if cost_basis > 0 else 0

        total_value += current_val
        total_cost += cost_basis

        enriched.append({
            "symbol": symbol,
            "shares": shares,
            "avg_cost": avg_cost,
            "current_price": round(current_price, 2),
            "current_value": round(current_val, 2),
            "gain_loss": round(gl, 2),
            "gain_loss_pct": round(gl_pct, 2),
            "signal": signal,
        })

    for h in enriched:
        h["weight"] = round(h["current_value"] / total_value * 100, 2) if total_value > 0 else 0

    total_gl = total_value - total_cost
    total_gl_pct = (total_gl / total_cost * 100) if total_cost > 0 else 0

    return {
        "holdings": enriched,
        "total_value": round(total_value, 2),
        "total_cost": round(total_cost, 2),
        "total_gain_loss": round(total_gl, 2),
        "total_gain_loss_pct": round(total_gl_pct, 2),
    }
