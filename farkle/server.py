"""Serve the Farkle UI and a small JSON game API."""

from __future__ import annotations

import argparse
import atexit
import json
import signal
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .entropy import engine
from .game import Farkle

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
game = Farkle()


def _flush_clock() -> None:
    try:
        game.stats.flush_clock(persist=True)
    except OSError:
        pass


atexit.register(_flush_clock)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/state":
            self._send_json(game.state())
            return
        if path == "/api/stats":
            self._send_json(game.stats.snapshot())
            return
        if path == "/api/store":
            self._send_json(game.store())
            return
        if path == "/api/decorations":
            self._send_json(game.decorations())
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        body = self._read_json()
        if body.get("entropy"):
            engine.stir_client(body.get("entropy"))
        try:
            if path == "/api/roll":
                payload = game.roll(entropy=body.get("entropy"))
            elif path == "/api/select":
                payload = game.toggle(int(body.get("index", -1)))
            elif path == "/api/bank":
                payload = game.bank()
            elif path == "/api/new":
                payload = game.new_game()
            elif path == "/api/abandon":
                payload = game.abandon()
            elif path == "/api/pause":
                payload = game.pause()
            elif path == "/api/arrange":
                payload = game.arrange()
            elif path == "/api/buy":
                payload = game.buy(str(body.get("id", "")))
            elif path == "/api/sticker/place":
                payload = game.place_sticker(body)
            elif path == "/api/sticker/remove":
                payload = game.remove_sticker(str(body.get("id", "")))
            elif path == "/api/residue/remove":
                payload = game.remove_residue(str(body.get("id", "")))
            else:
                self._send_json({"error": "not found"}, 404)
                return
        except (TypeError, ValueError) as exc:
            self._send_json({"error": str(exc)}, 400)
            return
        self._send_json(payload)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        try:
            data = json.loads(raw.decode())
        except json.JSONDecodeError as exc:
            raise ValueError("Invalid JSON") from exc
        return data if isinstance(data, dict) else {}

    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        # Keep the startup URL visible; skip routine access noise.
        message = fmt % args
        if "code 200" in message or "code 304" in message:
            return
        print("%s - %s" % (self.address_string(), message), file=sys.stderr)


def _announce(url: str) -> None:
    banner = (
        "\n"
        "  Farkle is running\n"
        f"  Open: {url}\n"
        "  Stop: Ctrl+C\n"
    )
    print(banner, flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Farkle")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not open a browser tab on start",
    )
    args = parser.parse_args()
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    url = f"http://{args.host}:{args.port}/"

    def _stop(signum, _frame) -> None:
        _flush_clock()
        raise SystemExit(0)

    for sig in (signal.SIGINT, getattr(signal, "SIGTERM", signal.SIGINT)):
        try:
            signal.signal(sig, _stop)
        except (OSError, ValueError):
            pass
    _announce(url)
    if not args.no_browser:
        webbrowser.open(url)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
