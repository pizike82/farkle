"""Startup banner includes a LAN URL others can open."""

from __future__ import annotations

import io
import sys
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from farkle.server import _announce


def test_announce_lists_this_pc_and_network() -> None:
    buf = io.StringIO()
    with patch("farkle.server.lan_ip", return_value="192.168.1.50"):
        with patch("sys.stdout", buf):
            url = _announce("0.0.0.0", 8000)
    text = buf.getvalue()
    assert url == "http://127.0.0.1:8000/"
    assert "This PC: http://127.0.0.1:8000/" in text
    assert "Network: http://192.168.1.50:8000/" in text


if __name__ == "__main__":
    test_announce_lists_this_pc_and_network()
    print("server tests ok")
