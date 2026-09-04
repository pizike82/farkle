# Farkle

A local, single-player [Farkle](https://en.wikipedia.org/wiki/Farkle) game in the browser. Python’s standard library serves the UI and the game API — no extra packages, accounts, or network play.

Bank 10,000 points to win. The table is black and white; a secondary color (bright orange by default) accents selection, hot dice, and buttons. Change that accent in the gear menu.

## Quick start

**Requires:** [Python 3.10+](https://www.python.org/downloads/) (standard library only)

```bash
python server.py
```

That opens [http://127.0.0.1:8000/](http://127.0.0.1:8000/). Stop the server with Ctrl+C.

Same thing, other forms:

```bash
python -m farkle
python server.py --port 8001
python server.py --no-browser
```

If port 8000 is already in use, pass `--port` or stop the other process.

## How to play

1. **Roll** six dice.
2. Set aside scoring dice (1s, 5s, three-or-more of a kind, and a few six-die combos).
3. **Roll** the rest, or **Bank** the turn into your total.
4. A roll with nothing scoring is a **Farkle** — the turn score is lost.
5. If every remaining die scores, you have **hot dice** and may roll all six again.
6. First to **10,000** wins.

**Order** sorts the dice in the tray. **Pause** freezes the clock (idle pause also kicks in after three minutes with no action). **Abandon** and **New game** live in the gear menu.

## Project layout

```
.
├── server.py          # `python server.py` entry point
├── farkle/            # game rules, stats, entropy, HTTP server
├── web/               # HTML, CSS, JS, dice sprite, logo
├── tests/             # clock / restart checks
└── data/              # local stats.json (not committed)
```

Play data is written to `data/stats.json` (lifetime totals plus the current game). It is gitignored so a clone starts clean.

## Tests

```bash
python tests/test_clock.py
```

These assert that elapsed time does not include time the server was stopped.

## Credits

3D dice presentation inspired by [this CodePen](https://codepen.io/creativeocean/pen/oNEPggW) (GSAP cubes + face sprite).
