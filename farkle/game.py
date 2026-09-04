"""Farkle scoring and single-player turn state."""

from __future__ import annotations

from .entropy import engine
from .stats import Stats, combo_label

TARGET = 10000


def explain_score(values: list[int]) -> dict:
    counts = [0] * 7
    for v in values:
        counts[v] += 1
    combos: list[dict] = []

    if len(values) == 6:
        if all(c == 1 for c in counts[1:]):
            combos.append({"key": "straight", "label": "Straight", "score": 1500, "count": 1})
            return {"score": 1500, "leftover": 0, "combos": combos}
        if sum(1 for c in counts[1:] if c == 3) == 2:
            combos.append(
                {"key": "two_triplets", "label": "Two triplets", "score": 2500, "count": 1}
            )
            return {"score": 2500, "leftover": 0, "combos": combos}
        if sum(1 for c in counts[1:] if c == 2) == 3:
            combos.append(
                {"key": "three_pairs", "label": "Three pairs", "score": 1500, "count": 1}
            )
            return {"score": 1500, "leftover": 0, "combos": combos}
        if 4 in counts and 2 in counts:
            combos.append(
                {
                    "key": "four_plus_pair",
                    "label": "Four of a kind + pair",
                    "score": 1500,
                    "count": 1,
                }
            )
            return {"score": 1500, "leftover": 0, "combos": combos}

    score = leftover = 0
    for face in range(1, 7):
        n = counts[face]
        if n >= 3:
            base = 1000 if face == 1 else face * 100
            piece = base * (2 ** (n - 3))
            score += piece
            key = f"{n}_of_kind_{face}"
            combos.append(
                {
                    "key": key,
                    "label": combo_label(key),
                    "score": piece,
                    "count": 1,
                }
            )
            n = 0
        if n:
            if face == 1:
                score += n * 100
                combos.append(
                    {
                        "key": "single_1",
                        "label": "Single 1" if n == 1 else f"{n} × 1",
                        "score": n * 100,
                        "count": n,
                    }
                )
            elif face == 5:
                score += n * 50
                combos.append(
                    {
                        "key": "single_5",
                        "label": "Single 5" if n == 1 else f"{n} × 5",
                        "score": n * 50,
                        "count": n,
                    }
                )
            else:
                leftover += n
    return {"score": score, "leftover": leftover, "combos": combos}


def score_values(values: list[int]) -> tuple[int, int]:
    explained = explain_score(values)
    return explained["score"], explained["leftover"]


def roll_has_score(values: list[int]) -> bool:
    counts = [0] * 7
    for v in values:
        counts[v] += 1
    if counts[1] or counts[5]:
        return True
    if any(n >= 3 for n in counts[1:]):
        return True
    if len(values) == 6:
        if all(c == 1 for c in counts[1:]):
            return True
        if sum(1 for c in counts[1:] if c == 2) == 3:
            return True
        if sum(1 for c in counts[1:] if c == 3) == 2:
            return True
    return False


def _counts(values: list[int]) -> list[int]:
    counts = [0] * 7
    for v in values:
        if 1 <= v <= 6:
            counts[v] += 1
    return counts


def best_valid_score(values: list[int]) -> tuple[int, list[int]]:
    """Highest-scoring valid lock among subsets of these dice."""
    n = len(values)
    best = 0
    best_vals: list[int] = []
    for mask in range(1, 1 << n):
        subset = [values[i] for i in range(n) if mask & (1 << i)]
        explained = explain_score(subset)
        if explained["leftover"] == 0 and explained["score"] > best:
            best = explained["score"]
            best_vals = subset
    return best, best_vals


def lock_blunder(live: list[int], selected: list[int]) -> dict | None:
    """Flag only clear lock mistakes: missed kind, left a 1, or left 100+."""
    taken_info = explain_score(selected)
    if taken_info["leftover"] != 0 or taken_info["score"] <= 0:
        return None
    taken = taken_info["score"]
    best, _ = best_valid_score(live)
    gap = best - taken
    if gap <= 0:
        return None
    live_c, sel_c = _counts(live), _counts(selected)
    missed_face = next((f for f in range(1, 7) if live_c[f] >= 3 and sel_c[f] < 3), None)
    left_a_one = live_c[1] > sel_c[1] and sel_c[1] == 0
    if not (missed_face or left_a_one or gap >= 100):
        return None
    if missed_face:
        label = f"Missed {combo_label(f'{live_c[missed_face]}_of_kind_{missed_face}')}"
    elif gap >= 500:
        label = f"Left {gap} on the table"
    elif left_a_one:
        label = "Locked a 5, left a 1"
    else:
        label = f"Left {gap} on the table"
    return {"kind": "lock", "cost": gap, "label": label}


def should_have_banked(pending: int, n_to_roll: int, hot: bool) -> bool:
    """Conservative: only 1 die with 250+ or 2 dice with 500+ pending."""
    if hot or n_to_roll <= 0 or n_to_roll >= 3:
        return False
    if n_to_roll == 1 and pending >= 250:
        return True
    if n_to_roll == 2 and pending >= 500:
        return True
    return False


class Farkle:
    def __init__(self, stats: Stats | None = None) -> None:
        self.stats = stats or Stats()
        G = self.stats.game
        self._session_counted = bool(
            G.get("rolls")
            or G.get("elapsed_ms")
            or G.get("started_at_ms")
            or G.get("points_banked")
            or G.get("rounds")
        )
        self.total = int(G.get("points_banked") or 0)
        self.rounds = int(G.get("rounds") or 0)
        self._rolls_this_turn = 0
        self._push_blunder = False
        if G.get("abandoned"):
            self.reset_turn("Abandoned.")
            self.phase = "abandoned"
        else:
            self.reset_turn("Roll to start.")

    def _ensure_started(self) -> None:
        if not self._session_counted:
            self.stats.start_game()
            self._session_counted = True

    def new_game(self) -> dict:
        if self._session_counted and self.phase not in ("won", "abandoned"):
            raise ValueError("Abandon the game first.")
        self.stats.start_game()
        self._session_counted = True
        self.total = 0
        self.rounds = 0
        self._push_blunder = False
        self.reset_turn("Roll to start.")
        return self.state()

    def abandon(self) -> dict:
        if self.phase in ("won", "abandoned"):
            raise ValueError("Game already over.")
        if not self._session_counted:
            raise ValueError("No game to abandon.")
        self.stats.record_abandon(self.total, self.rounds)
        self.phase = "abandoned"
        self.message = "Abandoned."
        self._push_blunder = False
        for d in self.dice:
            d["selected"] = False
            d["live"] = False
        return self.state()

    def arrange(self) -> dict:
        if self.stats.game.get("paused"):
            raise ValueError("Unpause to play.")
        if self.phase not in ("choose", "ready"):
            raise ValueError("Nothing to order.")
        unlocked = [d for d in self.dice if not d["locked"]]
        locked = [d for d in self.dice if d["locked"]]
        unlocked.sort(key=lambda d: d["value"])
        self.dice = unlocked + locked
        self.stats.touch()
        self.stats.save()
        return self.state()

    def pause(self) -> dict:
        if self.phase in ("won", "abandoned"):
            raise ValueError("Game is over.")
        self.stats.toggle_pause()
        return self.state()

    def reset_turn(self, message: str) -> None:
        self.dice = [
            {"value": 1, "locked": False, "selected": False, "live": False}
            for _ in range(6)
        ]
        self.turn = 0
        self.phase = "ready"
        self.message = message
        self._rolls_this_turn = 0
        self._push_blunder = False

    def _finish_round(self, message: str, win: bool = False) -> None:
        self.rounds += 1
        if win:
            self.phase = "won"
            self.turn = 0
            for d in self.dice:
                d["selected"] = False
                d["live"] = False
            noun = "round" if self.rounds == 1 else "rounds"
            self.message = f"You won in {self.rounds} {noun}."
            return
        self.reset_turn(message)

    def _selected(self) -> list[dict]:
        return [d for d in self.dice if d["selected"]]

    def selected_score(self) -> dict:
        values = [d["value"] for d in self._selected()]
        if not values:
            return {"score": 0, "valid": False, "explained": None}
        explained = explain_score(values)
        return {
            "score": explained["score"],
            "valid": explained["leftover"] == 0 and explained["score"] > 0,
            "explained": explained,
        }

    def state(self) -> dict:
        sel = self.selected_score()
        return {
            "dice": self.dice,
            "total": self.total,
            "turn": self.turn,
            "selected": sel["score"] if sel["valid"] else 0,
            "selection_valid": sel["valid"],
            "round": self.rounds,
            "target": TARGET,
            "can_roll": self.phase not in ("won", "abandoned")
            and (self.phase == "ready" or (self.phase == "choose" and sel["valid"])),
            "can_bank": self.phase == "choose" and sel["valid"],
            "phase": self.phase,
            "message": self.message,
            "elapsed_ms": self.stats.elapsed_ms(),
            "clock_running": self.stats.clock_running(),
            "paused": bool(self.stats.game.get("paused")),
            "nerve": self.stats.lifetime.get("nerve", 1000),
            "can_abandon": bool(self._session_counted and self.phase not in ("won", "abandoned")),
            "can_arrange": self.phase == "choose",
            "can_pause": self.phase not in ("won", "abandoned"),
        }

    def _record_lock(self, explained: dict | None) -> None:
        if explained and explained["score"] > 0:
            live_vals = [d["value"] for d in self.dice if d["live"] and not d["locked"]]
            sel_vals = [d["value"] for d in self._selected()]
            report = lock_blunder(live_vals, sel_vals)
            if report:
                self.stats.record_blunder(**report)
            self.stats.record_selection(explained)

    def _lock_selection(self) -> bool:
        sel = self.selected_score()
        if not sel["valid"]:
            raise ValueError("Select a scoring set first.")
        self._record_lock(sel["explained"])
        self.turn += sel["score"]
        for d in self.dice:
            if d["selected"]:
                d["locked"] = True
                d["selected"] = False
                d["live"] = False
        if all(d["locked"] for d in self.dice):
            for d in self.dice:
                d["locked"] = False
                d["live"] = False
            return True
        return False

    def roll(self, entropy: dict | None = None) -> dict:
        if self.stats.game.get("paused"):
            raise ValueError("Unpause to play.")
        if self.phase in ("won", "abandoned"):
            raise ValueError("Game over.")
        self._ensure_started()
        engine.stir_stats(self.stats)
        engine.stir_client(entropy)
        hot = False
        push = self.phase == "choose"
        first_roll = self._rolls_this_turn == 0
        if self.phase == "choose":
            hot = self._lock_selection()
            pending = self.turn
            n_to_roll = 6 if hot else sum(1 for d in self.dice if not d["locked"])
            self._push_blunder = False
            if should_have_banked(pending, n_to_roll, hot):
                noun = "die" if n_to_roll == 1 else "dice"
                self.stats.record_blunder(
                    kind="push",
                    cost=pending,
                    label=f"Rolled {n_to_roll} {noun} with {pending} pending",
                )
                self._push_blunder = True
        elif self.phase != "ready":
            raise ValueError("Cannot roll now.")

        rolled = [i for i, d in enumerate(self.dice) if not d["locked"]]
        if not rolled:
            raise ValueError("No dice to roll.")

        values = []
        for i in rolled:
            value = engine.die()
            die = self.dice[i]
            die["value"] = value
            die["selected"] = False
            die["live"] = True
            values.append(value)

        hot_note = self.stats.record_hot(full_six=True) if hot else None
        self.stats.record_roll(values, push=push, hot=hot)
        rolled_values = [self.dice[i]["value"] for i in rolled]
        push_blunder = self._push_blunder
        if not roll_has_score(rolled_values):
            lost = self.turn
            self.turn = 0
            for d in self.dice:
                d["selected"] = False
                d["live"] = False
                d["locked"] = False
            self.stats.record_farkle(
                lost,
                dice_count=len(rolled),
                first_roll=first_roll,
                push_blunder=push_blunder,
            )
            self._finish_round("Farkle — turn score lost.")
        else:
            self._rolls_this_turn += 1
            self.stats.record_success_roll()
            self.stats.save()
            self.phase = "choose"
            self.message = (
                "Hot dice — rolling all six." if hot else "Select scoring dice, then roll or bank."
            )

        out = self.state()
        out["rolled"] = rolled
        out["values"] = values
        out["hot"] = hot
        out["hot_note"] = hot_note
        return out

    def toggle(self, index: int) -> dict:
        if self.stats.game.get("paused"):
            raise ValueError("Unpause to play.")
        if self.phase in ("won", "abandoned"):
            raise ValueError("Game over.")
        if self.phase != "choose":
            raise ValueError("Nothing to select.")
        if index < 0 or index >= 6:
            raise ValueError("Invalid die.")
        die = self.dice[index]
        if not die["live"] or die["locked"]:
            raise ValueError("That die cannot be selected.")
        die["selected"] = not die["selected"]
        sel = self.selected_score()
        if sel["valid"]:
            self.message = "Roll remaining dice, or bank."
        elif not self._selected():
            self.message = "Select scoring dice, then roll or bank."
        else:
            self.message = "Not a scoring set."
        self.stats.touch()
        self.stats.save()
        return self.state()

    def bank(self) -> dict:
        if self.stats.game.get("paused"):
            raise ValueError("Unpause to play.")
        if self.phase in ("won", "abandoned"):
            raise ValueError("Game over.")
        sel = self.selected_score()
        if self.phase != "choose" or not sel["valid"]:
            raise ValueError("Bank a valid scoring set.")
        live_n = sum(1 for d in self.dice if d["live"] and not d["locked"])
        remaining = sum(1 for d in self.dice if not d["locked"] and not d["selected"])
        hot = remaining == 0
        self._record_lock(sel["explained"])
        banked = self.turn + sel["score"]
        self.total += banked
        hot_note = self.stats.record_hot(full_six=live_n == 6) if hot else None
        self.stats.record_bank(banked, remaining, hot=hot)
        won = self.total >= TARGET
        if won:
            self._finish_round("You won.", win=True)
            if hot:
                self.message = (
                    f"Hot dice — you won in {self.rounds} "
                    f"{'round' if self.rounds == 1 else 'rounds'}."
                )
            self.stats.record_win(self.rounds, self.total, TARGET)
        elif hot:
            self._finish_round("Hot dice — all scored. Roll to start a new turn.")
        else:
            self._finish_round("Banked. Roll to start a new turn.")
        out = self.state()
        out["hot"] = hot
        out["hot_note"] = hot_note
        return out
