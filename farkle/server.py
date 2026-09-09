"""Serve the Farkle UI and a small JSON game API."""

from __future__ import annotations

import argparse
import atexit
import json
import signal
import socket
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .entropy import engine
from .game import Farkle
from .multiplayer import lobby

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
        if path == "/api/mp/lobby":
            self._send_json(lobby.list_rooms())
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
            elif path == "/api/mp/create":
                payload = lobby.create(body)
            elif path == "/api/mp/join":
                payload = lobby.join(body)
            elif path == "/api/mp/leave":
                payload = lobby.leave(body)
            elif path == "/api/mp/ready":
                payload = lobby.ready(body)
            elif path == "/api/mp/state":
                payload = lobby.state(body)
            elif path == "/api/mp/roll":
                payload = lobby.roll(body)
            elif path == "/api/mp/select":
                payload = lobby.toggle(body)
            elif path == "/api/mp/bank":
                payload = lobby.bank(body)
            elif path == "/api/mp/arrange":
                payload = lobby.arrange(body)
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


def lan_ip() -> str | None:
    """Best-effort IPv4 address other machines on the LAN can use."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("1.1.1.1", 80))
            ip = sock.getsockname()[0]
    except OSError:
        return None
    if not ip or ip.startswith("127."):
        return None
    return ip


def _announce(host: str, port: int) -> str:
    local = f"http://127.0.0.1:{port}/"
    lines = ["", "  Farkle is running", f"  This PC: {local}"]
    if host not in ("0.0.0.0", "", "::"):
        share = f"http://{host}:{port}/"
        if share != local:
            lines.append(f"  Network: {share}")
    else:
        found = lan_ip()
        if found:
            lines.append(f"  Network: http://{found}:{port}/")
    lines.extend(["  Stop: Ctrl+C", ""])
    print("\n".join(lines), flush=True)
    return local


def main() -> None:
    parser = argparse.ArgumentParser(description="Farkle")
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Bind address (default 0.0.0.0 so others on the LAN can join)",
    )
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not open a browser tab on start",
    )
    args = parser.parse_args()
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)

    def _stop(signum, _frame) -> None:
        _flush_clock()
        raise SystemExit(0)

    for sig in (signal.SIGINT, getattr(signal, "SIGTERM", signal.SIGINT)):
        try:
            signal.signal(sig, _stop)
        except (OSError, ValueError):
            pass
    open_url = _announce(args.host, args.port)
    if args.host not in ("0.0.0.0", "", "::", "127.0.0.1"):
        open_url = f"http://{args.host}:{args.port}/"
    if not args.no_browser:
        webbrowser.open(open_url)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
