"""Persistent Farkle metrics (lifetime + current game)."""

from __future__ import annotations

import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATS_PATH = ROOT / "data" / "stats.json"
IDLE_LIMIT_MS = 3 * 60 * 1000
IMPOSSIBLE_WIN_MS = 12 * 60 * 60 * 1000

KIND_WORD = {3: "Three", 4: "Four", 5: "Five", 6: "Six"}

COMBO_LABELS = {
    "straight": "Straight",
    "two_triplets": "Two triplets",
    "three_pairs": "Three pairs",
    "four_plus_pair": "Four of a kind + pair",
    "single_1": "Single 1",
    "single_5": "Single 5",
}


def combo_label(key: str) -> str:
    if key in COMBO_LABELS:
        return COMBO_LABELS[key]
    if key.startswith("of_kind_"):
        return key
    parts = key.split("_")
    # "{n}_of_kind_{face}"
    if len(parts) == 4 and parts[1] == "of" and parts[2] == "kind":
        n, face = int(parts[0]), parts[3]
        return f"{KIND_WORD.get(n, n)} {face}s"
    return key


def empty_lifetime() -> dict:
    return {
        "games_started": 0,
        "games_won": 0,
        "fewest_rounds_to_win": None,
        "exact_10000_wins": 0,
        "overshoot_total": 0,
        "last_overshoot": 0,
        "dice_rolled": 0,
        "face_counts": [0, 0, 0, 0, 0, 0, 0],
        "rolls": 0,
        "banks": 0,
        "farkles": 0,
        "six_die_farkles": 0,
        "first_roll_farkles": 0,
        "hot_dice": 0,
        "hot_dice_six": 0,
        "hot_streak": 0,
        "best_hot_streak": 0,
        "push_your_luck": 0,
        "conservative_banks": 0,
        "points_banked": 0,
        "points_farkled": 0,
        "biggest_bust": 0,
        "highest_turn_banked": 0,
        "highest_selection": 0,
        "best_combo": {"key": None, "label": None, "score": 0},
        "best_lock": {"label": None, "score": 0},
        "combo_counts": {},
        "no_bust_streak": 0,
        "best_no_bust_streak": 0,
        "bust_streak": 0,
        "longest_bust_streak": 0,
        "on_fire_streak": 0,
        "best_on_fire_streak": 0,
        "rounds_completed": 0,
        "successful_rounds": 0,
        "round_score_sum": 0,
        "best_round_score": 0,
        "bank_remaining_sum": 0,
        "bank_remaining_n": 0,
        "time_played_ms": 0,
        "fastest_win_ms": None,
        "abandons": 0,
        "blunders": 0,
        "blunder_points": 0,
        "blunder_busts": 0,
        "last_blunder": {"label": None, "cost": 0, "kind": None},
        "worst_blunder": {"label": None, "cost": 0, "kind": None},
        "nerve": 1000,
        "games_rated": 0,
    }


def empty_game() -> dict:
    return {
        "rounds": 0,
        "farkles": 0,
        "points_farkled": 0,
        "no_bust_streak": 0,
        "bust_streak": 0,
        "on_fire_streak": 0,
        "rolls": 0,
        "banks": 0,
        "hot_dice": 0,
        "hot_dice_six": 0,
        "hot_streak": 0,
        "points_banked": 0,
        "elapsed_ms": 0,
        "started_at_ms": None,
        "ended_at_ms": None,
        "blunders": 0,
        "blunder_points": 0,
        "blunder_busts": 0,
        "abandoned": False,
        "paused": False,
        "last_blunder": {"label": None, "cost": 0, "kind": None},
    }


def now_ms() -> int:
    return int(time.time() * 1000)


class Stats:
    def __init__(self, path: Path = STATS_PATH) -> None:
        self.path = path
        self.lifetime = empty_lifetime()
        self.game = empty_game()
        self._running_since: int | None = None
        self._last_action_ms: int | None = None
        self._clock_on = False
        self.load()

    def load(self) -> None:
        if not self.path.exists():
            return
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        life = empty_lifetime()
        life.update(raw.get("lifetime") or {})
        if not isinstance(life.get("face_counts"), list) or len(life["face_counts"]) < 7:
            life["face_counts"] = [0, 0, 0, 0, 0, 0, 0]
        if not isinstance(life.get("combo_counts"), dict):
            life["combo_counts"] = {}
        if not isinstance(life.get("last_blunder"), dict):
            life["last_blunder"] = {"label": None, "cost": 0, "kind": None}
        if not isinstance(life.get("worst_blunder"), dict):
            life["worst_blunder"] = {"label": None, "cost": 0, "kind": None}
        if life.get("nerve") is None:
            life["nerve"] = 1000
        best = life.get("fastest_win_ms")
        if best is not None and int(best) > IMPOSSIBLE_WIN_MS:
            life["fastest_win_ms"] = None
        self.lifetime = life
        game = empty_game()
        game.update(raw.get("game") or {})
        self.game = game
        self._migrate_elapsed()
        self._resume_clock()

    def save(self) -> None:
        self.flush_clock(persist=False)
        payload = json.dumps({"lifetime": self.lifetime, "game": self.game}, indent=2)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".json.tmp")
        tmp.write_text(payload, encoding="utf-8")
        for attempt in range(6):
            try:
                tmp.replace(self.path)
                return
            except PermissionError:
                if attempt == 5:
                    self.path.write_text(payload, encoding="utf-8")
                    return
                time.sleep(0.05)

    def reset_game(self) -> None:
        self._clock_on = False
        self._running_since = None
        self._last_action_ms = None
        self.game = empty_game()
        self.lifetime["no_bust_streak"] = 0
        self.lifetime["bust_streak"] = 0
        self.lifetime["on_fire_streak"] = 0
        self.lifetime["hot_streak"] = 0
        self.save()

    def start_game(self) -> None:
        self.close_clock(won=False)
        self.lifetime["games_started"] += 1
        self.reset_game()

    def _game_open(self) -> bool:
        return not self.game.get("ended_at_ms") and not self.game.get("abandoned")

    def _migrate_elapsed(self) -> None:
        """Never derive elapsed from now/mtime − started_at (that counts downtime)."""
        self.game["elapsed_ms"] = max(0, int(self.game.get("elapsed_ms") or 0))

    def _resume_clock(self) -> None:
        self._running_since = None
        self._last_action_ms = None
        self._clock_on = False
        if not self._game_open():
            return
        if self.game.get("paused"):
            return
        if int(self.game.get("elapsed_ms") or 0) <= 0 and not self.game.get("started_at_ms"):
            return
        if int(self.game.get("rolls") or 0) <= 0 and int(self.game.get("elapsed_ms") or 0) <= 0:
            return
        t = now_ms()
        self._clock_on = True
        self._running_since = t
        self._last_action_ms = t

    def clock_running(self) -> bool:
        if self.game.get("paused"):
            return False
        if not self._clock_on or self._running_since is None:
            return False
        last = self._last_action_ms or self._running_since
        return (now_ms() - last) < IDLE_LIMIT_MS

    def flush_clock(self, *, persist: bool = False) -> int:
        if self.game.get("paused"):
            self._clock_on = False
            self._running_since = None
        elif self._clock_on and self._running_since is not None:
            t = now_ms()
            last = self._last_action_ms or self._running_since
            if t - last >= IDLE_LIMIT_MS:
                end = last
                self._clock_on = False
                extra = max(0, end - self._running_since)
                self._running_since = None
            else:
                extra = max(0, t - self._running_since)
                self._running_since = t
            self.game["elapsed_ms"] = int(self.game.get("elapsed_ms") or 0) + extra
        if persist:
            payload = json.dumps({"lifetime": self.lifetime, "game": self.game}, indent=2)
            tmp = self.path.with_suffix(".json.tmp")
            tmp.write_text(payload, encoding="utf-8")
            tmp.replace(self.path)
        return int(self.game.get("elapsed_ms") or 0)

    def touch(self) -> None:
        if self.game.get("paused"):
            return
        self.flush_clock(persist=False)
        if not self._game_open():
            return
        t = now_ms()
        if not self._clock_on:
            self._clock_on = True
            self._running_since = t
        self._last_action_ms = t

    def toggle_pause(self) -> bool:
        if self.game.get("paused"):
            self.game["paused"] = False
            if self._game_open() and (
                self.game.get("started_at_ms") or int(self.game.get("elapsed_ms") or 0)
            ):
                t = now_ms()
                self._clock_on = True
                self._running_since = t
                self._last_action_ms = t
        else:
            self.flush_clock(persist=False)
            self._clock_on = False
            self._running_since = None
            self.game["paused"] = True
        self.save()
        return bool(self.game.get("paused"))

    def mark_start(self) -> None:
        if self.game.get("started_at_ms") is None:
            self.game["started_at_ms"] = now_ms()
            self.game["ended_at_ms"] = None
            if not self.game.get("elapsed_ms"):
                self.game["elapsed_ms"] = 0
        self.touch()

    def elapsed_ms(self) -> int:
        acc = int(self.game.get("elapsed_ms") or 0)
        if self.game.get("paused") or not self._clock_on or self._running_since is None:
            return acc
        t = now_ms()
        last = self._last_action_ms or self._running_since
        if t - last >= IDLE_LIMIT_MS:
            return acc + max(0, last - self._running_since)
        return acc + max(0, t - self._running_since)

    def close_clock(self, *, won: bool = False) -> int:
        if self.game.get("ended_at_ms") is not None:
            return int(self.game.get("elapsed_ms") or 0)
        if self.game.get("started_at_ms") is None and int(self.game.get("elapsed_ms") or 0) <= 0:
            return 0
        elapsed = self.flush_clock(persist=False)
        self._clock_on = False
        self._running_since = None
        self.game["ended_at_ms"] = now_ms()
        self.game["elapsed_ms"] = elapsed
        self.game["paused"] = False
        self.lifetime["time_played_ms"] = int(self.lifetime.get("time_played_ms") or 0) + elapsed
        if won:
            best = self.lifetime.get("fastest_win_ms")
            if best is not None and int(best) > IMPOSSIBLE_WIN_MS:
                best = None
            if best is None or elapsed < best:
                self.lifetime["fastest_win_ms"] = elapsed
        return elapsed

    def record_roll(self, values: list[int], *, push: bool, hot: bool) -> None:
        self.mark_start()
        L, G = self.lifetime, self.game
        L["rolls"] += 1
        G["rolls"] += 1
        L["dice_rolled"] += len(values)
        for v in values:
            if 1 <= v <= 6:
                L["face_counts"][v] += 1
        if push:
            L["push_your_luck"] += 1

    def record_hot(self, *, full_six: bool) -> dict:
        """Every remaining die in the current set scored (roll again or bank)."""
        L, G = self.lifetime, self.game
        first = int(L.get("hot_dice") or 0) == 0
        L["hot_dice"] = int(L.get("hot_dice") or 0) + 1
        G["hot_dice"] = int(G.get("hot_dice") or 0) + 1
        if full_six:
            L["hot_dice_six"] = int(L.get("hot_dice_six") or 0) + 1
            G["hot_dice_six"] = int(G.get("hot_dice_six") or 0) + 1
        L["hot_streak"] = int(L.get("hot_streak") or 0) + 1
        G["hot_streak"] = int(G.get("hot_streak") or 0) + 1
        if L["hot_streak"] > int(L.get("best_hot_streak") or 0):
            L["best_hot_streak"] = L["hot_streak"]
        return {
            "first": first,
            "full_six": full_six,
            "streak": G["hot_streak"],
            "game": G["hot_dice"],
            "lifetime": L["hot_dice"],
        }

    def _reset_hot_streak(self) -> None:
        self.lifetime["hot_streak"] = 0
        self.game["hot_streak"] = 0

    def record_success_roll(self) -> None:
        L, G = self.lifetime, self.game
        L["on_fire_streak"] += 1
        G["on_fire_streak"] += 1
        if L["on_fire_streak"] > L["best_on_fire_streak"]:
            L["best_on_fire_streak"] = L["on_fire_streak"]

    def record_selection(self, explained: dict) -> None:
        self.touch()
        L = self.lifetime
        score = explained["score"]
        if score > L["highest_selection"]:
            L["highest_selection"] = score
        labels = [c["label"] for c in explained["combos"]]
        lock_label = " + ".join(labels) if labels else None
        if score > L["best_lock"]["score"]:
            L["best_lock"] = {"label": lock_label, "score": score}
        for combo in explained["combos"]:
            key = combo["key"]
            L["combo_counts"][key] = L["combo_counts"].get(key, 0) + combo.get("count", 1)
            if combo["score"] > L["best_combo"]["score"]:
                L["best_combo"] = {
                    "key": key,
                    "label": combo["label"],
                    "score": combo["score"],
                }

    def record_blunder(self, *, kind: str, cost: int, label: str) -> None:
        L, G = self.lifetime, self.game
        cost = max(0, int(cost))
        L["blunders"] += 1
        G["blunders"] += 1
        L["blunder_points"] += cost
        G["blunder_points"] += cost
        entry = {"label": label, "cost": cost, "kind": kind}
        L["last_blunder"] = entry
        G["last_blunder"] = entry
        worst = L.get("worst_blunder") or {}
        if cost >= int(worst.get("cost") or 0):
            L["worst_blunder"] = entry

    def apply_nerve(self, *, won: bool, abandoned: bool = False) -> None:
        # Nerve: 1000-centered play-quality rating (not Elo). After each finished
        # game (win or abandon): quality in [0, 1] =
        #   0.28*efficiency + 0.18*avg_round/400 + 0.14*(1-farkle_rate)
        #   + 0.14*(1-blunder_rate) + 0.08*hot_rate + 0.18*outcome (1 win / 0 abandon).
        # Abandon caps quality at 0.40 then −0.08, so quitting cannot raise Nerve.
        # Messy high-blunder/high-farkle wins sit near 0.5 and barely move it.
        # Clean wins add about +K; delta = K * (quality − 0.5) * 2.
        # K is 28 for the first 8 rated games, then 16. Clamped to 100–3000.
        G = self.game
        banked = int(G.get("points_banked") or 0)
        farkled = int(G.get("points_farkled") or 0)
        pot = banked + farkled
        efficiency = (banked / pot) if pot else (1.0 if won else 0.2)
        rounds = max(1, int(G.get("rounds") or 0))
        avg_norm = min(1.0, (banked / rounds) / 400.0)
        farkle_rate = min(1.0, int(G.get("farkles") or 0) / rounds)
        decisions = max(1, int(G.get("rolls") or 0) + int(G.get("banks") or 0))
        blunder_rate = min(1.0, int(G.get("blunders") or 0) / decisions)
        hot_rate = min(1.0, int(G.get("hot_dice") or 0) / max(1, int(G.get("rolls") or 0)))
        outcome = 1.0 if won else 0.0
        quality = (
            0.28 * efficiency
            + 0.18 * avg_norm
            + 0.14 * (1.0 - farkle_rate)
            + 0.14 * (1.0 - blunder_rate)
            + 0.08 * hot_rate
            + 0.18 * outcome
        )
        if abandoned:
            quality = min(quality, 0.40) - 0.08
        elif won and int(G.get("rounds") or 0) and int(G["rounds"]) <= 12:
            quality += 0.05
        quality = max(0.0, min(1.0, quality))
        rated = int(self.lifetime.get("games_rated") or 0)
        k = 28 if rated < 8 else 16
        delta = round(k * (quality - 0.5) * 2)
        current = int(self.lifetime.get("nerve") or 1000)
        self.lifetime["nerve"] = max(100, min(3000, current + delta))
        self.lifetime["games_rated"] = rated + 1

    def record_farkle(
        self, lost: int, *, dice_count: int, first_roll: bool, push_blunder: bool = False
    ) -> None:
        self.touch()
        L, G = self.lifetime, self.game
        L["farkles"] += 1
        G["farkles"] += 1
        L["points_farkled"] += lost
        G["points_farkled"] += lost
        if lost > L["biggest_bust"]:
            L["biggest_bust"] = lost
        if dice_count == 6:
            L["six_die_farkles"] += 1
        if first_roll:
            L["first_roll_farkles"] += 1
        L["on_fire_streak"] = 0
        G["on_fire_streak"] = 0
        self._reset_hot_streak()
        L["no_bust_streak"] = 0
        G["no_bust_streak"] = 0
        L["bust_streak"] += 1
        G["bust_streak"] += 1
        if L["bust_streak"] > L["longest_bust_streak"]:
            L["longest_bust_streak"] = L["bust_streak"]
        L["rounds_completed"] += 1
        G["rounds"] += 1
        if push_blunder:
            L["blunder_busts"] += 1
            G["blunder_busts"] += 1
        self.save()

    def record_bank(self, banked: int, remaining: int, *, hot: bool = False) -> None:
        self.touch()
        L, G = self.lifetime, self.game
        L["banks"] += 1
        G["banks"] += 1
        L["points_banked"] += banked
        G["points_banked"] += banked
        if banked > L["highest_turn_banked"]:
            L["highest_turn_banked"] = banked
        if banked > L["best_round_score"]:
            L["best_round_score"] = banked
        if banked < 300:
            L["conservative_banks"] += 1
        L["bank_remaining_sum"] += remaining
        L["bank_remaining_n"] += 1
        L["bust_streak"] = 0
        G["bust_streak"] = 0
        L["no_bust_streak"] += 1
        G["no_bust_streak"] += 1
        if L["no_bust_streak"] > L["best_no_bust_streak"]:
            L["best_no_bust_streak"] = L["no_bust_streak"]
        L["rounds_completed"] += 1
        L["successful_rounds"] += 1
        L["round_score_sum"] += banked
        G["rounds"] += 1
        if not hot:
            self._reset_hot_streak()
        self.save()

    def record_win(self, rounds: int, total: int, target: int) -> None:
        L = self.lifetime
        L["games_won"] += 1
        if L["fewest_rounds_to_win"] is None or rounds < L["fewest_rounds_to_win"]:
            L["fewest_rounds_to_win"] = rounds
        self.close_clock(won=True)
        overshoot = total - target
        L["last_overshoot"] = overshoot
        if overshoot == 0:
            L["exact_10000_wins"] += 1
        else:
            L["overshoot_total"] += overshoot
        self.apply_nerve(won=True)
        self.save()

    def record_abandon(self, _total: int, _rounds: int) -> None:
        self.close_clock(won=False)
        self.lifetime["abandons"] += 1
        self.game["abandoned"] = True
        self.apply_nerve(won=False, abandoned=True)
        self.save()

    def snapshot(self) -> dict:
        L = self.lifetime
        rolled = L["dice_rolled"]
        faces = {}
        for f in range(1, 7):
            n = L["face_counts"][f]
            faces[str(f)] = {
                "count": n,
                "pct": round(100 * n / rolled, 1) if rolled else 0,
            }
        turns = L["banks"] + L["farkles"]
        farkled = L["points_farkled"]
        banked = L["points_banked"]
        combo_counts = L["combo_counts"]
        most_key = None
        most_n = 0
        for key, n in combo_counts.items():
            if n > most_n:
                most_key, most_n = key, n
        rounds = L["rounds_completed"]
        rem_n = L["bank_remaining_n"]
        elapsed = self.elapsed_ms()
        game_rounds = self.game.get("rounds") or 0
        time_played = int(L.get("time_played_ms") or 0)
        if self._game_open() and (
            self.game.get("started_at_ms") or self.game.get("elapsed_ms") or self._clock_on
        ):
            time_played += elapsed
        return {
            "lifetime": {
                **L,
                "time_played_ms": time_played,
                "face_pct": faces,
                "farkle_rate": round(100 * L["farkles"] / turns, 1) if turns else 0,
                "avg_per_round": round(L["round_score_sum"] / rounds, 1) if rounds else 0,
                "efficiency": (
                    round(100 * banked / (banked + farkled), 1) if (banked + farkled) else 0
                ),
                "avg_remaining_dice": (
                    round(L["bank_remaining_sum"] / rem_n, 2) if rem_n else 0
                ),
                "most_common_combo": (
                    {"key": most_key, "label": combo_label(most_key), "count": most_n}
                    if most_key
                    else None
                ),
                "avg_time_per_round_ms": round(time_played / rounds) if rounds else 0,
                "blunder_rate": (
                    round(100 * L["blunders"] / (L["rolls"] + L["banks"]), 1)
                    if (L["rolls"] + L["banks"])
                    else 0
                ),
            },
            "game": {
                **self.game,
                "elapsed_ms": elapsed,
                "avg_time_per_round_ms": round(elapsed / game_rounds) if game_rounds else 0,
            },
        }
