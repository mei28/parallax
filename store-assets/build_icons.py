#!/usr/bin/env python3
"""Generate the extension icons into static/icons/.

The mark is two rounded panes side by side, the right one displaced downward: the split
view, and the displacement that gives the extension its name. Rendered by supersampling a
4x grid and box-filtering it down, which is enough anti-aliasing for rounded corners at
16px without pulling in an image library.

Run via `just icons`.
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

SIZES = (16, 32, 48, 128)
OUT_DIR = Path(__file__).resolve().parent.parent / "static" / "icons"

LEFT_COLOR = (79, 70, 229)  # indigo, the original pane
RIGHT_COLOR = (34, 211, 238)  # cyan, the translated pane
SUPERSAMPLE = 4

# All geometry is expressed as a fraction of the icon's edge, so every size is the same mark.
PADDING = 0.09
GAP = 0.10
RADIUS = 0.12
DISPLACEMENT = 0.09  # how far the right pane sits below the left one


def _rounded_rect_coverage(
    px: float, py: float, x0: float, y0: float, x1: float, y1: float, radius: float
) -> bool:
    """Whether the point lies inside the rounded rectangle."""
    if not (x0 <= px <= x1 and y0 <= py <= y1):
        return False
    # Outside a corner square there is nothing left to test.
    cx = x0 + radius if px < x0 + radius else (x1 - radius if px > x1 - radius else px)
    cy = y0 + radius if py < y0 + radius else (y1 - radius if py > y1 - radius else py)
    if cx == px and cy == py:
        return True
    return (px - cx) ** 2 + (py - cy) ** 2 <= radius**2


def _render(size: int) -> bytes:
    """Render one icon as raw RGBA rows."""
    hi = size * SUPERSAMPLE
    pad = PADDING * hi
    gap = GAP * hi
    radius = RADIUS * hi
    shift = DISPLACEMENT * hi

    mid = hi / 2
    left = (pad, pad, mid - gap / 2, hi - pad - shift)
    right = (mid + gap / 2, pad + shift, hi - pad, hi - pad)

    # Accumulate colour and alpha per output pixel across the supersampled grid.
    accum = [[0, 0, 0, 0] for _ in range(size * size)]
    for sy in range(hi):
        py = sy + 0.5
        out_row = (sy // SUPERSAMPLE) * size
        for sx in range(hi):
            px = sx + 0.5
            if _rounded_rect_coverage(px, py, *left, radius):
                color = LEFT_COLOR
            elif _rounded_rect_coverage(px, py, *right, radius):
                color = RIGHT_COLOR
            else:
                continue
            cell = accum[out_row + sx // SUPERSAMPLE]
            cell[0] += color[0]
            cell[1] += color[1]
            cell[2] += color[2]
            cell[3] += 1

    samples = SUPERSAMPLE * SUPERSAMPLE
    rows = bytearray()
    for y in range(size):
        rows.append(0)  # PNG filter type 0 (None)
        for x in range(size):
            r, g, b, hits = accum[y * size + x]
            if hits == 0:
                rows.extend((0, 0, 0, 0))
                continue
            rows.extend((r // hits, g // hits, b // hits, (hits * 255) // samples))
    return bytes(rows)


def _chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def _png(size: int, raw: bytes) -> bytes:
    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", header)
        + _chunk(b"IDAT", zlib.compress(raw, 9))
        + _chunk(b"IEND", b"")
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        path = OUT_DIR / f"icon-{size}.png"
        path.write_bytes(_png(size, _render(size)))
        print(f"wrote {path.relative_to(OUT_DIR.parent.parent)} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
