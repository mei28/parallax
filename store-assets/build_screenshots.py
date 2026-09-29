#!/usr/bin/env python3
"""Draw the Chrome Web Store listing images.

Five PNGs at 1280x800, rendered from HTML by headless Chrome. Chrome rather than an SVG
library because it needs no dependency beyond the browser the extension targets, and because
the panes in these pictures are laid out by the same engine that lays out the real ones — the
proportions on the listing are the proportions a reader will get.

    python3 store-assets/build_screenshots.py

Writes store-assets/screenshots/. Run `just icons` first if the icon has changed.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from base64 import b64encode
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "store-assets" / "screenshots"
CHROME_CANDIDATES = (
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome",
    "chromium",
)
WIDTH, HEIGHT = 1280, 800

INK = "#4f46e5"  # the original pane, and the icon's left half
CYAN = "#22d3ee"  # the translation, and its right half

ICON = b64encode((ROOT / "static" / "icons" / "icon-128.png").read_bytes()).decode()

# Real sentences from the fixture, and what Chrome's Translator API actually makes of them.
# Invented copy in a picture about translation would be the one thing a reader is entitled
# to disbelieve, and so would a translation tidier than the one they will get. Kept in a
# file of their own because the promo video in video/ shows the same article.
ARTICLE = json.loads((ROOT / "store-assets" / "article.json").read_text(encoding="utf-8"))
EN = [(block["kind"], block["en"]) for block in ARTICLE]
JA = [(block["kind"], block["ja"]) for block in ARTICLE]

STYLE = f"""
  *, *::before, *::after {{ box-sizing: border-box; }}
  html, body {{ margin: 0; width: {WIDTH}px; height: {HEIGHT}px; overflow: hidden; }}
  body {{
    font-family: -apple-system, "Helvetica Neue", "Hiragino Sans", sans-serif;
    background: #0f1020;
    color: #f4f4f8;
    display: flex; flex-direction: column;
  }}
  /* A quiet field, so the screenshot inside it is the brightest thing on the card. */
  body::before {{
    content: ""; position: fixed; inset: 0;
    background:
      radial-gradient(900px 500px at 12% -10%, {INK}55, transparent 60%),
      radial-gradient(700px 450px at 105% 110%, {CYAN}33, transparent 60%);
  }}
  header {{ position: relative; padding: 46px 64px 0; }}
  .brand {{ display: flex; align-items: center; gap: 14px; }}
  .brand img {{ width: 38px; height: 38px; }}
  .brand span {{ font-size: 25px; font-weight: 650; letter-spacing: -.02em; }}
  h1 {{
    margin: 20px 0 0; font-size: 46px; line-height: 1.16; font-weight: 660;
    letter-spacing: -.025em; max-width: 21ch;
  }}
  h1 em {{ font-style: normal; color: {CYAN}; }}
  .sub {{ margin: 12px 0 0; font-size: 19px; line-height: 1.5; opacity: .72; max-width: 62ch; }}

  /* min-height:0 so the stage yields to whatever follows it; without it a flex item refuses
     to shrink below its content and the points below get cropped. */
  .stage {{ position: relative; flex: 1; min-height: 0; display: flex; align-items: flex-end;
            justify-content: center; padding: 34px 64px 0; }}
  /* The window sits proud of the bottom edge: a listing image is a glimpse, not an inventory. */
  .window {{
    width: 100%; height: 100%; border-radius: 14px 14px 0 0; overflow: hidden;
    background: #fff; color: #17171c;
    box-shadow: 0 -1px 0 rgb(255 255 255 / 22%) inset, 0 30px 70px rgb(0 0 0 / 45%);
    display: flex; flex-direction: column;
  }}
  .chrome {{
    flex: 0 0 30px; display: flex; align-items: center; gap: 7px; padding: 0 13px;
    background: #ececed; border-bottom: 1px solid #dcdcde;
  }}
  .dot {{ width: 10px; height: 10px; border-radius: 50%; background: #cfcfd3; }}
  .url {{
    margin-left: 10px; font-size: 11px; color: #6a6a72; background: #fff;
    border-radius: 5px; padding: 3px 12px;
  }}

  .panes {{ flex: 1; display: grid; min-height: 0; }}
  .panes.lr {{ grid-template-columns: var(--ratio, 1fr) 9px 1fr; }}
  .panes.tb {{ grid-template-rows: 1fr 9px 1fr; }}
  .pane {{ padding: 26px 30px; overflow: hidden; position: relative; }}
  .pane.ja {{ background: #fafaff; }}
  .pane.ja .body {{ margin-top: var(--nudge, 0); }}
  .tag {{
    position: absolute; top: 12px; right: 14px; font-size: 10.5px; font-weight: 640;
    letter-spacing: .09em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px;
  }}
  .en .tag {{ color: {INK}; background: {INK}1f; }}
  .ja .tag {{ color: #0e7490; background: {CYAN}2b; }}
  .pane h2.t {{ font-size: 19px; margin: 0 0 12px; letter-spacing: -.01em; }}
  .pane h3.t {{ font-size: 14.5px; margin: 18px 0 8px; }}
  .pane p {{ font-size: 12.5px; line-height: 1.75; margin: 0 0 10px; color: #3c3c46; }}

  .handle {{ background: #e2e2e6; position: relative; }}
  .grip {{
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 12px; height: 24px; border-radius: 3px; background: #fff;
    border: 1px solid #c6c6cc;
    background-image:
      radial-gradient(circle 1px at 3.5px 7px, #8a8a94 99%, transparent 100%),
      radial-gradient(circle 1px at 3.5px 12px, #8a8a94 99%, transparent 100%),
      radial-gradient(circle 1px at 3.5px 17px, #8a8a94 99%, transparent 100%),
      radial-gradient(circle 1px at 8.5px 7px, #8a8a94 99%, transparent 100%),
      radial-gradient(circle 1px at 8.5px 12px, #8a8a94 99%, transparent 100%),
      radial-gradient(circle 1px at 8.5px 17px, #8a8a94 99%, transparent 100%);
  }}
  .panes.tb .grip {{ transform: translate(-50%, -50%) rotate(90deg); }}

  /* Drawn from the heading itself, so it lands at that heading's height in each pane
     without anyone having to work out where that is. With the follower scrolled — which is
     what the extension does — the two dashes come out level, and the claim is checkable
     rather than asserted. */
  .anchored {{ position: relative; }}
  .anchored::before {{
    content: ""; position: absolute; left: -30px; right: -30px; top: -9px;
    border-top: 2px dashed {CYAN};
  }}
  .anchored[data-label]::after {{
    content: attr(data-label); position: absolute; left: 0; top: -20px;
    font-size: 10.5px; font-weight: 640; letter-spacing: .04em; color: #0e7490;
    background: #eafcff; padding: 2px 9px; border-radius: 999px;
    border: 1px solid {CYAN}66; white-space: nowrap;
  }}

  .points {{ position: relative; flex: 0 0 auto; display: flex; gap: 30px;
             padding: 26px 64px 40px; }}
  .point {{ flex: 1; }}
  .point b {{ display: block; font-size: 17px; font-weight: 640; margin-bottom: 6px; }}
  .point span {{ font-size: 14px; line-height: 1.55; opacity: .7; }}
  .point.on b::before {{
    content: ""; display: inline-block; width: 9px; height: 9px; border-radius: 50%;
    background: {CYAN}; margin-right: 9px; vertical-align: middle;
  }}
"""


def prose(lines: list[tuple[str, str]], anchor: str | None = None) -> str:
    """Render the fixture's blocks. `anchor` marks the heading the alignment rule is drawn on."""
    out = []
    for kind, text in lines:
        if kind == "title":
            out.append(f"<h2 class='t'>{text}</h2>")
        elif kind == "heading":
            marked = anchor is not None and not any("anchored" in piece for piece in out)
            label = f" data-label=\"{anchor}\"" if marked and anchor else ""
            css = "t anchored" if marked else "t"
            out.append(f"<h3 class='{css}'{label}>{text}</h3>")
        else:
            out.append(f"<p>{text}</p>")
    return "".join(out)


def window(
    orientation: str = "lr",
    ratio: str = "1fr",
    rule: bool = False,
    nudge: str = "0px",
) -> str:
    """One mocked-up split.

    `nudge` shifts the translated pane the way scroll sync does, so a picture claiming the
    panes are aligned shows them aligned.
    """
    en = prose(EN, anchor="the same block, at the same height" if rule else None)
    ja = prose(JA, anchor="" if rule else None)
    return f"""
    <div class="window">
      <div class="chrome">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
        <div class="url">example.com/notes-on-reading</div>
      </div>
      <div class="panes {orientation}" style="--ratio:{ratio}">
        <div class="pane en"><div class="tag">English</div><div class="body">{en}</div></div>
        <div class="handle"><div class="grip"></div></div>
        <div class="pane ja" style="--nudge:{nudge}">
          <div class="tag">日本語</div><div class="body">{ja}</div>
        </div>
      </div>
    </div>
    """


def page(title: str, sub: str, body: str, points: str = "") -> str:
    return f"""<!doctype html><meta charset="utf-8"><style>{STYLE}</style>
    <header>
      <div class="brand"><img src="data:image/png;base64,{ICON}" alt=""><span>parallax</span></div>
      <h1>{title}</h1>
      <p class="sub">{sub}</p>
    </header>
    {body}
    {points}
    """


def point(label: str, text: str, on: bool = False) -> str:
    marker = " on" if on else ""
    return f"<div class='point{marker}'><b>{label}</b><span>{text}</span></div>"


SHOTS: dict[str, str] = {
    "1-hero": page(
        "Read a page and its <em>translation</em>, side by side",
        "One tab, two panes, kept on the same sentence as you scroll.",
        f'<div class="stage">{window()}</div>',
    ),
    "2-aligned": page(
        "Aligned by <em>content</em>, not by percentage",
        "A translated paragraph rarely keeps its original height, so scrolling two columns "
        "in proportion drifts apart. parallax matches the panes block by block.",
        f'<div class="stage">{window(rule=True, nudge="-5px")}</div>',
    ),
    "3-adjustable": page(
        "Drag the split <em>anywhere</em>",
        "Left and right or top and bottom, at any ratio. Drag a pane small enough and it "
        "goes away, leaving what you wanted to read.",
        f'<div class="stage">{window(ratio="0.62fr")}</div>',
    ),
    "4-vertical": page(
        "Or stack them <em>top and bottom</em>",
        "Which suits a narrow window, or a language whose lines run long.",
        f'<div class="stage">{window(orientation="tb")}</div>',
    ),
    "5-private": page(
        "Runs on <em>your</em> machine",
        "Translation uses Chrome's built-in on-device model. No API key, no account, and "
        "nothing you read is sent anywhere — including to us.",
        f'<div class="stage" style="padding-bottom:0">{window()}</div>',
        f"""<div class="points">
          {point("No key, no account", "Nothing to sign up for and nothing to pay for.", True)}
          {point("Works offline", "Once Chrome has the language pack, no network is used.", True)}
          {point("No data collected", "No analytics, no telemetry, no reporting.", True)}
        </div>""",
    ),
}


# The small promo tile is a different problem from a screenshot: at 440x280 nothing inside a
# mocked-up window would be legible, so it says the name and shows the mark instead.
PROMO = f"""<!doctype html><meta charset="utf-8"><style>
  *, *::before, *::after {{ box-sizing: border-box; }}
  html, body {{ margin: 0; width: 440px; height: 280px; overflow: hidden; }}
  body {{
    font-family: -apple-system, "Helvetica Neue", sans-serif; color: #f4f4f8;
    background: #0f1020; display: flex; flex-direction: column; justify-content: center;
    padding: 0 34px; position: relative;
  }}
  body::before {{
    content: ""; position: absolute; inset: 0;
    background:
      radial-gradient(340px 220px at 8% -20%, {INK}66, transparent 62%),
      radial-gradient(300px 200px at 108% 118%, {CYAN}3d, transparent 62%);
  }}
  .brand {{ position: relative; display: flex; align-items: center; gap: 12px; }}
  .brand img {{ width: 34px; height: 34px; }}
  .brand span {{ font-size: 23px; font-weight: 650; letter-spacing: -.02em; }}
  h1 {{
    position: relative; margin: 16px 0 0; font-size: 27px; line-height: 1.24;
    font-weight: 640; letter-spacing: -.02em; max-width: 15ch;
  }}
  h1 em {{ font-style: normal; color: {CYAN}; }}
  p {{ position: relative; margin: 11px 0 0; font-size: 13px; opacity: .68; }}
</style>
<div class="brand"><img src="data:image/png;base64,{ICON}" alt=""><span>parallax</span></div>
<h1>A page and its <em>translation</em>, side by side</h1>
<p>On-device. No key, no account.</p>
"""


def render(
    chrome: str, name: str, html: str, work: Path, size: tuple[int, int] = (WIDTH, HEIGHT)
) -> Path:
    source = work / f"{name}.html"
    source.write_text(html, encoding="utf-8")
    out = OUT / f"parallax-{name}.png"
    result = subprocess.run(
        [
            chrome,
            "--headless",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            f"--window-size={size[0]},{size[1]}",
            f"--screenshot={out}",
            source.as_uri(),
        ],
        capture_output=True,
        text=True,
    )
    if not out.exists():
        raise SystemExit(f"{name}: Chrome wrote nothing\n{result.stderr}")
    return out


def find_chrome() -> str:
    """The browser to render with: $CHROME if set, else the usual places."""
    override = os.environ.get("CHROME")
    if override:
        return override
    for candidate in CHROME_CANDIDATES:
        if Path(candidate).exists() or shutil.which(candidate):
            return candidate
    raise SystemExit(
        "No Chrome found. Set CHROME to its path, e.g.\n"
        "  CHROME=/path/to/chrome just screenshots"
    )


def main() -> None:
    chrome = find_chrome()
    OUT.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp())
    try:
        for name, html in SHOTS.items():
            path = render(chrome, name, html, work)
            print(f"{path.relative_to(ROOT)}  {path.stat().st_size // 1024} KB")
        tile = render(chrome, "promo-440x280", PROMO, work, (440, 280))
        print(f"{tile.relative_to(ROOT)}  {tile.stat().st_size // 1024} KB")
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
    sys.exit(0)
