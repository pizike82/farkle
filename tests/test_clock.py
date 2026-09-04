"""Elapsed time must not include time the server was stopped."""

from __future__ import annotations

import json
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from farkle.stats import Stats, now_ms


def _write(path: Path, game: dict, lifetime: dict | None = None) -> None:
    path.write_text(
        json.dumps({"lifetime": lifetime or {}, "game": game}),
        encoding="utf-8",
    )


def test_restart_does_not_count_downtime() -> None:
    path = Path(tempfile.mkdtemp()) / "stats.json"
    past = now_ms() - 45 * 60 * 1000
    _write(
        path,
        {
            "elapsed_ms": 120_000,
            "started_at_ms": past,
            "ended_at_ms": None,
            "rolls": 5,
        },
    )
    st = Stats(path)
    elapsed = st.elapsed_ms()
    assert 120_000 <= elapsed < 125_000, elapsed

    st.flush_clock(persist=True)
    saved = json.loads(path.read_text(encoding="utf-8"))["game"]["elapsed_ms"]
    assert saved < 130_000

    time.sleep(0.05)
    st2 = Stats(path)
    elapsed2 = st2.elapsed_ms()
    assert elapsed2 < 130_000, elapsed2
    assert elapsed2 >= saved


def test_old_started_at_does_not_use_wall_clock() -> None:
    path = Path(tempfile.mkdtemp()) / "stats.json"
    start = now_ms() - 45 * 60 * 1000
    _write(path, {"started_at_ms": start, "ended_at_ms": None, "rolls": 8})
    st = Stats(path)
    elapsed = st.elapsed_ms()
    assert elapsed < 5_000, elapsed


def test_close_clock_uses_accumulated() -> None:
    path = Path(tempfile.mkdtemp()) / "stats.json"
    past = now_ms() - 45 * 60 * 1000
    _write(
        path,
        {
            "elapsed_ms": 90_000,
            "started_at_ms": past,
            "ended_at_ms": None,
            "rolls": 3,
        },
    )
    st = Stats(path)
    elapsed = st.close_clock(won=True)
    assert 90_000 <= elapsed < 95_000, elapsed
    assert st.lifetime["fastest_win_ms"] == elapsed
    assert st.lifetime["time_played_ms"] == elapsed


if __name__ == "__main__":
    test_restart_does_not_count_downtime()
    test_old_started_at_does_not_use_wall_clock()
    test_close_clock_uses_accumulated()
    print("clock tests ok")
