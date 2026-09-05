"""Store purchases and sticker wear."""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from farkle.stats import Stats
from farkle.store import wear_for_games


def test_wear_steps() -> None:
    assert wear_for_games(0)["key"] == "pristine"
    assert wear_for_games(9)["key"] == "pristine"
    assert wear_for_games(10)["key"] == "light_wear"
    assert wear_for_games(24)["key"] == "light_wear"
    assert wear_for_games(25)["key"] == "medium_wear"
    assert wear_for_games(45)["key"] == "heavy_wear"
    assert wear_for_games(70)["key"] == "extreme_wear"


def test_buy_moves_wallet_into_decorations() -> None:
    path = Path(tempfile.mkdtemp()) / "stats.json"
    path.write_text(json.dumps({"lifetime": {"wallet": 25000}, "game": {}}), encoding="utf-8")
    st = Stats(path)
    out = st.buy("fark_around")
    assert st.lifetime["wallet"] == 15000
    assert out["items"][0]["owned"] is True
    bag = st.decorations_snapshot()["items"]
    assert len(bag) == 1
    assert bag[0]["id"] == "fark_around"
    assert bag[0]["wear"] == "pristine"


def test_cannot_buy_twice_or_without_funds() -> None:
    path = Path(tempfile.mkdtemp()) / "stats.json"
    path.write_text(json.dumps({"lifetime": {"wallet": 10000}, "game": {}}), encoding="utf-8")
    st = Stats(path)
    st.buy("roll_responsibly")
    try:
        st.buy("roll_responsibly")
        raise AssertionError("duplicate buy")
    except ValueError:
        pass
    try:
        st.buy("fark_around")
        raise AssertionError("unaffordable buy")
    except ValueError:
        pass


def test_place_and_remove_worn() -> None:
    path = Path(tempfile.mkdtemp()) / "stats.json"
    path.write_text(json.dumps({"lifetime": {"wallet": 20000}, "game": {}}), encoding="utf-8")
    st = Stats(path)
    st.buy("fark_around")
    placed = st.place_sticker("fark_around", 0.4, 0.3, 0.8, 45)
    row = placed["items"][0]
    assert row["placed"] is True
    assert row["can_edit"] is True
    assert abs(row["x"] - 0.4) < 1e-9
    st.lifetime["decorations"][0]["games"] = 10
    try:
        st.place_sticker("fark_around", 0.5, 0.5, 1, 0)
        raise AssertionError("moved worn sticker")
    except ValueError:
        pass
    gone = st.remove_sticker("fark_around")
    assert gone["items"] == []
    assert st.store_snapshot()["items"][0]["owned"] is False


if __name__ == "__main__":
    test_wear_steps()
    test_buy_moves_wallet_into_decorations()
    test_cannot_buy_twice_or_without_funds()
    test_place_and_remove_worn()
    print("store tests ok")
