# Listing images

```sh
just screenshots
```

Writes six PNGs to `store-assets/screenshots/`: five at 1280×800 for the listing, and a
440×280 promo tile.

## How they are made

`build_screenshots.py` writes HTML and has headless Chrome render it. Chrome rather than an
SVG toolchain because it needs no dependency beyond the browser the extension already
targets, and because the panes in the pictures are laid out by the same engine that lays out
the real ones — the proportions on the listing are the proportions a reader will get.

The prose in them is the fixture page and a real translation of it, not lorem ipsum. In a
listing about translation, invented copy is the one thing a reader is entitled to disbelieve.

| File | Says |
|---|---|
| `1-hero` | One page, two languages, one tab |
| `2-aligned` | The panes are matched by content. A dashed rule is drawn from the same heading in each pane, so a reader can check the claim instead of taking it |
| `3-adjustable` | The split goes where you drag it, and the grip is visibly a grip |
| `4-vertical` | The same thing stacked top and bottom |
| `5-private` | On-device translation, and the three things that follow from it |
| `promo-440x280` | The name and the mark. At that size nothing inside a window would be legible |

## Editing them

The mock-up is `window()`; the copy is at the top of `SHOTS`. `2-aligned` passes a `nudge`
that shifts the translated pane, which is what the extension itself does — a picture claiming
the panes are aligned has to show them aligned, and the two languages do not naturally fall
level. If the prose changes, that nudge needs re-checking by eye.

Re-run `just icons` first if the icon has changed; the mark is embedded at build time.

The output is committed rather than ignored. It is the listing itself, and rebuilding it
needs a browser — CI has none, and anyone reviewing the repository should be able to see what
was submitted without running anything. Set `CHROME` if yours is somewhere unusual:

```sh
CHROME=/path/to/chrome just screenshots
```
