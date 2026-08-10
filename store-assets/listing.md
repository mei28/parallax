# Chrome Web Store listing

Everything the submission form asks for, ready to paste. Not shipped in the package.

---

## Item details

**Name** (45 max)

```
parallax — side-by-side translation
```

**Short description** (132 max — currently 118)

```
Read a page and its translation side by side. Runs on your own machine: no API key, no account, nothing sent anywhere.
```

**Category**: Productivity
**Language**: English

## Detailed description

```
parallax shows a web page and its translation side by side in the same tab, and keeps
them on the same sentence as you scroll.

Translation runs on your own machine, using Chrome's built-in Translator API. There is
no API key to get, no account to make, and no service to trust: the text of what you
read never leaves your computer. Once Chrome has downloaded a language pack, it works
with no network at all.

WHAT IT DOES

• Splits left/right or top/bottom, at whatever ratio you drag the divider to.
• Drag a pane small enough and it goes away. Dragging away the translation puts you back
  on the original page, exactly where you left it. Dragging away the original leaves the
  translation full width to read.
• Keeps the panes aligned by content, not by percentage. A translated paragraph rarely
  takes up its original height, so scrolling two columns in proportion drifts further
  apart with every screen. parallax matches the panes block by block and scrolls the
  other one so the matching block lands in the same place.
• Translates what is on screen first, so a long article is readable in about the time it
  takes to translate one screen rather than all of it.
• Can read sites that normally refuse to be shown in a frame — GitHub, MDN, arXiv and
  others — if you allow it, one site at a time, for one tab, until the split closes.

REQUIREMENTS

Chrome 138 or later on desktop, where the built-in Translator API is available. It does
not exist on Android or iOS. The first use of a language pair downloads a language pack.

PRIVACY

No analytics, no telemetry, no accounts, no data collection of any kind. The only things
stored are your chosen languages and split layout, kept on your machine.

Full policy: https://github.com/mei28/parallax/blob/main/PRIVACY.md

KNOWN LIMITATIONS

• Each pane is another load of the page, so in-page state — form input, an SPA's route,
  media playback — starts fresh inside them. The original page underneath is untouched
  and gets it all back when the split closes.
• Following a link moves both panes but does not yet re-translate automatically; use
  "Translate this page again" in the popup.
• A link to another site ends the split and returns you to where you started.
• Some sites will not run inside a frame for reasons no permission can change.

Source code: https://github.com/mei28/parallax
```

## Privacy practices

**Single purpose**

```
parallax shows a web page and its translation side by side in one tab, using Chrome's
built-in on-device Translator API. Everything it does serves that: creating the two
panes, translating one of them, aligning their scrolling, and letting the reader adjust
the split.
```

**Permission justifications**

`activeTab`

```
parallax needs to read the page the reader asked to split, because showing them a
translation of it is the whole feature. activeTab confines that to the single tab they
invoked it on, granted by their click. It is used in preference to host permissions
precisely so that parallax has no access to any page the reader has not acted on.
```

`scripting`

```
parallax declares no content script, so that it is not present on pages the reader has
not asked about. scripting is how it places its code into the tab at the moment they
ask for a split.
```

`storage`

```
Two things, kept locally and never transmitted: the reader's chosen languages and split
layout, so the next split opens as they left it; and the origin of the last site that
refused to be embedded, so the popup can offer to allow that one site while it is the
one on screen.
```

`declarativeNetRequestWithHostAccess`

```
About a third of the sites worth reading side by side refuse to be shown in a frame,
using X-Frame-Options or a Content-Security-Policy frame-ancestors directive — GitHub,
MDN and arXiv among them. A split view cannot show those pages at all.

When the reader asks, for a specific site, parallax serves that tab's copies of the page
without that one restriction. The rule is a session rule scoped to that tab, to
sub_frame requests, and to that host. It is removed when the split closes, when the tab
closes, and when the browser closes.

Only embedding is affected. X-Frame-Options is removed, as it controls nothing else. A
Content-Security-Policy is passed through exactly as the site sent it unless it restricts
framing, in which case only the frame-ancestors directive is dropped and every other
protection in the policy is kept. Where the policy cannot be rewritten safely — because
it carries a per-response nonce — parallax refuses rather than embedding the page at the
cost of its other protections.

This is why the permission is declarativeNetRequestWithHostAccess rather than
declarativeNetRequest: parallax has no host access until the reader grants it, per
origin, from the popup.
```

`optional_host_permissions: *://*/*`

```
Requested at runtime, one origin at a time, never at install. The reader is asked for a
specific site only after that site has refused to be embedded, and only if they press
the button offering it. The pattern is broad because the site that refuses could be any
site the reader visits; the grant never is. Granted sites can be withdrawn from
chrome://extensions.
```

**Remote code**: No. Everything executed ships in the package.

**Data usage**: nothing is collected. No category applies.

## Assets

All drawn by `just screenshots`, into `store-assets/screenshots/`.

| Asset | Size | File |
|---|---|---|
| Screenshots | 1280×800 | `parallax-1-hero` … `parallax-5-private` |
| Small promo tile | 440×280 | `parallax-promo-440x280` |
| Icon | 128×128 | Already in the package |
