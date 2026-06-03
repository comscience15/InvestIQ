"""
In-memory log capture for the InvestIQ backend.
Installs a logging handler that keeps the last 300 log records in a deque.
Exposed via /api/logs so the frontend can display live backend output.
"""
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Deque

MAX_LINES = 300


@dataclass
class LogLine:
    ts: float
    level: str
    name: str
    message: str

    def to_dict(self) -> dict:
        return {
            "ts": self.ts,
            "level": self.level,
            "logger": self.name,
            "message": self.message,
        }


class _MemoryHandler(logging.Handler):
    def __init__(self, buf: "Deque[LogLine]"):
        super().__init__()
        self._buf = buf

    def emit(self, record: logging.LogRecord):
        try:
            self._buf.append(LogLine(
                ts=record.created,
                level=record.levelname,
                name=record.name,
                message=self.format(record),
            ))
        except Exception:
            pass


# Global buffer — shared across the whole process
_buffer: Deque[LogLine] = deque(maxlen=MAX_LINES)
_handler = _MemoryHandler(_buffer)
_handler.setFormatter(logging.Formatter("%(message)s"))


def install(level: int = logging.INFO) -> None:
    """Call once at startup to attach the handler to the root logger."""
    root = logging.getLogger()
    root.addHandler(_handler)
    root.setLevel(min(root.level or logging.WARNING, level))


def get_lines(since_ts: float = 0.0, limit: int = 200) -> list:
    """Return up to `limit` log lines newer than `since_ts`."""
    result = [l for l in _buffer if l.ts > since_ts]
    return [l.to_dict() for l in result[-limit:]]
