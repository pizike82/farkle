"""Cosmetic catalog: stickers and later dice skins, etc."""

from __future__ import annotations

import struct
from pathlib import Path

STICKER_PRICE = 10000
_WEB = Path(__file__).resolve().parent.parent / "web"
_PNG_SIZE: dict[str, tuple[int, int]] = {}

WEAR_FILES = (
    (0, "pristine", "0_pristine.png", "Pristine"),
    (10, "light_wear", "1_light_wear.png", "Light wear"),
    (25, "medium_wear", "2_medium_wear.png", "Medium wear"),
    (45, "heavy_wear", "3_heavy_wear.png", "Heavy wear"),
    (70, "extreme_wear", "4_extreme_wear.png", "Extreme wear"),
)

CATALOG = (
    {
        "id": "fark_around",
        "name": "Fark Around",
        "kind": "sticker",
        "price": STICKER_PRICE,
        "folder": "img/stickers/fark_around",
        "residue": "large",
    },
    {
        "id": "one_more_role",
        "name": "One More Roll",
        "kind": "sticker",
        "price": STICKER_PRICE,
        "folder": "img/stickers/one_more_role",
        "residue": "small",
    },
    {
        "id": "roll_responsibly",
        "name": "Roll Responsibly",
        "kind": "sticker",
        "price": STICKER_PRICE,
        "folder": "img/stickers/roll_responsibly",
        "residue": "round",
    },
    {
        "id": "124_die",
        "name": "124 Die",
        "kind": "sticker",
        "price": STICKER_PRICE,
        "folder": "img/stickers/124_die",
        "residue": "round",
    },
)

CATALOG_BY_ID = {item["id"]: item for item in CATALOG}

RESIDUE_FILES = {
    "large": "img/stickers/sticker_residue/large/large_residue.png",
    "small": "img/stickers/sticker_residue/small/small_residue.png",
    "round": "img/stickers/sticker_residue/round/round_residue.png",
}

RESIDUE_SCALE = 0.62


def wear_for_games(games: int) -> dict:
    """Wear after N finished games: 10, then +15, +20, +25."""
    n = max(0, int(games or 0))
    chosen = WEAR_FILES[0]
    for row in WEAR_FILES:
        if n >= row[0]:
            chosen = row
    _games, key, filename, label = chosen
    return {"key": key, "file": filename, "label": label}


def residue_image(shape: str) -> str:
    return RESIDUE_FILES.get(shape) or RESIDUE_FILES["large"]


def residue_scale(sticker_scale: float) -> float:
    """Residue is always smaller than the sticker it came from."""
    original = max(0.55, min(1.0, float(sticker_scale or 1)))
    return max(0.28, min(original * RESIDUE_SCALE, original - 0.08))


def _png_size(rel_path: str) -> tuple[int, int]:
    rel = str(rel_path or "").replace("\\", "/")
    if rel not in _PNG_SIZE:
        data = (_WEB / rel).read_bytes()
        _PNG_SIZE[rel] = struct.unpack(">II", data[16:24])
    return _PNG_SIZE[rel]


def _oriented(w: int, h: int) -> str:
    if h > w * 1.12:
        return "portrait"
    if w > h * 1.12:
        return "landscape"
    return "square"


def residue_rotation(sticker_rotation: float, spec: dict) -> float:
    """Turn landscape residue to match a portrait sticker, and vice versa."""
    extra = 0
    try:
        sw, sh = _png_size(f"{spec['folder']}/0_pristine.png")
        rw, rh = _png_size(residue_image(str(spec.get("residue") or "large")))
        sticker_way = _oriented(sw, sh)
        residue_way = _oriented(rw, rh)
        if sticker_way in {"portrait", "landscape"} and residue_way in {"portrait", "landscape"}:
            if sticker_way != residue_way:
                extra = 90
    except (OSError, struct.error, ValueError, KeyError):
        extra = 0
    return (float(sticker_rotation or 0) + extra) % 360.0


def item_image(item: dict, *, wear_file: str | None = None) -> str:
    filename = wear_file or "0_pristine.png"
    return f"{item['folder']}/{filename}"
