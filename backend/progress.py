"""
Lightweight in-memory screener progress tracker.
The screener writes step messages here; the frontend polls /api/screener/status.
"""
import time
from typing import List, Optional
from dataclasses import dataclass, field

@dataclass
class ProgressStep:
    message: str
    elapsed_ms: int
    done: bool = False

@dataclass
class ScreenerProgress:
    running: bool = False
    start_ts: float = 0.0
    steps: List[ProgressStep] = field(default_factory=list)
    total_symbols: int = 0
    downloaded_symbols: int = 0
    analyzed_symbols: int = 0
    error: Optional[str] = None

    def reset(self, total: int = 0):
        self.running = True
        self.start_ts = time.time()
        self.steps = []
        self.total_symbols = total
        self.downloaded_symbols = 0
        self.analyzed_symbols = 0
        self.error = None

    def log(self, message: str, done: bool = False):
        elapsed = int((time.time() - self.start_ts) * 1000)
        self.steps.append(ProgressStep(message=message, elapsed_ms=elapsed, done=done))

    def finish(self, count: int):
        self.running = False
        elapsed = int((time.time() - self.start_ts) * 1000)
        self.steps.append(ProgressStep(
            message=f"Done — {count} recommendations ready",
            elapsed_ms=elapsed,
            done=True
        ))

    def fail(self, msg: str):
        self.running = False
        self.error = msg
        elapsed = int((time.time() - self.start_ts) * 1000)
        self.steps.append(ProgressStep(
            message=f"Error: {msg}",
            elapsed_ms=elapsed,
            done=False
        ))

    def to_dict(self) -> dict:
        elapsed_total = int((time.time() - self.start_ts) * 1000) if self.running else (
            self.steps[-1].elapsed_ms if self.steps else 0
        )
        return {
            "running": self.running,
            "elapsed_ms": elapsed_total,
            "total_symbols": self.total_symbols,
            "downloaded_symbols": self.downloaded_symbols,
            "analyzed_symbols": self.analyzed_symbols,
            "steps": [
                {"message": s.message, "elapsed_ms": s.elapsed_ms, "done": s.done}
                for s in self.steps[-20:]   # last 20 steps
            ],
            "error": self.error,
        }


# Global singleton — one screener runs at a time
progress = ScreenerProgress()
