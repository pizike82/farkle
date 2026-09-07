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
from farkle.store import CATALOG, CATALOG_BY_ID, RESIDUE_FILES, residue_rotation, residue_scale, wear_for_games


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
    marks = [row for row in gone["stickers"] if row.get("kind") == "residue"]
    assert len(marks) == 1
    assert marks[0]["scale"] < 0.8
    assert "sticker_residue/large/large_residue.png" in marks[0]["image"].replace("\\", "/")
    assert abs(marks[0]["x"] - 0.4) < 1e-9
    assert abs(marks[0]["rotation"] - 135) < 1e-9
    assert st.store_snapshot()["items"][0]["owned"] is False
    leftover = st.remove_residue(marks[0]["id"])
    assert leftover["stickers"] == []


def test_residue_never_sold() -> None:
    path = Path(tempfile.mkdtemp()) / "stats.json"
    path.write_text(json.dumps({"lifetime": {"wallet": 999999}, "game": {}}), encoding="utf-8")
    st = Stats(path)
    shop = st.store_snapshot()["items"]
    assert all(row["kind"] == "sticker" for row in shop)
    assert all("sticker_residue" not in row["image"] for row in shop)
    assert {row["id"] for row in shop} == {spec["id"] for spec in CATALOG}
    for spec in CATALOG:
        assert spec["residue"] in RESIDUE_FILES
        assert (ROOT / "web" / RESIDUE_FILES[spec["residue"]]).is_file()
    try:
        st.buy("large_residue")
        raise AssertionError("sold residue")
    except ValueError as err:
        assert "not for sale" in str(err).lower()
    for scale in (0.55, 0.8, 1.0):
        assert residue_scale(scale) < scale
    assert residue_rotation(0, CATALOG_BY_ID["fark_around"]) == 90
    assert residue_rotation(45, CATALOG_BY_ID["fark_around"]) == 135
    assert residue_rotation(0, CATALOG_BY_ID["one_more_role"]) == 0
    assert residue_rotation(0, CATALOG_BY_ID["roll_responsibly"]) == 0
    assert residue_rotation(0, CATALOG_BY_ID["124_die"]) == 0


def test_remove_pristine() -> None:
    path = Path(tempfile.mkdtemp()) / "stats.json"
    path.write_text(json.dumps({"lifetime": {"wallet": 20000}, "game": {}}), encoding="utf-8")
    st = Stats(path)
    st.buy("roll_responsibly")
    st.remove_sticker("roll_responsibly")
    assert st.lifetime["decorations"] == []
    assert st.lifetime.get("residues") == []


if __name__ == "__main__":
    test_wear_steps()
    test_buy_moves_wallet_into_decorations()
    test_cannot_buy_twice_or_without_funds()
    test_place_and_remove_worn()
    test_residue_never_sold()
    test_remove_pristine()
    print("store tests ok")
