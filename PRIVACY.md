# Privacy policy

**parallax does not collect any data.** There is no analytics, no telemetry, no error
reporting, and no account, and nothing is ever sent to the developer. By default nothing you
read is sent anywhere. The one exception is a translation service you choose yourself, with
your own API key; see [Translating with Sarashina](#translating-with-sarashina).

Last updated: 7 November 2026.

## Translation happens on your machine, by default

parallax translates using Chrome's built-in Translator API, which runs a model on your own
device. Unless you choose Sarashina, the text of the pages you read is never sent to a
translation service, to the developer, or to anyone else. A page read offline translates
exactly as it would online.

Chrome downloads a language pack the first time you use a language pair. That download is
Chrome's, not parallax's, and is covered by
[Google Chrome's privacy notice](https://www.google.com/chrome/privacy/).

## Translating with Sarashina

You can choose Sarashina, SB Intuitions' translation API, in the popup instead. It is off
until you do, and it needs an API key of your own, entered on parallax's options page.

When Sarashina is the chosen translator:

- **The text of every page you split is sent to SB Intuitions** at `api.sarashina.ai` to be
  translated, a few paragraphs per request. Their terms and privacy policy, not parallax's,
  cover what happens to it there. Text inside code elements, form fields and elements marked
  `translate="no"` is not sent.
- **Your API key is stored unencrypted** in `chrome.storage.local`, in this browser profile.
  It is sent only to `api.sarashina.ai`, in the `Authorization` header of those requests.
  The request is made by parallax's service worker, so the key is never handed to the page
  you are reading. parallax's own content script could read that storage area, as any
  extension's can; nothing else on the page can. SB Intuitions advises against using API
  keys in browser code, so use a key you can revoke.
- **parallax asks for access to `api.sarashina.ai`** when you save the key, through Chrome's
  permission prompt. Removing the key on the options page removes that access too.
- The service accepts requests from Japan only.

Switching back to Chrome's translator stops all of this. Removing the key, or uninstalling
parallax, deletes the key.

## What is stored, and where

These are kept in `chrome.storage.local`, on your machine only, and are removed when you
uninstall the extension. Only the API key ever leaves it, and only as described above.

| Stored | Why |
|---|---|
| Your translator, source and target language, split direction, and split ratio | So the next split opens the way you left it |
| The origin of the last site that refused to be embedded | So the popup can offer to allow that one site, and only while that site is the one on screen |
| Your Sarashina API key, if you entered one | So parallax can call Sarashina for you; see above |

## What parallax can see, and when

parallax runs only when you ask it to — by clicking its toolbar icon or pressing its
keyboard shortcut. It declares no content script, so it is not present on pages you have not
split. It reads the page you are splitting because it has to: showing you a translation of it
is the entire feature.

The permissions it asks for at install time are:

- **activeTab** — access to the one tab you invoked it on, granted by that click and lasting
  only until you navigate away. This is what lets parallax read the page it is splitting,
  and it is why parallax does not ask for access to all websites.
- **scripting** — to place its own code into that tab when you ask for a split.
- **storage** — the items in the table above.
- **declarativeNetRequestWithHostAccess** — see below.

## Sites that refuse to be embedded

Some sites tell browsers they must not be shown inside a frame, using `X-Frame-Options` or a
`Content-Security-Policy` of `frame-ancestors`. About a third of the sites worth reading this
way do, including GitHub, MDN and arXiv. A split view cannot show them.

parallax can serve that one tab's copies of such a page without that one restriction, but
only if you ask it to, and only for the site in front of you:

1. You press a button in the popup, for the specific site that refused.
2. Chrome asks you to grant access to that origin, and you grant it or you do not.
3. The rule that removes the restriction applies to that tab, to frame requests, and to that
   host — nothing else.
4. It is removed when the split closes, when the tab closes, and when the browser closes.

Only the headers that control embedding are touched. `X-Frame-Options` is removed, since it
controls nothing else. A `Content-Security-Policy` is left exactly as the site sent it unless
it restricts framing, in which case that one directive is dropped and every other protection
in the policy is preserved. Where the policy could not be altered without breaking the page —
because it carries a per-response nonce — parallax refuses rather than embedding the site at
that cost.

You can withdraw a granted site at any time from `chrome://extensions` → parallax → Details →
Site access.

## Changes

Any change to this policy will be published in this file, and the date above updated.

## Contact

Open an issue at https://github.com/mei28/parallax/issues.
