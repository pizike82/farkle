"""Mix OS CSPRNG with hashed player/client noise for die rolls.

Fairness: faces are chosen uniformly from OS entropy (os.urandom) with
rejection sampling. Player stats, mouse samples, and timings are hashed
into the pool so the stream is unique per session — they never replace
the OS generator (that would be easier to bias).
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from typing import Any


def _bytes(value: Any) -> bytes:
    if value is None:
        return b""
    if isinstance(value, bytes):
        return value
    if isinstance(value, str):
        return value.encode("utf-8", "replace")
    try:
        return json.dumps(value, sort_keys=True, default=str).encode("utf-8")
    except TypeError:
        return repr(value).encode("utf-8", "replace")


class Entropy:
    def __init__(self) -> None:
        self._state = os.urandom(32)
        self._stirs = 0
        self.stir(b"farkle-boot", time.time_ns())

    def stir(self, *parts: Any) -> None:
        h = hashlib.sha256()
        h.update(self._state)
        h.update(os.urandom(16))
        h.update(time.time_ns().to_bytes(8, "big"))
        h.update(self._stirs.to_bytes(8, "big"))
        for part in parts:
            h.update(_bytes(part))
        self._state = h.digest()
        self._stirs += 1

    def stir_stats(self, stats: Any) -> None:
        G = getattr(stats, "game", {}) or {}
        L = getattr(stats, "lifetime", {}) or {}
        self.stir(
            {
                "nerve": L.get("nerve"),
                "rolls": L.get("rolls"),
                "banks": L.get("banks"),
                "farkles": L.get("farkles"),
                "points": G.get("points_banked"),
                "round": G.get("rounds"),
                "elapsed": G.get("elapsed_ms"),
                "dice": L.get("dice_rolled"),
                "hot": G.get("hot_dice"),
            }
        )

    def stir_client(self, payload: Any) -> None:
        if not isinstance(payload, dict):
            return
        moves = payload.get("moves")
        if isinstance(moves, list):
            moves = moves[-64:]
        else:
            moves = []
        self.stir(
            {
                "id": str(payload.get("id") or "")[:80],
                "name": str(payload.get("name") or "")[:80],
                "t": payload.get("t"),
                "perf": payload.get("perf"),
                "x": payload.get("x"),
                "y": payload.get("y"),
                "w": payload.get("w"),
                "h": payload.get("h"),
                "keys": payload.get("keys"),
                "moves": moves,
            }
        )

    def die(self) -> int:
        """Uniform 1–6. Mix pool, then rejection-sample os.urandom."""
        self.stir(b"die")
        while True:
            n = os.urandom(1)[0] ^ self._state[self._stirs % 32]
            self.stir(bytes([n]))
            if n < 252:
                return n % 6 + 1


engine = Entropy()
