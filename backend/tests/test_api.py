"""
Backend API tests using pytest + httpx async client.
"""
import pytest
from httpx import AsyncClient, ASGITransport
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_root():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"


@pytest.mark.anyio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200


@pytest.mark.anyio
async def test_sectors():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/sectors")
        assert resp.status_code == 200
        data = resp.json()
        assert "sectors" in data
        assert len(data["sectors"]) > 0


@pytest.mark.anyio
async def test_search():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/search?q=AAPL")
        assert resp.status_code == 200
        results = resp.json()
        assert isinstance(results, list)
        assert any(r["symbol"] == "AAPL" for r in results)


def test_technical_indicators():
    import pandas as pd
    import numpy as np
    from technical_analysis import compute_indicators, compute_rsi

    dates = pd.date_range("2023-01-01", periods=250)
    np.random.seed(42)
    prices = 100 + np.cumsum(np.random.randn(250))
    df = pd.DataFrame({
        "Open": prices * 0.99,
        "High": prices * 1.01,
        "Low": prices * 0.98,
        "Close": prices,
        "Volume": np.random.randint(1_000_000, 10_000_000, 250),
    }, index=dates)

    indicators = compute_indicators(df)
    assert indicators.rsi is not None
    assert 0 <= indicators.rsi <= 100
    assert indicators.macd is not None
    assert indicators.sma_20 is not None
    assert indicators.sma_50 is not None
    assert indicators.sma_200 is not None


def test_value_metrics():
    from value_investing import fetch_value_metrics, calculate_value_score
    mock_info = {
        "trailingPE": 15.0,
        "priceToBook": 2.0,
        "returnOnEquity": 0.20,
        "debtToEquity": 30.0,
        "grossMargins": 0.35,
        "profitMargins": 0.12,
        "revenueGrowth": 0.08,
        "earningsGrowth": 0.10,
        "trailingEps": 5.0,
        "dividendYield": 0.025,
    }
    vm = fetch_value_metrics(mock_info)
    assert vm.pe_ratio == 15.0
    assert vm.roe == 20.0
    score = calculate_value_score(vm, 150.0)
    assert 0 <= score <= 100


def test_chart_patterns():
    import pandas as pd
    import numpy as np
    from technical_analysis import detect_chart_patterns

    dates = pd.date_range("2023-01-01", periods=100)
    prices = 100 + np.sin(np.linspace(0, 4 * np.pi, 100)) * 5
    df = pd.DataFrame({
        "Open": prices - 0.5,
        "High": prices + 1,
        "Low": prices - 1,
        "Close": prices,
        "Volume": np.ones(100) * 1_000_000,
    }, index=dates)

    patterns = detect_chart_patterns(df)
    assert isinstance(patterns, list)


def test_signal_determination():
    from value_investing import determine_signal
    assert determine_signal(85) == "STRONG BUY"
    assert determine_signal(70) == "BUY"
    assert determine_signal(50) == "HOLD"
    assert determine_signal(35) == "SELL"
    assert determine_signal(20) == "STRONG SELL"
