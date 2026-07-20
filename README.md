# InvestIQ — Passive Income Investment Advisor

A full-stack, open-source web app that provides **real-time top-N stock, ETF, and mutual fund recommendations** powered by technical analysis, value investing (VI) metrics, live TradingView charts, and portfolio rebalancing signals.

> **Disclaimer:** Informational and educational only — not financial advice. Always do your own research (DYOR). Past performance does not guarantee future results.

---

## Current Features

### App pages

| Page | What it does |
|---|---|
| **Dashboard** | Top-N recommendations (1–100), screener settings (asset type / signal / sector / P&E / ROE), sortable table, BUY/HOLD/SELL summary counts, live screener progress, collapsible backend log panel |
| **Screener** | Dedicated filter UI (asset type, sector, signal, max P/E, min ROE, text search); ranked results; opens Charts on symbol click |
| **Charts** | TradingView Advanced Chart + analysis side panel; intervals 1H / 4H / 1D / 1W / 1M; study presets; drag-resize + S/M/L/XL + maximize; Hide Panel for full-width chart |
| **Portfolio** | Add/remove holdings; total value, cost basis, G/L; allocation bar; sortable holdings table; persisted across restarts |
| **Watchlist** | Starts empty; search + Add any Yahoo Finance ticker; live signal cards; persisted across restarts |
| **AI Tools** | In-app MCP + CDP setup guide, copy-ready Claude prompts, Pine Script library |

### Analysis & scoring

| Feature | Details |
|---|---|
| **Composite score** | Stocks: Technical 35% + Value 40% + Momentum 25%. ETFs / mutual funds: Technical 50% + Value 15% + Momentum 35% |
| **Signals** | ≥80 STRONG BUY · 65–79 BUY · 45–64 HOLD · 30–44 SELL · &lt;30 STRONG SELL |
| **Technical analysis** | RSI, MACD, Bollinger Bands, SMA 20/50/200, EMA 12/26, Stochastic, ADX, CCI, Williams %R, ATR, OBV |
| **Chart patterns** | Double Bottom/Top, Golden/Death Cross, Cup & Handle, Bull Flag, Support Bounce, Oversold Bounce, Breakout, Consolidation, Above 200 SMA |
| **Value investing** | P/E, P/B, P/S, PEG, EV/EBITDA, ROE, ROA, D/E, Current Ratio, Graham intrinsic value, FCF yield |
| **Risk levels** | Low / Medium / High from ATR% |
| **Target & stop-loss** | ATR-based levels in the Charts side panel |
| **Rebalancing hints** | Score-based actions (Increase / Hold / Neutral / Reduce / Exit) on analysis views |

### Persistence & UX

- Portfolio, watchlist, and screener filters sync to `backend/data/user_data.json` (gitignored) and survive restarts
- All pages stay mounted (CSS toggle) so filters, sort, and results are preserved when switching tabs
- Dark Tailwind UI with live-data indicator and footer disclaimer

### AI integration (product)

| Mode | What it does |
|---|---|
| **MCP** | Backend exposes all FastAPI routes as MCP tools at `/mcp` (`fastapi-mcp`) for Cursor / Claude Desktop |
| **CDP** | Optional Chromium remote debugging (port 9222) so an agent can drive TradingView (indicators, Pine Scripts, screenshots) |
| **Pine Script library** | CDC ActionZone V3, RSI Divergence, Value Zones, MACD Momentum, Golden/Death Cross, BB Squeeze |

### Agent skills (developer tooling — not app UI)

Project-level Cursor skills in `.cursor/skills/` (subset of [claude-trading-skills](https://github.com/agiprolabs/claude-trading-skills), MIT). They help the coding agent with research/implementation; they are **not** user-facing InvestIQ pages.

| Area | Skills |
|---|---|
| TA / data / viz | `pandas-ta`, `ta-lib`, `ohlcv-processing`, `trading-visualization` |
| Backtesting | `vectorbt`, `backtrader`, `strategy-framework`, `walk-forward-validation` |
| Portfolio / risk | `portfolio-analytics`, `position-sizing`, `risk-management`, `kelly-criterion` |
| Statistics | `regime-detection`, `volatility-modeling`, `cointegration-analysis`, `mean-reversion`, `correlation-analysis` |
| ML / signals | `signal-classification`, `feature-engineering`, `sentiment-analysis` |
| Quant | `options-pricing`, `fixed-income`, `market-microstructure-traditional` |
| Tax / accounting | `cost-basis-engine`, `tax-liability-tracking`, `wash-sale-detection`, `tax-loss-harvesting`, `trade-accounting`, `regulatory-reporting`, `crypto-tax-export`, `trade-journal` |

Attribution: see `.cursor/skills/LICENSE-claude-trading-skills.md`.

---

## How to Run Locally (Development)

### Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.11 or newer |
| Node.js | 20 or newer |
| npm | included with Node.js |

### Terminal 1 — Backend

```powershell
cd backend

# First time only
python -m venv venv
pip install -r requirements.txt

.\venv\Scripts\Activate.ps1        # Windows PowerShell
# source venv/bin/activate          # macOS / Linux

uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Wait for: `Uvicorn running on http://127.0.0.1:8000`

> **Windows:** Use `127.0.0.1`, not `localhost` (IPv6 vs IPv4 mismatch with Node).

> If `Activate.ps1` is blocked, run once as Admin: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

| URL | Purpose |
|---|---|
| http://127.0.0.1:8000 | API health |
| http://127.0.0.1:8000/docs | Swagger / OpenAPI |
| http://127.0.0.1:8000/mcp | MCP (clients only — browser will error; that is normal) |

### Terminal 2 — Frontend

```powershell
cd frontend
npm install          # first time only
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api/*` → `http://127.0.0.1:8000`. Port **5173 is locked** (`strictPort: true`).

First Dashboard **Refresh** takes ~30–90 seconds while symbols load from Yahoo Finance; later loads use a ~30-minute in-memory cache.

---

## How to Run with Docker

```bash
docker compose up --build
```

| URL | Service |
|---|---|
| http://localhost:3000 | Frontend (Nginx) |
| http://localhost:8000 | Backend API |
| http://localhost:8000/docs | OpenAPI |

```bash
docker compose down
```

---

## AI Integration (MCP + CDP)

### Connect MCP (Cursor)

```json
{ "mcpServers": { "investiq": { "url": "http://localhost:8000/mcp" } } }
```

### Connect MCP (Claude Desktop)

Add to `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{ "mcpServers": { "investiq": { "url": "http://localhost:8000/mcp", "transport": "sse" } } }
```

Example prompts:

- *"Using InvestIQ, show me the top 10 BUY signals today sorted by score"*
- *"Using InvestIQ, give me a full analysis of QCOM"*
- *"Using InvestIQ, find value stocks with P/E < 15 and ROE > 15%"*

### CDP (TradingView automation)

Launch once (Edge or Chrome), then use Chrome DevTools MCP in Cursor:

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="C:\EdgeDebug" `
  --no-first-run
```

Full setup, prompts, and Pine Scripts live on the **AI Tools** page.

---

## Tech Stack

### Backend

| Library | Purpose |
|---|---|
| Python 3.11 + FastAPI | REST API |
| yfinance ≥ 1.4.1 | Yahoo Finance market data |
| pandas + NumPy + SciPy | Processing & pattern detection |
| Uvicorn | ASGI server |
| cachetools | In-memory TTL cache (~30 min) |
| fastapi-mcp | MCP server from FastAPI routes |
| anyio ≥ 4.5, httpx ≥ 0.27.1, pydantic ≥ 2.8 | Pins loosened for current `mcp` compatibility |

### Frontend

| Library | Purpose |
|---|---|
| React 19 + TypeScript + Vite | UI |
| Tailwind CSS v4 | Styling |
| TradingView Widget | Interactive charts |
| TanStack Query v5 | Data fetching |
| Zustand v5 | Watchlist / portfolio / UI state |
| Axios + Lucide React | HTTP + icons |

### DevOps & tests

| Tool | Purpose |
|---|---|
| Docker Compose + Nginx | One-command deploy |
| pytest | Backend tests |
| Vitest | Frontend tests |

---

## Project Structure

```
InvestIQ/
├── backend/
│   ├── main.py                  # FastAPI routes + MCP mount
│   ├── screener.py              # Fetch, rank, cache
│   ├── technical_analysis.py    # Indicators + patterns
│   ├── value_investing.py       # VI metrics + Graham + rebalance helpers
│   ├── models.py                # Pydantic models
│   ├── progress.py              # Screener progress
│   ├── log_capture.py           # Log buffer for /api/logs
│   ├── user_data.py             # Persistent portfolio / watchlist / filters
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── data/                    # gitignored; created on first run
│   │   └── user_data.json
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── store.ts
│   │   ├── components/
│   │   └── pages/               # Dashboard, Screener, Charts, Portfolio, Watchlist, AITools
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vite.config.ts           # strictPort 5173; proxy → 127.0.0.1:8000
├── .cursor/
│   ├── rules/                   # Cursor project rules
│   └── skills/                  # Agent trading skills (see Features)
├── docker-compose.yml
└── README.md
```

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/` , `/health` | GET | Health check |
| `/api/top20` | GET | Top N ranked recommendations |
| `/api/stocks` | GET | Top stock recommendations |
| `/api/etfs` | GET | Top ETF recommendations |
| `/api/mutual-funds` | GET | Top mutual fund recommendations |
| `/api/symbol/{symbol}` | GET | Full analysis for one symbol |
| `/api/chart/{symbol}` | GET | OHLCV data |
| `/api/portfolio/analyze` | POST | Analyze portfolio holdings |
| `/api/search?q=` | GET | Search symbols in the app universe |
| `/api/sectors` | GET | Sector list |
| `/api/screener/status` | GET | Live screener progress |
| `/api/logs` | GET | Recent backend log lines |
| `/api/user-data` | GET / POST | Load / save portfolio, watchlist, filters |
| `/mcp` | — | MCP tools (SSE/HTTP) |
| `/docs` | GET | OpenAPI UI |

### `/api/top20` query params

| Param | Type | Example | Description |
|---|---|---|---|
| `asset_types` | string | `stock,etf` | `stock`, `etf`, `mutual_fund` |
| `limit` | int | `20` | Max results (1–100) |
| `sector` | string | `Technology` | Sector filter |
| `max_pe` | float | `25` | Max P/E |
| `min_roe` | float | `15` | Min ROE % |
| `signal` | string | `BUY,STRONG BUY` | Signal filter |

---

## How Scoring Works

### Signal score (0–100)

```
Stocks:     Score = Technical × 0.35 + Value × 0.40 + Momentum × 0.25
ETF / MF:   Score = Technical × 0.50 + Value × 0.15 + Momentum × 0.35
```

### Graham intrinsic value

```
V = EPS × (8.5 + 2g) × (4.4 / Y)
```

`g` = expected EPS growth (%), `Y` = AAA bond yield (~4.5%). Margin of Safety &gt; 30% earns maximum value-score bonus.

### Rebalancing actions

| Combined score | Recommendation |
|---|---|
| ≥ 75 | Increase Position / Add on Dips |
| 60–74 | Hold — Moderate signals |
| 45–59 | Neutral — Review position size |
| 30–44 | Reduce Position |
| &lt; 30 | Exit Position |

---

## Running Tests

```powershell
# Backend
cd backend
.\venv\Scripts\pytest.exe tests/ -v

# Frontend
cd frontend
npm test
npm run test:coverage
```

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `PORT` | Backend (cloud) | Uvicorn port on hosted platforms |
| `PYTHONUNBUFFERED` | Docker | Set to `1` in compose for live logs |

Local cache TTL is fixed in code (~30 minutes). Frontend API calls use relative `/api` (Vite proxy / Nginx).

---

## Adding Custom Symbols

Edit universe lists in `backend/screener.py`:

```python
STOCK_UNIVERSE = ["AAPL", "MSFT", "NVDA", ...]
ETF_UNIVERSE   = ["SPY", "QQQ", "VTI", ...]
MUTUAL_FUND_UNIVERSE = ["FXAIX", "VFIAX", ...]
```

Or add any ticker from the **Watchlist** page (search + Add).

---

## Deploying

### VPS + Docker

```bash
git clone https://github.com/YOUR_USERNAME/InvestIQ.git
cd InvestIQ
docker compose up --build -d
# App on port 3000; put Nginx/Caddy + TLS in front for a domain
```

### Other hosts

- **Railway** — deploy from GitHub; compose or separate services
- **Render** — Web Service for `backend/`, Static Site for `frontend/dist`
- **Fly.io** — `fly launch` / `fly deploy` per service

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Watchlist "Failed to load" | Backend must be on `127.0.0.1:8000`; ticker must be valid on Yahoo Finance |
| Dashboard all zeros after Refresh | Wait 60–90s; watch Dashboard log panel |
| `ECONNREFUSED` on Windows | Start Uvicorn with `--host 127.0.0.1` |
| Frontend on 5174 | Kill process on 5173; port is locked |
| Yahoo `429` | `pip install "yfinance>=1.4.1"`; rely on cache after first fetch |
| TradingView blank | Need network access to TradingView CDN |
| Portfolio/watchlist lost | Backend must be running so sync to `backend/data/user_data.json` works |
| MCP fails in Cursor | Start backend first; confirm `http://127.0.0.1:8000/mcp` |

---

## License

MIT License — free to use, modify, and distribute.

Agent skills under `.cursor/skills/` are MIT (AGIPro / claude-trading-skills); keep their license notice when redistributing those files.
