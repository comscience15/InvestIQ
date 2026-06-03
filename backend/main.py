"""
InvestIQ — Passive Income Investment Advisor
FastAPI backend: screening, charting, portfolio analysis.
Also exposes an MCP (Model Context Protocol) server at /mcp so Claude can
call InvestIQ tools directly from chat without opening any browser.
"""
import logging
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from fastapi_mcp import FastApiMCP

from models import (
    StockRecommendation, ScreenerFilter, AssetType, OHLCVData, SignalType
)
from screener import run_screener, get_ohlcv, get_portfolio_analysis, fetch_asset_data, analyze_asset
from progress import progress as _screener_progress

import log_capture
log_capture.install(logging.INFO)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="InvestIQ API",
    description=(
        "Real-time stock/ETF/MF screening with technical + value investing analysis. "
        "MCP endpoint: /mcp (SSE transport) — connect Claude Desktop or Cursor to this URL."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "InvestIQ API", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}


@app.get("/api/top20", response_model=List[StockRecommendation], tags=["Screener"])
async def get_top20(
    asset_types: Optional[str] = Query(
        default="stock,etf",
        description="Comma-separated: stock,etf,mutual_fund"
    ),
    limit: int = Query(default=20, ge=1, le=100),
    sector: Optional[str] = Query(default=None),
    min_market_cap: Optional[float] = Query(default=None),
    max_pe: Optional[float] = Query(default=None),
    min_roe: Optional[float] = Query(default=None),
    signal: Optional[str] = Query(default=None, description="BUY,SELL,HOLD,STRONG BUY,STRONG SELL"),
):
    """
    Return top N ranked investment recommendations.
    Sorted by composite signal score (technical + value + momentum).
    """
    types_map = {
        "stock": AssetType.STOCK,
        "etf": AssetType.ETF,
        "mutual_fund": AssetType.MUTUAL_FUND,
    }
    parsed_types = []
    for t in asset_types.split(","):
        t = t.strip().lower()
        if t in types_map:
            parsed_types.append(types_map[t])

    if not parsed_types:
        parsed_types = [AssetType.STOCK, AssetType.ETF]

    signal_filter = None
    if signal:
        parsed = []
        for s in signal.split(","):
            try:
                parsed.append(SignalType(s.strip().upper()))
            except Exception:
                logger.warning(f"Unknown signal filter token ignored: {s!r}")
        signal_filter = parsed if parsed else None

    filters = ScreenerFilter(
        asset_types=parsed_types,
        min_market_cap=min_market_cap,
        max_pe_ratio=max_pe,
        min_roe=min_roe,
        signal_filter=signal_filter,
        sectors=[sector] if sector else None,
        limit=limit,
    )

    results = await run_screener(asset_types=parsed_types, limit=limit, filters=filters)
    if not results and _screener_progress.downloaded_symbols == 0:
        # Zero downloads → Yahoo rate-limited or network failure
        raise HTTPException(
            status_code=503,
            detail={
                "error": "rate_limited",
                "message": (
                    "Yahoo Finance is temporarily rate-limiting requests from this IP. "
                    "This happens after many rapid requests. "
                    "Please wait 10–15 minutes and try again. "
                    "Data will be cached for 30 minutes once loaded."
                ),
            },
        )
    # Empty results due to filters → return [] with 200; frontend shows "no matches"
    return results


@app.get("/api/stocks", response_model=List[StockRecommendation], tags=["Screener"])
async def get_stocks(limit: int = Query(default=20, ge=1, le=100)):
    """Top stock recommendations only."""
    return await run_screener(asset_types=[AssetType.STOCK], limit=limit)


@app.get("/api/etfs", response_model=List[StockRecommendation], tags=["Screener"])
async def get_etfs(limit: int = Query(default=20, ge=1, le=100)):
    """Top ETF recommendations."""
    return await run_screener(asset_types=[AssetType.ETF], limit=limit)


@app.get("/api/mutual-funds", response_model=List[StockRecommendation], tags=["Screener"])
async def get_mutual_funds(limit: int = Query(default=10, ge=1, le=100)):
    """Top mutual fund recommendations."""
    return await run_screener(asset_types=[AssetType.MUTUAL_FUND], limit=limit)


@app.get("/api/symbol/{symbol}", response_model=StockRecommendation, tags=["Asset Detail"])
async def get_symbol_detail(symbol: str):
    """Full analysis for a single symbol."""
    symbol = symbol.upper()
    data = await fetch_asset_data(symbol)
    if not data:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found or no data available")
    rec = analyze_asset(data)
    if not rec:
        raise HTTPException(status_code=500, detail="Analysis failed")
    return rec


@app.get("/api/chart/{symbol}", response_model=List[OHLCVData], tags=["Charts"])
async def get_chart_data(
    symbol: str,
    period: str = Query(default="1y", description="1d,5d,1mo,3mo,6mo,1y,2y,5y,10y,ytd,max"),
    interval: str = Query(default="1d", description="1m,2m,5m,15m,30m,60m,90m,1h,1d,5d,1wk,1mo,3mo"),
):
    """OHLCV candle data for charting (TradingView Lightweight Charts format)."""
    symbol = symbol.upper()
    data = await get_ohlcv(symbol, period=period, interval=interval)
    if not data:
        raise HTTPException(status_code=404, detail=f"No chart data for {symbol}")
    return data


@app.post("/api/portfolio/analyze", tags=["Portfolio"])
async def analyze_portfolio(holdings: List[dict]):
    """
    Analyze a portfolio of holdings.
    Input: [{"symbol": "AAPL", "shares": 10, "avg_cost": 150.0}, ...]
    """
    if not holdings:
        raise HTTPException(status_code=400, detail="No holdings provided")
    result = await get_portfolio_analysis(holdings)
    return result


@app.get("/api/search", tags=["Search"])
async def search_symbols(q: str = Query(..., min_length=1)):
    """Search symbols from the universe."""
    from screener import STOCK_UNIVERSE, ETF_UNIVERSE, MUTUAL_FUND_UNIVERSE
    q_upper = q.upper()
    all_symbols = (
        [(s, "stock") for s in STOCK_UNIVERSE] +
        [(s, "etf") for s in ETF_UNIVERSE] +
        [(s, "mutual_fund") for s in MUTUAL_FUND_UNIVERSE]
    )
    matches = [
        {"symbol": s, "type": t}
        for s, t in all_symbols
        if q_upper in s
    ]
    return matches[:10]


@app.get("/api/user-data", tags=["User Data"])
async def get_user_data():
    """
    Load persisted user data (portfolio holdings, watchlist, screener filters).
    Stored in backend/data/user_data.json — survives app restarts and port changes.
    """
    import user_data
    return user_data.load()


@app.post("/api/user-data", tags=["User Data"])
async def save_user_data(payload: dict):
    """
    Save user data to disk.
    The frontend calls this automatically whenever portfolio/watchlist/filters change.
    """
    import user_data
    user_data.save(payload)
    return {"status": "saved"}


@app.get("/api/screener/status", tags=["Meta"])
async def get_screener_status():
    """Real-time screener progress — poll every second while loading."""
    return _screener_progress.to_dict()


@app.get("/api/logs", tags=["Meta"])
async def get_logs(since: float = Query(default=0.0, description="Unix timestamp — return only lines newer than this")):
    """Recent backend log lines (last 200, newest last). Poll with ?since=<last_ts> for incremental updates."""
    import log_capture
    return log_capture.get_lines(since_ts=since, limit=200)


@app.get("/api/sectors", tags=["Meta"])
async def get_sectors():
    """Available sector filters."""
    return {
        "sectors": [
            "Technology", "Healthcare", "Financials", "Consumer Discretionary",
            "Communication Services", "Industrials", "Consumer Staples",
            "Energy", "Materials", "Utilities", "Real Estate"
        ]
    }


# ── MCP server (auto-generates tools from all FastAPI routes) ──────────────
# Accessible at:  http://localhost:8000/mcp
# Transport:      SSE (Server-Sent Events)
# Add to Claude Desktop ~/.config/claude/claude_desktop_config.json:
#   { "mcpServers": { "investiq": { "url": "http://localhost:8000/mcp" } } }
mcp = FastApiMCP(app)
mcp.mount_http()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
