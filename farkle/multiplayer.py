"""In-memory multiplayer lobby and turn-based matches."""

from __future__ import annotations

import secrets
import threading
import time

from .entropy import engine
from .game import choose_prompt, explain_score, hot_ready, roll_has_score

MODES = {
    "standard": {"label": "Standard", "target": 10000, "forfeit_sec": 45},
    "blitz": {"label": "Blitz", "target": 5000, "forfeit_sec": 0},
}
SEATS = (2, 3, 4, 5, 6)
FORFEIT_CHOICES = (15, 20, 30, 45, 60, 90, 120)
CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
MAX_NAME = 20
FARKLE_HOLD_MS = 3200


def now_ms() -> int:
    return int(time.time() * 1000)


def _blank_dice() -> list[dict]:
    return [
        {"value": 1, "locked": False, "selected": False, "live": False}
        for _ in range(6)
    ]


def _clean_name(raw: object) -> str:
    name = " ".join(str(raw or "").split())[:MAX_NAME]
    return name or "Player"


def _clean_id(raw: object) -> str:
    pid = str(raw or "").strip()[:64]
    if not pid:
        raise ValueError("Missing player.")
    return pid


class Match:
    def __init__(
        self,
        *,
        host_id: str,
        host_name: str,
        mode: str,
        seats: int,
        forfeit_sec: int,
    ) -> None:
        self.id = "".join(secrets.choice(CODE_CHARS) for _ in range(4))
        self.host_id = host_id
        self.mode = mode if mode in MODES else "standard"
        spec = MODES[self.mode]
        if self.mode == "blitz":
            self.seats = 2
            self.forfeit_sec = 0
        else:
            self.seats = seats if seats in SEATS else 2
            self.forfeit_sec = forfeit_sec if forfeit_sec in FORFEIT_CHOICES else spec["forfeit_sec"]
        self.target = spec["target"]
        self.status = "lobby"
        self.message = "Waiting in the lobby."
        self.players: list[dict] = [
            self._new_player(host_id, host_name),
        ]
        self.turn_index = 0
        self.deadline_ms = 0
        self.hold_until_ms = 0
        self.hold_kind = ""
        self.roll_seq = 0
        self.roll_event: dict | None = None
        self.roll_events: dict[str, dict] = {}
        self.winner_id = ""
        self.started_ms = 0
        self.ended_ms = 0
        self.end_reason = ""
        self.turn_count = 0

    def _new_player(self, pid: str, name: str) -> dict:
        return {
            "id": pid,
            "name": _clean_name(name),
            "ready": False,
            "active": True,
            "total": 0,
            "turn": 0,
            "phase": "ready",
            "dice": _blank_dice(),
            "message": "Waiting for players.",
            "banks": 0,
            "farkles": 0,
            "timeouts": 0,
            "rolls": 0,
            "best_bank": 0,
            "turns": 0,
            "hold_until_ms": 0,
        }

    def _player(self, pid: str) -> dict:
        for row in self.players:
            if row["id"] == pid:
                return row
        raise ValueError("You are not in this game.")

    def _alive(self) -> list[dict]:
        return [row for row in self.players if row.get("active")]

    @property
    def simultaneous(self) -> bool:
        return self.mode == "blitz"

    def _acting(self, pid: str) -> dict:
        player = self._player(pid)
        if self.status != "playing" or not player.get("active"):
            raise ValueError("Game is not in play.")
        if not self.simultaneous and self.current()["id"] != pid:
            raise ValueError("It is not your turn.")
        return player

    def current(self) -> dict:
        alive = self._alive()
        if not alive:
            raise ValueError("No players left.")
        self.turn_index %= len(alive)
        return alive[self.turn_index]

    def _selected_score(self, player: dict) -> dict:
        values = [d["value"] for d in player["dice"] if d["selected"]]
        if not values:
            return {"score": 0, "valid": False}
        explained = explain_score(values)
        return {
            "score": explained["score"],
            "valid": explained["leftover"] == 0 and explained["score"] > 0,
        }

    def join(self, pid: str, name: str) -> None:
        if self.status != "lobby":
            raise ValueError("That game already started.")
        try:
            self._player(pid)
            return
        except ValueError:
            pass
        if len(self.players) >= self.seats:
            raise ValueError("That lobby is full.")
        self.players.append(self._new_player(pid, name))

    def leave(self, pid: str) -> None:
        player = self._player(pid)
        if self.status == "lobby":
            self.players = [row for row in self.players if row["id"] != pid]
            if self.players and self.host_id == pid:
                self.host_id = self.players[0]["id"]
            return
        player["active"] = False
        player["ready"] = False
        if self.status == "finished":
            self.players = [row for row in self.players if row["id"] != pid]
            return
        if self.status == "playing" and not self.simultaneous and self._alive() and self.current()["id"] == pid:
            self._next_turn("Left the table.")
        if len(self._alive()) == 1 and self.status == "playing":
            winner = self._alive()[0]
            self._finish(winner, f"{winner['name']} wins — everyone else left.", "left")

    def set_ready(self, pid: str, ready: bool) -> None:
        if self.status != "lobby":
            raise ValueError("The match already started.")
        player = self._player(pid)
        player["ready"] = bool(ready)
        if (
            len(self.players) >= 2
            and len(self.players) == self.seats
            and all(row["ready"] for row in self.players)
        ):
            self._begin()

    def _begin(self) -> None:
        self.status = "playing"
        self.winner_id = ""
        self.end_reason = ""
        self.ended_ms = 0
        self.started_ms = now_ms()
        self.turn_count = 0
        self.turn_index = 0
        for row in self.players:
            row["total"] = 0
            row["dice"] = _blank_dice()
            row["turn"] = 0
            row["phase"] = "ready"
            row["message"] = "Waiting for your turn."
            row["banks"] = 0
            row["farkles"] = 0
            row["timeouts"] = 0
            row["rolls"] = 0
            row["best_bank"] = 0
            row["turns"] = 0
            row["hold_until_ms"] = 0
        if self.simultaneous:
            for row in self.players:
                row["phase"] = "ready"
                row["message"] = "Race to the goal — roll."
                row["turns"] = 1
            self.turn_count = 1
            self.message = f"Race to {self.target:,}."
            self.deadline_ms = 0
            return
        self._start_turn("Game on — roll.")

    def _start_turn(self, message: str) -> None:
        player = self.current()
        player["dice"] = _blank_dice()
        player["turn"] = 0
        player["phase"] = "ready"
        player["message"] = message
        player["turns"] = int(player.get("turns") or 0) + 1
        self.turn_count += 1
        self.deadline_ms = now_ms() + self.forfeit_sec * 1000
        self.message = f"{player['name']}'s turn."

    def _next_turn(self, message: str) -> None:
        alive = self._alive()
        if len(alive) < 2:
            if alive:
                self._finish(alive[0], f"{alive[0]['name']} wins.", "left")
            else:
                self.status = "finished"
                self.message = "Game over."
            return
        cur = self.current()
        cur["phase"] = "ready"
        cur["turn"] = 0
        cur["message"] = "Waiting for your turn."
        self.turn_index = (self.turn_index + 1) % len(alive)
        self._start_turn(message)

    def _begin_hold(self, player: dict, kind: str, message: str) -> None:
        player["phase"] = "hold"
        player["message"] = message
        wait = 900 if self.simultaneous else FARKLE_HOLD_MS
        player["hold_until_ms"] = now_ms() + wait
        if self.simultaneous:
            return
        self.message = message
        self.hold_kind = kind
        self.hold_until_ms = player["hold_until_ms"]
        self.deadline_ms = 0

    def check_hold(self) -> None:
        now = now_ms()
        if self.simultaneous:
            for row in self.players:
                until = int(row.get("hold_until_ms") or 0)
                if until and now >= until:
                    row["hold_until_ms"] = 0
                    if row["phase"] == "hold":
                        row["phase"] = "ready"
                        row["message"] = "Farkled — roll again."
            return
        if self.status != "playing" or not self.hold_until_ms:
            return
        if now < self.hold_until_ms:
            return
        self.hold_until_ms = 0
        kind = self.hold_kind
        self.hold_kind = ""
        if kind == "farkle":
            self._next_turn(self.message)

    def _finish(self, winner: dict, message: str, reason: str = "target") -> None:
        self.status = "finished"
        self.winner_id = winner["id"]
        self.end_reason = reason
        self.ended_ms = now_ms()
        self.deadline_ms = 0
        self.hold_until_ms = 0
        self.hold_kind = ""
        self.message = message
        winner["phase"] = "won"
        winner["message"] = message
        for row in self.players:
            if row["id"] != winner["id"]:
                row["phase"] = "lost"
                row["message"] = message

    def _lock_selection(self, player: dict) -> bool:
        sel = self._selected_score(player)
        if not sel["valid"]:
            raise ValueError("Select a scoring set first.")
        player["turn"] += sel["score"]
        for die in player["dice"]:
            if die["selected"]:
                die["locked"] = True
                die["selected"] = False
                die["live"] = False
        if all(die["locked"] for die in player["dice"]):
            for die in player["dice"]:
                die["locked"] = False
                die["live"] = False
            return True
        return False

    def check_forfeit(self) -> None:
        self.check_hold()
        if self.hold_until_ms or self.simultaneous:
            return
        if self.status != "playing" or self.deadline_ms <= 0:
            return
        if now_ms() < self.deadline_ms:
            return
        player = self.current()
        lost = int(player.get("turn") or 0)
        player["turn"] = 0
        player["timeouts"] = int(player.get("timeouts") or 0) + 1
        self._next_turn(f"{player['name']} ran out of time — {lost} lost.")

    def roll(self, pid: str, entropy: dict | None = None) -> dict:
        self.check_forfeit()
        player = self._acting(pid)
        engine.stir_client(entropy)
        hot = False
        if player["phase"] == "choose":
            hot = self._lock_selection(player)
        elif player["phase"] != "ready":
            raise ValueError("Cannot roll now.")
        rolled = [i for i, die in enumerate(player["dice"]) if not die["locked"]]
        if not rolled:
            raise ValueError("No dice to roll.")
        values = []
        for i in rolled:
            value = engine.die()
            die = player["dice"][i]
            die["value"] = value
            die["selected"] = False
            die["live"] = True
            values.append(value)
        self.roll_seq += 1
        event = {"player_id": pid, "rolled": rolled, "values": values, "seq": self.roll_seq}
        self.roll_event = event
        self.roll_events[pid] = event
        player["rolls"] = int(player.get("rolls") or 0) + 1
        if not roll_has_score(values):
            lost = player["turn"]
            player["turn"] = 0
            player["farkles"] = int(player.get("farkles") or 0) + 1
            event["farkle"] = True
            self._begin_hold(player, "farkle", f"{player['name']} farkled — {lost} lost.")
            out = self.snapshot(pid)
            out["rolled"] = rolled
            out["values"] = values
            out["farkle"] = True
            return out
        player["phase"] = "choose"
        player["message"] = "Hot dice — rolling all six." if hot else "Select scoring dice, then roll or bank."
        out = self.snapshot(pid)
        out["rolled"] = rolled
        out["values"] = values
        out["hot"] = hot
        return out

    def toggle(self, pid: str, index: int) -> dict:
        self.check_forfeit()
        player = self._acting(pid)
        if player["phase"] != "choose":
            raise ValueError("Nothing to select.")
        if index < 0 or index >= 6:
            raise ValueError("Invalid die.")
        die = player["dice"][index]
        if not die["live"] or die["locked"]:
            raise ValueError("That die cannot be selected.")
        die["selected"] = not die["selected"]
        sel = self._selected_score(player)
        player["message"] = choose_prompt(
            player["dice"],
            valid=sel["valid"],
            has_selected=any(d["selected"] for d in player["dice"]),
        )
        return self.snapshot(pid)

    def bank(self, pid: str) -> dict:
        self.check_forfeit()
        player = self._acting(pid)
        sel = self._selected_score(player)
        if player["phase"] != "choose" or not sel["valid"]:
            raise ValueError("Bank a valid scoring set.")
        remaining = sum(1 for die in player["dice"] if not die["locked"] and not die["selected"])
        player["turn"] += sel["score"]
        banked = player["turn"]
        player["total"] += banked
        player["turn"] = 0
        player["banks"] = int(player.get("banks") or 0) + 1
        player["best_bank"] = max(int(player.get("best_bank") or 0), banked)
        if player["total"] >= self.target:
            self._finish(player, f"{player['name']} wins with {player['total']:,}.", "target")
            return self.snapshot(pid)
        if self.simultaneous:
            player["dice"] = _blank_dice()
            player["phase"] = "ready"
            player["turns"] = int(player.get("turns") or 0) + 1
            self.turn_count += 1
            player["message"] = f"Banked {banked:,} — keep rolling."
            return self.snapshot(pid)
        if remaining == 0:
            self._next_turn(f"{player['name']} banked {banked:,} on hot dice.")
        else:
            self._next_turn(f"{player['name']} banked {banked:,}.")
        return self.snapshot(pid)

    def arrange(self, pid: str) -> dict:
        self.check_forfeit()
        player = self._acting(pid)
        unlocked = [d for d in player["dice"] if not d["locked"]]
        locked = [d for d in player["dice"] if d["locked"]]
        unlocked.sort(key=lambda d: d["value"])
        player["dice"] = unlocked + locked
        return self.snapshot(pid)

    def recap(self, pid: str) -> dict:
        winner = next((row for row in self.players if row["id"] == self.winner_id), None)
        elapsed = 0
        if self.started_ms:
            end = self.ended_ms or now_ms()
            elapsed = max(0, end - self.started_ms)
        standings = sorted(self.players, key=lambda row: (-int(row.get("total") or 0), row["name"]))
        return {
            "winner_id": self.winner_id,
            "winner_name": winner["name"] if winner else "",
            "winner_total": int(winner["total"]) if winner else 0,
            "you_won": pid == self.winner_id,
            "reason": self.end_reason or "target",
            "mode": self.mode,
            "mode_label": MODES[self.mode]["label"],
            "target": self.target,
            "elapsed_ms": elapsed,
            "turns": self.turn_count,
            "standings": [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "total": int(row.get("total") or 0),
                    "banks": int(row.get("banks") or 0),
                    "farkles": int(row.get("farkles") or 0),
                    "timeouts": int(row.get("timeouts") or 0),
                    "rolls": int(row.get("rolls") or 0),
                    "best_bank": int(row.get("best_bank") or 0),
                    "is_you": row["id"] == pid,
                    "winner": row["id"] == self.winner_id,
                }
                for row in standings
            ],
        }

    def snapshot(self, pid: str) -> dict:
        self.check_forfeit()
        you = self._player(pid)
        yours = (
            self.status == "playing"
            and you.get("active")
            and (self.simultaneous or self.current()["id"] == pid)
        )
        sel = self._selected_score(you) if yours else {"score": 0, "valid": False}
        remain = 0 if self.simultaneous else (max(0, self.deadline_ms - now_ms()) if self.status == "playing" else 0)
        rivals = []
        for row in self.players:
            if row["id"] == pid:
                continue
            rivals.append(
                {
                    "id": row["id"],
                    "name": row["name"],
                    "total": row["total"],
                    "turn": row["turn"],
                    "active": row["active"],
                    "is_turn": self.status == "playing"
                    and (
                        self.simultaneous
                        or self.current()["id"] == row["id"]
                    ),
                    "phase": row["phase"],
                    "dice": row["dice"],
                    "last_roll": self.roll_events.get(row["id"]),
                }
            )
        return {
            "multiplayer": True,
            "room": self.id,
            "status": self.status,
            "mode": self.mode,
            "mode_label": MODES[self.mode]["label"],
            "simultaneous": self.simultaneous,
            "seats": self.seats,
            "forfeit_sec": self.forfeit_sec,
            "target": self.target,
            "host_id": self.host_id,
            "message": you["message"] if yours or self.status != "playing" else self.message,
            "table_message": self.message,
            "turn_remaining_ms": remain,
            "hold": you["phase"] == "hold" or (not self.simultaneous and bool(self.hold_until_ms)),
            "roll_seq": self.roll_seq,
            "roll_event": self.roll_event,
            "winner_id": self.winner_id,
            "recap": self.recap(pid) if self.status == "finished" else None,
            "you": {
                "id": you["id"],
                "name": you["name"],
                "ready": you["ready"],
                "is_host": you["id"] == self.host_id,
                "is_turn": yours,
            },
            "players": [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "ready": row["ready"],
                    "active": row["active"],
                    "total": row["total"],
                    "is_host": row["id"] == self.host_id,
                    "is_turn": self.status == "playing"
                    and (
                        self.simultaneous
                        or self.current()["id"] == row["id"]
                    ),
                    "is_you": row["id"] == pid,
                }
                for row in self.players
            ],
            "rivals": rivals,
            "dice": you["dice"],
            "total": you["total"],
            "turn": you["turn"],
            "selected": sel["score"] if sel["valid"] else 0,
            "selection_valid": sel["valid"],
            "round": 0,
            "phase": you["phase"],
            "paused": False,
            "can_roll": yours
            and you["phase"] in ("ready", "choose")
            and (you["phase"] == "ready" or sel["valid"]),
            "can_bank": yours and you["phase"] == "choose" and sel["valid"],
            "hot_ready": yours and hot_ready(you["dice"], phase=you["phase"], valid=sel["valid"]),
            "can_arrange": yours and you["phase"] == "choose",
            "can_abandon": self.status in ("lobby", "playing"),
            "can_pause": False,
            "clock_running": False,
            "elapsed_ms": remain,
        }

    def lobby_row(self) -> dict:
        return {
            "id": self.id,
            "mode": self.mode,
            "mode_label": MODES[self.mode]["label"],
            "seats": self.seats,
            "taken": len(self.players),
            "forfeit_sec": self.forfeit_sec,
            "host": next((row["name"] for row in self.players if row["id"] == self.host_id), "Host"),
            "simultaneous": self.simultaneous,
            "status": self.status,
        }


class Lobby:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._rooms: dict[str, Match] = {}

    def _purge(self) -> None:
        drop = [code for code, room in self._rooms.items() if not room.players]
        for code in drop:
            self._rooms.pop(code, None)

    def list_rooms(self) -> dict:
        with self._lock:
            self._purge()
            rooms = [room.lobby_row() for room in self._rooms.values() if room.status == "lobby"]
            return {"rooms": rooms, "modes": [
                {"id": key, "label": spec["label"], "target": spec["target"], "forfeit_sec": spec["forfeit_sec"]}
                for key, spec in MODES.items()
            ]}

    def create(self, body: dict) -> dict:
        pid = _clean_id(body.get("player"))
        mode = str(body.get("mode") or "standard")
        seats = int(body.get("seats") or 2)
        forfeit = int(body.get("forfeit_sec") or MODES.get(mode, MODES["standard"])["forfeit_sec"])
        with self._lock:
            self._purge()
            room = Match(
                host_id=pid,
                host_name=_clean_name(body.get("name")),
                mode=mode,
                seats=seats,
                forfeit_sec=forfeit,
            )
            self._rooms[room.id] = room
            return room.snapshot(pid)

    def _room(self, code: object) -> Match:
        room = self._rooms.get(str(code or "").strip().upper())
        if not room:
            raise ValueError("No game with that code.")
        return room

    def join(self, body: dict) -> dict:
        pid = _clean_id(body.get("player"))
        with self._lock:
            room = self._room(body.get("room"))
            room.join(pid, _clean_name(body.get("name")))
            return room.snapshot(pid)

    def leave(self, body: dict) -> dict:
        pid = _clean_id(body.get("player"))
        with self._lock:
            room = self._room(body.get("room"))
            room.leave(pid)
            if not room.players:
                self._rooms.pop(room.id, None)
            return {"ok": True}

    def ready(self, body: dict) -> dict:
        pid = _clean_id(body.get("player"))
        with self._lock:
            room = self._room(body.get("room"))
            room.set_ready(pid, bool(body.get("ready", True)))
            return room.snapshot(pid)

    def state(self, body: dict) -> dict:
        pid = _clean_id(body.get("player"))
        with self._lock:
            room = self._room(body.get("room"))
            room._player(pid)
            return room.snapshot(pid)

    def roll(self, body: dict) -> dict:
        pid = _clean_id(body.get("player"))
        with self._lock:
            return self._room(body.get("room")).roll(pid, body.get("entropy"))

    def toggle(self, body: dict) -> dict:
        pid = _clean_id(body.get("player"))
        with self._lock:
            return self._room(body.get("room")).toggle(pid, int(body.get("index", -1)))

    def bank(self, body: dict) -> dict:
        pid = _clean_id(body.get("player"))
        with self._lock:
            return self._room(body.get("room")).bank(pid)

    def arrange(self, body: dict) -> dict:
        pid = _clean_id(body.get("player"))
        with self._lock:
            return self._room(body.get("room")).arrange(pid)


lobby = Lobby()
