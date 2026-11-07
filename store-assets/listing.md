# Chrome Web Store listing

Everything the submission form asks for, ready to paste. Not shipped in the package.

## Submitting

Once, before the first submission: register at the
[Developer Dashboard](https://chrome.google.com/webstore/devconsole) with a Google account
and pay the one-off 5 USD registration fee, then verify the contact email — an unverified
one blocks publishing rather than uploading, which is an easy way to be surprised late.

Then, for each release:

1. **Decide the version.** `static/manifest.json` is the one the store reads; keep
   `package.json` in step with it. The store refuses an upload whose version is not higher
   than the last published one, so this is not a step to leave until after the upload.
2. `just check && just package` — the gate, then `parallax.zip`.
3. **New Item**, upload the zip. Nothing else in the dashboard exists until this is done —
   the item's tabs, Store listing among them, appear only once a package has created the
   item. The extension ID is assigned here and never changes; the listing URL is built
   from it.
4. **Store listing**: name, both descriptions, category and language from below; the five
   screenshots and the promo tile from `store-assets/screenshots/`; and the store icon,
   which is uploaded here separately from the one inside the package.
5. **Privacy**: the single purpose and the four permission justifications from below, the
   privacy policy URL, and the data-usage declarations — Website content and Authentication
   information, as described under Data usage below, and all three certifications can be
   affirmed.
6. **Distribution**: public, all regions, no payment.
7. **Submit for review.** A first submission that asks for broad host access takes longer
   than the usual day or so, and may come back with questions; the justifications below are
   written to be answerable by quoting them.

After approval, an update is the same loop from step 1. Review is quicker for updates that
do not change the permissions.

---

## Item details

**Name** (45 max)

```
parallax — side-by-side translation
```

**Short description** (132 max — currently 119)

```
Read a page and its translation side by side. On your own machine by default, or with Sarashina using your own API key.
```

**Category**: Productivity
**Language**: English

## Detailed description

```
parallax shows a web page and its translation side by side in the same tab, and keeps
them on the same sentence as you scroll.

By default, translation runs on your own machine, using Chrome's built-in Translator
API. There is no API key to get, no account to make, and no service to trust: the text of
what you read never leaves your computer. Once Chrome has downloaded a language pack, it
works with no network at all.

For English and Japanese you can choose Sarashina, SB Intuitions' translation API,
instead, with an API key of your own. It translates a paragraph at a time, so the result
reads as whole sentences. With Sarashina chosen, the text of the pages you split is sent
to SB Intuitions to be translated.

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

No analytics, no telemetry, no accounts, and nothing ever sent to the developer. Page
text leaves your machine only if you choose Sarashina, and then only to SB Intuitions.
What is stored — your chosen translator, languages and split layout, and your Sarashina
key if you entered one — stays on your machine.

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
built-in on-device Translator API or, if the reader chooses it and supplies their own API
key, the Sarashina translation API. Everything it does serves that: creating the two
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
Kept locally: the reader's chosen translator, languages and split layout, so the next
split opens as they left it; the origin of the last site that refused to be embedded, so
the popup can offer to allow that one site while it is the one on screen; and, if the
reader enters one, their Sarashina API key, which is sent only to api.sarashina.ai with
the requests they asked for.
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

The same mechanism asks for https://api.sarashina.ai/* when the reader saves a Sarashina
API key on the options page, so the service worker can call the translation API they
chose. Removing the key withdraws it.
```

**Remote code**: No. Everything executed ships in the package.

**Data usage**: nothing is collected by the developer. When the reader chooses Sarashina,
two categories are transmitted to SB Intuitions, a third party, for the single purpose
above: **Website content** (the text of the page being translated) and **Authentication
information** (the reader's own API key, in the request header). Neither is sold, used
for anything else, or used to determine creditworthiness.

## Assets

All drawn by `just screenshots`, into `store-assets/screenshots/`.

| Asset | Size | File |
|---|---|---|
| Screenshots | 1280×800 | `store-assets/screenshots/parallax-1-hero` … `-5-private` |
| Small promo tile | 440×280 | `store-assets/screenshots/parallax-promo-440x280` |
| Store icon | 128×128 | `static/icons/icon-128.png` — uploaded to the listing, separately from the copy inside the package |
| Promo video | 1920×1080, 36 s | `video/out/Promo.mp4`, from `just video-render Promo`. The listing takes a YouTube URL, not a file, so it goes up to YouTube first |

## Where each field goes

| Tab | Field | Value |
|---|---|---|
| Store listing | Name | see Item details |
| Store listing | Summary | Short description |
| Store listing | Description | Detailed description |
| Store listing | Category / Language | Productivity / English |
| Store listing | Graphic assets | the table above |
| Store listing | Global promo video | the YouTube URL of the promo video |
| Store listing | Homepage URL | `https://github.com/mei28/parallax` |
| Store listing | Support URL | `https://github.com/mei28/parallax/issues` |
| Privacy practices | Single purpose | see below |
| Privacy practices | Permission justification | one box per permission, below |
| Privacy practices | Remote code | No |
| Privacy practices | Data usage | nothing collected; all three certifications apply |
| Privacy practices | Privacy policy URL | `https://github.com/mei28/parallax/blob/main/PRIVACY.md` |
| Distribution | Visibility / Regions | Public / all |
