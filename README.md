# InvestIQ — Passive Income Investment Advisor

A full-stack, open-source web app that provides **real-time top-N stock, ETF, and mutual fund recommendations** powered by technical analysis, value investing (VI) metrics, live TradingView charts, and portfolio rebalancing signals.

---

## How to Run Locally (Development)

### Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.11 or newer |
| Node.js | 20 or newer |
| npm | included with Node.js |

---

### Terminal 1 — Start the Backend

```powershell
cd backend

# First time only: create virtual environment
python -m venv venv

# First time only: install dependencies
pip install -r requirements.txt

# Activate the virtual environment
.\venv\Scripts\Activate.ps1        # Windows PowerShell
# source venv/bin/activate          # macOS / Linux

# Start the API server
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Wait until you see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

> **Windows note:** Always use `127.0.0.1`, not `localhost`. Node.js 18+ resolves `localhost` to IPv6 `::1` by default, but Uvicorn binds to IPv4 `127.0.0.1`, causing connection failures.

> **If you see** `cannot be loaded because running scripts is disabled` when running `Activate.ps1`, run this once in PowerShell as Administrator, then try again:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```

- API root: **http://127.0.0.1:8000** → should show `{"status":"ok",...}`
- Swagger / OpenAPI docs: **http://127.0.0.1:8000/docs**
- MCP endpoint (for Claude only): **http://127.0.0.1:8000/mcp** → opening this in a browser shows an error — that is normal; it only works with MCP clients like Claude/Cursor

---

### Terminal 2 — Start the Frontend

Open a **second** terminal:

```powershell
cd frontend

# First time only: install Node packages
npm install

# Start the Vite dev server
npm run dev
```

Wait until you see:
```
VITE ready on http://localhost:5173
```

> Vite proxies all `/api/*` requests to `http://127.0.0.1:8000` automatically (`vite.config.ts`). Port **5173 is locked** (`strictPort: true`) to prevent localStorage data from being lost if the port changes.

---

### Open the App

Go to **[http://localhost:5173](http://localhost:5173)** in your browser.

- Click **Refresh** on the Dashboard — first run takes **30–90 seconds** while downloading ~100 symbols from Yahoo Finance
- Subsequent loads use 30-minute cached data and are near-instant

| Page | What it does |
|---|---|
| **Dashboard** | Top-N recommendations table, screener settings, live backend logs |
| **Charts** | TradingView chart + full technical & value analysis panel |
| **Portfolio** | Holdings P&L, allocation chart, rebalancing recommendations |
| **Watchlist** | Add/remove symbols; live signal updates; saved automatically |
| **AI Tools** | MCP + CDP setup guide, Claude prompt templates, Pine Script library |

---

### Stopping the App

Press `Ctrl+C` in each terminal to stop the backend and frontend.

---

## How to Run with Docker (One Command)

```bash
# From the project root
docker compose up --build
```

| URL | Service |
|---|---|
| http://localhost:3000 | Frontend (served by Nginx) |
| http://localhost:8000 | Backend API |
| http://localhost:8000/docs | Swagger / OpenAPI docs |

Stop everything:
```bash
docker compose down
```

---

## AI Integration (MCP + CDP)

InvestIQ exposes an **MCP server** so Claude can call its APIs directly from chat, and supports **Chrome DevTools Protocol (CDP)** for automating TradingView chart interactions.

### Strategy 2: MCP + CDP (recommended)

| Mode | What it does | Browser needed? |
|---|---|---|
| **MCP** | Claude calls InvestIQ APIs — top picks, analyze symbol, scan market, portfolio review | No |
| **CDP** | Claude controls Chrome/TradingView — draw indicators, paste Pine Scripts, run backtests, screenshot | Yes (once) |

### Connect Claude to InvestIQ (MCP)

The backend exposes an MCP endpoint at `http://localhost:8000/mcp` (SSE transport).

**Cursor IDE** — add to MCP settings:
```json
{ "mcpServers": { "investiq": { "url": "http://localhost:8000/mcp" } } }
```

**Claude Desktop** — add to `%APPDATA%\Claude\claude_desktop_config.json`:
```json
{ "mcpServers": { "investiq": { "url": "http://localhost:8000/mcp", "transport": "sse" } } }
```

Then ask Claude things like:
- *"Using InvestIQ, show me the top 10 BUY signals today sorted by score"*
- *"Using InvestIQ, give me a full analysis of QCOM"*
- *"Using InvestIQ, find value stocks with P/E < 15 and ROE > 15%"*

### Automate TradingView with CDP

Run once in PowerShell — then close it. Use whichever browser is installed:

**Microsoft Edge** (use this if Chrome is not installed):
```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="C:\EdgeDebug" `
  --no-first-run
```

**Google Chrome** (if installed):
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="C:\ChromeDebug" `
  --no-first-run
```

> Both Edge and Chrome use the same Chromium DevTools Protocol — either works for CDP automation.

Then ask Claude in Cursor (Chrome DevTools MCP is built in):
- *"Open TradingView and navigate to AAPL daily chart"*
- *"Apply the CDC ActionZone V3 Pine Script to the QCOM chart and take a screenshot"*
- *"Run the Golden Cross backtest on SPY weekly and report the results"*

The **AI Tools** tab inside InvestIQ has the full setup guide, copy-ready prompt templates, and a Pine Script library (CDC ActionZone V3, RSI Divergence, Value Zones, MACD Momentum, Golden/Death Cross, BB Squeeze).

---

## What's New (Latest Updates)

| Change | Details |
|---|---|
| **Watchlist: add symbols directly** | Search box + Add button on the Watchlist page; symbols persist across restarts |
| **Watchlist empty by default** | Starts blank — no pre-filled symbols |
| **Persistent portfolio & watchlist** | Data saved to `backend/data/user_data.json` (gitignored); survives app restarts and browser clears |
| **Watchlist symbol fix** | Fixed yfinance MultiIndex columns bug that caused all Watchlist cards to show "Failed to load" |
| **Watchlist card layout fixed** | Signal badge and X button no longer overlap; consistent layout on all cards |
| **Backend log panel on Dashboard** | Live backend output visible in the UI; pause/clear controls |
| **Page state preserved across tabs** | Switching tabs no longer resets filters, sort order, or results |
| **Sortable Portfolio holdings** | Click any column header (Symbol, Shares, Value, G/L, Weight…) to sort asc/desc |
| **Candles removed from Charts page** | TradingView widget is now the sole chart |
| **Resizable TradingView chart** | Drag the grip handle to any height; S / M / L / XL presets + maximize button |
| **Full-width chart mode** | "Hide Panel" button collapses the side panel so the chart spans 100% of the screen width |
| **Flexible TradingView intervals** | 1H / 4H / 1D / 1W / 1M selector in the Charts toolbar |
| **Study presets incl. CDC ActionZone V3** | RSI+MACD+BB, CDC ActionZone V3, Stoch+RSI, ADX+RSI, Volume+RSI, and more |
| **MCP server on backend** | `fastapi-mcp` auto-exposes all InvestIQ APIs at `/mcp` — connect Claude and ask questions directly |
| **AI Tools page** | Setup guide for MCP + CDP, copy-ready Claude prompts, full Pine Script library |
| **Configurable top-N results** | Settings panel: choose 1–100 results, filter by type / signal / P/E / ROE |
| **yfinance upgraded to ≥ 1.4.1** | Uses `curl_cffi` internally — eliminates 429 rate-limit failures |

---

## Features

| Feature | Details |
|---|---|
| **Top N Recommendations** | Scored composite: Technical (35 %) + Value/VI (40 %) + Momentum (25 %) |
| **TradingView Charts** | Full TradingView widget — candlestick, RSI, MACD, Bollinger Bands, drag-to-resize |
| **Technical Analysis** | RSI, MACD, Bollinger Bands, SMA 20/50/200, EMA 12/26, Stochastic, ADX, CCI, Williams %R, ATR, OBV |
| **Chart Patterns** | Double Bottom/Top, Golden/Death Cross, Cup & Handle, Bull Flag, Support Bounce, Oversold Bounce, Breakout, Consolidation, Above 200 SMA |
| **Value Investing** | P/E, P/B, P/S, PEG, EV/EBITDA, ROE, ROA, D/E, Current Ratio, Graham intrinsic value, FCF yield |
| **Screener** | Filter by asset type, sector, signal, P/E, ROE; sort by any column |
| **Portfolio Tracker** | Holdings P&L, allocation donut chart, sortable table, per-position rebalancing recommendations |
| **Watchlist** | Add any symbol; persistent across restarts; live signal updates |
| **Risk Levels** | Low / Medium / High based on ATR% |
| **Target & Stop-Loss** | ATR-based levels shown in side panel |

---

## Tech Stack (All Open Source)

### Backend
| Library | Purpose |
|---|---|
| **Python 3.11** + **FastAPI** | REST API framework |
| **yfinance ≥ 1.4.1** | Free Yahoo Finance market data |
| **pandas** + **NumPy** + **SciPy** | Data processing & pattern detection |
| **Uvicorn** | ASGI server |
| **cachetools** | 30-minute in-memory TTL cache |
| **fastapi-mcp** | Auto-generates MCP server from FastAPI routes (Claude integration) |

### Frontend
| Library | Purpose |
|---|---|
| **React 18** + **TypeScript** + **Vite** | UI framework & build tool |
| **Tailwind CSS v4** | Dark-mode utility CSS |
| **TradingView Widget** (free embed) | Full-featured interactive charts |
| **TanStack Query v5** | Data fetching + cache |
| **Zustand v5** | Persistent watchlist & portfolio state |
| **Lucide React** | Icon set |
| **Axios** | HTTP client |

### DevOps
| Tool | Purpose |
|---|---|
| **Docker** + **Docker Compose** | One-command deployment |
| **Nginx** | Frontend static hosting + `/api` proxy |
| **Vitest** | Frontend unit tests |
| **pytest** | Backend unit tests |

---

## Project Structure

```
InvestPassiveIncome/
├── backend/
│   ├── main.py                  # FastAPI routes + MCP server startup
│   ├── screener.py              # Screener engine (fetch + rank + cache)
│   ├── technical_analysis.py    # TA indicators + chart patterns
│   ├── value_investing.py       # VI metrics + Graham formula + rebalance
│   ├── models.py                # Pydantic models
│   ├── progress.py              # Real-time screener progress tracker
│   ├── log_capture.py           # In-memory log buffer (exposed via /api/logs)
│   ├── user_data.py             # Persistent user data (portfolio, watchlist)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── data/                    # ← gitignored; created on first run
│   │   └── user_data.json       # Saved portfolio, watchlist, screener filters
│   └── tests/
│       └── test_api.py
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Root component; all pages stay mounted (CSS toggle)
│   │   ├── main.tsx
│   │   ├── index.css            # Tailwind v4 @theme
│   │   ├── api.ts               # Axios API client
│   │   ├── store.ts             # Zustand (watchlist + portfolio + backend sync)
│   │   ├── types.ts             # TypeScript interfaces
│   │   ├── utils.ts             # Formatters + color helpers
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── TradingViewWidget.tsx   # Drag-to-resize TradingView embed
│   │   │   ├── BackendLogs.tsx         # Live backend log panel
│   │   │   ├── SignalBadge.tsx
│   │   │   ├── ScoreBar.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   └── pages/
│   │       ├── Dashboard.tsx    # Top-N table, progress feed, settings, log panel
│   │       ├── Screener.tsx     # Filter + sort screener
│   │       ├── Charts.tsx       # TradingView chart + full analysis panel
│   │       ├── Portfolio.tsx    # Holdings P&L + sortable table + rebalancing
│   │       ├── Watchlist.tsx    # Add/remove symbols; persistent watchlist
│   │       └── AITools.tsx      # MCP + CDP guide, Claude prompts, Pine Scripts
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.ts           # strictPort: 5173; proxy → 127.0.0.1:8000
│   └── vitest.config.ts
└── docker-compose.yml
```

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/top20` | GET | Top N ranked recommendations |
| `/api/stocks` | GET | Top stock recommendations |
| `/api/etfs` | GET | Top ETF recommendations |
| `/api/mutual-funds` | GET | Top mutual fund recommendations |
| `/api/symbol/{symbol}` | GET | Full analysis for one symbol |
| `/api/chart/{symbol}` | GET | OHLCV data for charting |
| `/api/portfolio/analyze` | POST | Analyze portfolio holdings |
| `/api/search?q=` | GET | Search / autocomplete symbols |
| `/api/sectors` | GET | Available sector list |
| `/api/screener/status` | GET | Live screener progress (polled by Dashboard) |
| `/api/logs` | GET | Recent backend log lines (polled by log panel) |
| `/api/user-data` | GET | Load saved portfolio, watchlist, screener filters |
| `/api/user-data` | POST | Save portfolio, watchlist, screener filters to disk |

### `/api/top20` query params

| Param | Type | Example | Description |
|---|---|---|---|
| `asset_types` | string | `stock,etf` | Comma-separated: `stock`, `etf`, `mutual_fund` |
| `limit` | int | `20` | Max results (1–100) |
| `sector` | string | `Technology` | Filter by sector |
| `max_pe` | float | `25` | Max P/E ratio |
| `min_roe` | float | `15` | Min ROE % |
| `signal` | string | `BUY,STRONG BUY` | Signal filter |

---

## How Scoring Works

### Signal Score (0–100)

```
Score = Technical × 0.35 + Value × 0.40 + Momentum × 0.25
```

For ETFs / Mutual Funds (no fundamentals):
```
Score = Technical × 0.50 + Value × 0.15 + Momentum × 0.35
```

### Signal Thresholds

| Score | Signal |
|---|---|
| ≥ 80 | STRONG BUY |
| 65–79 | BUY |
| 45–64 | HOLD |
| 30–44 | SELL |
| < 30 | STRONG SELL |

### Graham Intrinsic Value

```
V = EPS × (8.5 + 2g) × (4.4 / Y)
```

`g` = expected EPS growth rate (%), `Y` = current AAA bond yield (~4.5 %).  
A **Margin of Safety > 30 %** earns maximum value-score bonus.

---

## Running Tests

### Backend

```powershell
cd backend

# Windows — call pytest through the venv directly (no activation needed)
.\venv\Scripts\pytest.exe tests/ -v

# macOS / Linux (after activating venv)
# pytest tests/ -v
```

### Frontend

```bash
cd frontend
npm test

# With coverage report
npm run test:coverage
```

---

## Deploying to a Real Website

### Option A — VPS / Cloud VM (DigitalOcean, Linode, AWS EC2, etc.)

**What you need:**
- A Linux VPS (Ubuntu 22.04 recommended, ≥ 1 GB RAM)
- A domain name (optional but recommended)
- Docker installed on the server

**Steps:**

```bash
# 1. SSH into your server
ssh user@your-server-ip

# 2. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 3. Clone / upload the project
git clone https://github.com/YOUR_USERNAME/InvestIQ.git
cd InvestIQ

# 4. Build and start
docker compose up --build -d
# App is now live on port 3000
```

**To use a domain + HTTPS (recommended):**

```bash
sudo apt install certbot python3-certbot-nginx -y
# Edit /etc/nginx/sites-available/default to point to localhost:3000
sudo certbot --nginx -d yourdomain.com
```

Or use [Caddy](https://caddyserver.com/) — handles HTTPS automatically:

```
# Caddyfile (place in project root)
yourdomain.com {
    reverse_proxy localhost:3000
}
```

---

### Option B — Railway (Free Tier Available)

1. Push the repo to GitHub.
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**.
3. Railway auto-detects `docker-compose.yml` and deploys both services.
4. Assign a Railway domain (free `*.up.railway.app`) or your own domain.

---

### Option C — Render.com

1. Create a **Web Service** pointing to the `backend/` folder.
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
2. Create a **Static Site** pointing to the `frontend/` folder.
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
   - Add a rewrite rule: `/* → /index.html`
3. Set environment variable `VITE_API_BASE_URL` to the Render backend URL.

---

### Option D — Fly.io

```bash
curl -L https://fly.io/install.sh | sh

# From project root
fly launch        # creates fly.toml for the backend
fly deploy

# Repeat for the frontend
cd frontend && fly launch && fly deploy
```

---

### Environment Variables

| Variable | Where | Description |
|---|---|---|
| `VITE_API_BASE_URL` | Frontend build | Override API base URL (e.g. `https://api.yourdomain.com`) |
| `PORT` | Backend | Port for Uvicorn (auto-set by most cloud platforms) |
| `CACHE_TTL_MINUTES` | Backend (optional) | Override cache duration (default 30) |

```bash
cd frontend
VITE_API_BASE_URL=https://api.yourdomain.com npm run build
```

Built files land in `frontend/dist/` — serve from any static host (Netlify, Vercel, S3, etc.).

---

## Adding Custom Symbols

Edit the universe lists in `backend/screener.py`:

```python
STOCK_UNIVERSE = ["AAPL", "MSFT", "NVDA", ...]   # add any valid ticker
ETF_UNIVERSE   = ["SPY", "QQQ", "VTI", ...]
MUTUAL_FUND_UNIVERSE = ["FXAIX", "VFIAX", ...]
```

You can also add any symbol directly from the **Watchlist page** — just type the ticker in the search box and click Add.

---

## Rebalancing Actions

| Combined Score | Recommendation |
|---|---|
| ≥ 75 | Increase Position / Add on Dips |
| 60–74 | Hold — Moderate signals |
| 45–59 | Neutral — Review position size |
| 30–44 | Reduce Position |
| < 30 | Exit Position |

---

## Troubleshooting

| Issue | Fix |
|---|---|
| **Watchlist cards show "Failed to load"** | Ensure backend is running (`uvicorn ... --host 127.0.0.1`); symbol must be a valid Yahoo Finance ticker |
| **Dashboard shows all zeros after Refresh** | Wait 60–90 s for first scrape; watch the live log panel on the Dashboard for errors |
| **`ECONNREFUSED` on Windows** | Use `--host 127.0.0.1` when starting Uvicorn; Vite proxy target is already set to `127.0.0.1:8000` |
| **Frontend opens on port 5174 instead of 5173** | Another process is using 5173. Kill it or restart. Port is locked with `strictPort: true` to protect localStorage |
| **`429 Too Many Requests` from Yahoo Finance** | Upgrade: `pip install "yfinance>=1.4.1"`. First run always fetches live; subsequent runs use 30-min cache |
| **TradingView widget blank** | Check browser console for CSP errors; ensure internet access (widget loads from TradingView CDN) |
| **`npm run build` TS errors** | Run `npm run lint` to see exact errors; usually unused imports or type mismatches |
| **Docker port conflict** | Edit `docker-compose.yml` port mappings if 3000/8000 are already in use |
| **Portfolio/watchlist reset after restart** | Data is saved to `backend/data/user_data.json`. Make sure the backend is running when you make changes — the frontend syncs to it automatically |

---

## Disclaimer

This software is for **informational and educational purposes only**. It does not constitute financial advice. Always do your own research (DYOR) before investing. Past performance does not guarantee future results.

---

## License

MIT License — free to use, modify, and distribute.
