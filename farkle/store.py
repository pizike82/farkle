"""Cosmetic catalog: stickers and later dice skins, etc."""

from __future__ import annotations

STICKER_PRICE = 10000

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
    },
    {
        "id": "one_more_role",
        "name": "One More Roll",
        "kind": "sticker",
        "price": STICKER_PRICE,
        "folder": "img/stickers/one_more_role",
    },
    {
        "id": "roll_responsibly",
        "name": "Roll Responsibly",
        "kind": "sticker",
        "price": STICKER_PRICE,
        "folder": "img/stickers/roll_responsibly",
    },
)

CATALOG_BY_ID = {item["id"]: item for item in CATALOG}


def wear_for_games(games: int) -> dict:
    """Wear after N finished games: 10, then +15, +20, +25."""
    n = max(0, int(games or 0))
    chosen = WEAR_FILES[0]
    for row in WEAR_FILES:
        if n >= row[0]:
            chosen = row
    _games, key, filename, label = chosen
    return {"key": key, "file": filename, "label": label}


def item_image(item: dict, *, wear_file: str | None = None) -> str:
    filename = wear_file or "0_pristine.png"
    return f"{item['folder']}/{filename}"
