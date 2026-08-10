#!/usr/bin/env python3
"""Serve public/fixtures with framing refused, to exercise the FRAME_BLOCKED error surface.

Every response carries both of the headers that stop a page being embedded, including by a
same-origin parent: X-Frame-Options: DENY and CSP frame-ancestors 'none'. Same-origin
framing survives SAMEORIGIN and frame-ancestors 'self', so those would not reproduce the
failure we need to see.

Run via `just serve-blocked`.
"""

from __future__ import annotations

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

FIXTURES = Path(__file__).resolve().parent


class BlockedHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "frame-ancestors 'none'")
        super().end_headers()


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3001
    handler = partial(BlockedHandler, directory=str(FIXTURES))
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        print(f"serving {FIXTURES} with framing denied on http://127.0.0.1:{port}/")
        server.serve_forever()


if __name__ == "__main__":
    main()
