"""
Persistent user data (portfolio holdings, watchlist, screener filters).
Saved as JSON in backend/data/user_data.json — not committed to git.
"""
import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DATA_FILE = Path(__file__).parent / "data" / "user_data.json"

_DEFAULT: dict = {
    "portfolioHoldings": [],
    "watchlist": [],
    "screenerFilters": {
        "asset_types": "stock,etf",
        "limit": 20,
        "sector": "",
        "max_pe": None,
        "min_roe": None,
        "signal": "",
    },
}


def load() -> dict:
    """Load user data from disk. Returns defaults if file doesn't exist."""
    try:
        if DATA_FILE.exists():
            data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
            # Merge with defaults to handle missing keys from older versions
            merged = {**_DEFAULT, **data}
            return merged
    except Exception as e:
        logger.warning(f"Could not load user data: {e}")
    return dict(_DEFAULT)


def save(data: dict) -> None:
    """Persist user data to disk atomically."""
    try:
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = DATA_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(DATA_FILE)
        logger.debug(f"User data saved → {DATA_FILE}")
    except Exception as e:
        logger.error(f"Could not save user data: {e}")
