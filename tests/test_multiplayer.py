"""Multiplayer lobby create/join/ready and a short match."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from farkle.multiplayer import Lobby


def test_create_join_ready_starts() -> None:
    lobby = Lobby()
    host = lobby.create({"player": "h1", "name": "Host", "mode": "blitz", "seats": 2, "forfeit_sec": 20})
    assert host["status"] == "lobby"
    assert host["mode"] == "blitz"
    assert host["target"] == 5000
    code = host["room"]
    listed = lobby.list_rooms()["rooms"]
    assert any(row["id"] == code for row in listed)
    guest = lobby.join({"player": "g1", "name": "Guest", "room": code})
    assert len(guest["players"]) == 2
    lobby.ready({"player": "h1", "room": code, "ready": True})
    playing = lobby.ready({"player": "g1", "room": code, "ready": True})
    assert playing["status"] == "playing"
    assert playing["simultaneous"] is True
    assert playing["you"]["is_turn"] is True
    assert playing["seats"] == 2
    assert playing["forfeit_sec"] == 0
    assert playing["turn_remaining_ms"] == 0
    assert lobby.list_rooms()["rooms"] == []


def test_blitz_both_can_roll() -> None:
    lobby = Lobby()
    host = lobby.create({"player": "h1", "name": "Host", "mode": "blitz", "seats": 6, "forfeit_sec": 45})
    assert host["seats"] == 2
    assert host["forfeit_sec"] == 0
    assert host["simultaneous"] is True
    code = host["room"]
    lobby.join({"player": "g1", "name": "Guest", "room": code})
    lobby.ready({"player": "h1", "room": code, "ready": True})
    playing = lobby.ready({"player": "g1", "room": code, "ready": True})
    assert playing["status"] == "playing"
    assert all(row["is_turn"] for row in playing["players"])
    host_roll = lobby.roll({"player": "h1", "room": code})
    guest_roll = lobby.roll({"player": "g1", "room": code})
    assert "rolled" in host_roll
    assert "rolled" in guest_roll
    room = lobby._rooms[code]
    host_p = room._player("h1")
    host_p["phase"] = "choose"
    host_p["dice"] = [
        {"value": 1, "locked": False, "selected": True, "live": True},
        {"value": 2, "locked": False, "selected": False, "live": True},
        {"value": 3, "locked": False, "selected": False, "live": True},
        {"value": 4, "locked": False, "selected": False, "live": True},
        {"value": 6, "locked": False, "selected": False, "live": True},
        {"value": 2, "locked": False, "selected": False, "live": True},
    ]
    banked = lobby.bank({"player": "h1", "room": code})
    assert banked["total"] == 100
    assert banked["phase"] == "ready"
    assert banked["you"]["is_turn"] is True
    guest = lobby.state({"player": "g1", "room": code})
    assert guest["you"]["is_turn"] is True
    assert guest["rivals"][0]["total"] == 100
    assert guest["turn_remaining_ms"] == 0
    room.deadline_ms = 1
    still = lobby.state({"player": "g1", "room": code})
    assert still["you"]["is_turn"] is True
    assert still["status"] == "playing"


def test_turn_bank_and_forfeit_skip() -> None:
    lobby = Lobby()
    host = lobby.create({"player": "h1", "name": "Host", "mode": "standard", "seats": 2, "forfeit_sec": 15})
    code = host["room"]
    lobby.join({"player": "g1", "name": "Guest", "room": code})
    lobby.ready({"player": "h1", "room": code, "ready": True})
    state = lobby.ready({"player": "g1", "room": code, "ready": True})
    turn_id = next(row["id"] for row in state["players"] if row["is_turn"])
    other = "g1" if turn_id == "h1" else "h1"
    try:
        lobby.roll({"player": other, "room": code})
        raise AssertionError("other player rolled")
    except ValueError:
        pass
    rolled = lobby.roll({"player": turn_id, "room": code})
    assert "rolled" in rolled
    room = lobby._rooms[code]
    room.deadline_ms = 1
    skipped = lobby.state({"player": other, "room": code})
    assert skipped["players"]
    now_turn = next(row["id"] for row in skipped["players"] if row["is_turn"])
    assert now_turn == other


def test_farkle_holds_dice_then_passes() -> None:
    from farkle.entropy import engine

    lobby = Lobby()
    host = lobby.create({"player": "h1", "name": "Host", "mode": "standard", "seats": 2, "forfeit_sec": 45})
    code = host["room"]
    lobby.join({"player": "g1", "name": "Guest", "room": code})
    lobby.ready({"player": "h1", "room": code, "ready": True})
    state = lobby.ready({"player": "g1", "room": code, "ready": True})
    turn_id = next(row["id"] for row in state["players"] if row["is_turn"])
    other = "g1" if turn_id == "h1" else "h1"
    faces = [2, 3, 4, 6, 2, 3]
    seq = iter(faces)
    original = engine.die
    engine.die = lambda: next(seq)
    try:
        rolled = lobby.roll({"player": turn_id, "room": code})
    finally:
        engine.die = original
    assert rolled.get("farkle") is True
    assert rolled["phase"] == "hold"
    assert rolled["you"]["is_turn"] is True
    assert [die["value"] for die in rolled["dice"]] == faces
    watching = lobby.state({"player": other, "room": code})
    rival = watching["rivals"][0]
    assert [die["value"] for die in rival["dice"]] == faces
    assert rival["phase"] == "hold"
    room = lobby._rooms[code]
    room.hold_until_ms = 1
    after = lobby.state({"player": other, "room": code})
    assert after["you"]["is_turn"] is True
    leftover = after["rivals"][0]
    assert [die["value"] for die in leftover["dice"]] == faces


def test_recap_after_finish() -> None:
    lobby = Lobby()
    host = lobby.create({"player": "h1", "name": "Host", "mode": "blitz", "seats": 2, "forfeit_sec": 20})
    code = host["room"]
    lobby.join({"player": "g1", "name": "Guest", "room": code})
    lobby.ready({"player": "h1", "room": code, "ready": True})
    lobby.ready({"player": "g1", "room": code, "ready": True})
    room = lobby._rooms[code]
    host_p = room._player("h1")
    host_p["total"] = 5000
    host_p["banks"] = 3
    host_p["best_bank"] = 1200
    room._player("g1")["farkles"] = 2
    room._finish(host_p, "Host wins with 5,000.", "target")
    snap = lobby.state({"player": "g1", "room": code})
    recap = snap["recap"]
    assert snap["status"] == "finished"
    assert recap["you_won"] is False
    assert recap["winner_name"] == "Host"
    assert recap["winner_total"] == 5000
    assert recap["mode_label"] == "Blitz"
    assert recap["standings"][0]["winner"] is True
    assert recap["standings"][1]["is_you"] is True
    assert recap["standings"][1]["farkles"] == 2


def test_hot_ready_offers_all_six() -> None:
    lobby = Lobby()
    host = lobby.create({"player": "h1", "name": "Host", "mode": "standard", "seats": 2, "forfeit_sec": 45})
    code = host["room"]
    lobby.join({"player": "g1", "name": "Guest", "room": code})
    lobby.ready({"player": "h1", "room": code, "ready": True})
    state = lobby.ready({"player": "g1", "room": code, "ready": True})
    turn_id = next(row["id"] for row in state["players"] if row["is_turn"])
    room = lobby._rooms[code]
    player = room._player(turn_id)
    player["phase"] = "choose"
    player["dice"] = [
        {"value": 2, "locked": True, "selected": False, "live": False},
        {"value": 2, "locked": True, "selected": False, "live": False},
        {"value": 2, "locked": True, "selected": False, "live": False},
        {"value": 3, "locked": True, "selected": False, "live": False},
        {"value": 4, "locked": True, "selected": False, "live": False},
        {"value": 1, "locked": False, "selected": False, "live": True},
    ]
    picked = lobby.toggle({"player": turn_id, "room": code, "index": 5})
    assert picked["hot_ready"] is True
    assert picked["can_roll"] is True
    assert "roll all six" in picked["message"].lower()
    dropped = lobby.toggle({"player": turn_id, "room": code, "index": 5})
    assert dropped["hot_ready"] is False


if __name__ == "__main__":
    test_create_join_ready_starts()
    test_blitz_both_can_roll()
    test_turn_bank_and_forfeit_skip()
    test_farkle_holds_dice_then_passes()
    test_recap_after_finish()
    test_hot_ready_offers_all_six()
    print("multiplayer tests ok")
