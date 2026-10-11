# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Pictureframe** — a Manifest V3 browser extension that turns any image on any
page into a fullscreen lightbox with cursor-anchored zoom, pan, rotate/flip,
clipboard copy and download. It also unblocks right-click and penetrates the
transparent `<div>` shields sites put over photos.

There is **no build step, no package.json and no test runner**. The repository
is https://github.com/Spillebulle/Pictureframe; misfire reports from the
reporter land in its Issues.
The folder *is* the extension: `chrome://extensions` → Developer mode → Load
unpacked → pick this directory. After editing any file, hit the reload arrow on
the extension card **and reload the page under test** — content scripts are only
re-injected on navigation.

## Verifying a change

`test.html` is the harness. Open it as a `file://` URL (the extension matches
`<all_urls>`) and it exercises, in one page: plain images, an image wrapped in a
link (smart detection must yield), a page with `oncontextmenu` disabled, a
transparent overlay shield, and a `<canvas>`. There is nothing automated —
looking at it is the test.

The README banner can be re-measured with the house tool:

```sh
python "../Design-Principles/banner.py" --check docs/images/banner.png --name PICTUREFRAME
```

## Architecture

Five content scripts are injected **in order** at `document_start` into **all
frames**, and they talk to each other only through globals hung on `window` —
there are no modules and no bundler, so order in `manifest.json` is the
dependency graph:

```
unblocker.js  → window.__pictureframe_unblockEnabled
                window.__pictureframe_lastTarget        (what the last right-click hit)
                window.__pictureframe_findImageUnderPoint(x, y)
extractor.js  → window.__pictureframe_extractImageInfo(el)  → {url, title, naturalW/H, renderedW/H}
viewer.js     → window.__pictureframeViewer                 (singleton, constructed on load)
content.js    → window.__pictureframe_explainClick(target, event) → {open, reason, imgInfo, ancestor}
                window.__pictureframe_interactiveReason(el), window.__pictureframe_getSettings()
reporter.js   → no exports; the misfire-report eyedropper (see below)
```

`background.js` (service worker) owns four things content scripts cannot do:
seeding `chrome.storage.sync` with `DEFAULT_SETTINGS` on install, the three
context-menu items, and `chrome.downloads` / cross-origin `fetch` on behalf of
the viewer (`DOWNLOAD_IMAGE`, `FETCH_BLOB_BASE64` messages; both return `true`
for the async `sendResponse`), and relaying `REPORT_PICK_DONE` from one frame
as `CANCEL_REPORT` to every frame of the tab.

### Why `document_start` matters

`unblocker.js` wins against anti-save scripts *only* because it registers its
`contextmenu` / `dragstart` / `selectstart` listeners in the **capture phase**
before page scripts exist, then calls `stopPropagation()` so the page's own
handler never runs and never gets to `preventDefault()`. Moving it later, or to
the bubble phase, silently breaks the whole feature.

### Settings

`chrome.storage.sync` is the single bus. Everything watches it:

- `background.js` — `DEFAULT_SETTINGS` is the seed, written only for keys that
  are `undefined` on install.
- `content.js` — keeps its **own duplicated copy** of the defaults object, does
  a `get(null)` on load, and listens to `chrome.storage.onChanged` to push into
  `__pictureframeViewer.updateSettings()` and `__pictureframe_unblockEnabled`.
- `popup/` — the short list, written **immediately** on every change.
- `options/` — the full list, written only when **Save changes** is clicked.

So adding a setting means touching four places: the two default objects, the
consumer, and whichever UI exposes it. Two keys are currently seeded but dead:
`smoothPanning` (nothing reads it) and `triggerMode` (`content.js` branches on
`'hover_only'` / `'always'`, but no UI ever sets it away from `'smart'`).

### Smart click detection (`content.js`)

The document `click` handler runs in the **bubble** phase so page handlers go
first, then asks `explainClick()` — a side-effect-free function that returns the
decision *and a reason string*, so the reporter can reuse it verbatim:

1. Skip anything inside `#pictureframe-root` (uses `composedPath()`, since the
   viewer is Shadow DOM).
2. Skip if `defaultPrevented` and the modifier is not held.
3. Extract image info; bail on anything under 32×32 rendered.
4. Modifier held (default `Alt`) → always open, `preventDefault` + `stopPropagation`.
5. Otherwise, if `smartClickEnabled`:
   - `kind` `canvas` / `svg` / `video` (from the extractor) **never** opens on a
     plain click — these are spreadsheets, charts, maps and players. Google
     Sheets' grid is a `<canvas>`; that was the original misfire.
   - Inside an app region (`contenteditable`, `role=application|grid|treegrid|
     textbox|listbox|menu|toolbar`) → yield.
   - Walk **up to 6 ancestors** looking for interactivity — tag (`A`, `BUTTON`,
     `LABEL`, …), ARIA `role`, inline `on*` attributes, `tabindex >= 0`, known
     lightbox data-attrs (`data-fancybox`, `data-pswp`, …), lightbox-ish class
     names, or `cursor: pointer` on a non-`IMG`. If found, **yield**.

The hover badge is a separate path: a throttled (40 ms) `mousemove` positions a
26×26 button in the image's top-right corner for images ≥ `hoverIconMinSize`.
It lives in the light DOM with its own injected `<style>` (not the Shadow DOM),
so its hexes are duplicated there.

### Misfire reporter (`content/reporter.js`)

The popup's two *Report a misfire* buttons send `START_REPORT {kind}` to every
frame of the active tab. Each frame enters pick mode: crosshair cursor, a
highlight box with a live label showing `explainClick()`'s verdict, and a hint
bar (top frame only). Its window-capture `pointerdown`/`mousedown`/`click`/…
listeners are registered at `document_start` and idle until picking, so they
run before the page's and swallow the pick click entirely. The picked frame
builds a plain-text report (settings, decision + reason, extractor output,
shield-penetration result, ancestor chain with interactive reasons, the
`elementsFromPoint` stack), copies it, and shows it in a Shadow DOM panel
(same literal-hex exception as the viewer). Query strings and hashes are
stripped from the page URL. The panel's primary button opens
`ISSUES_URL/new` with a title prefilled; the body is pasted from the clipboard
(a report is too long to trust to a query string).

### The viewer's transform model (`content/viewer.js`)

State is four fields — `scale`, `translateX/Y`, `rotation`, `flipH/flipV` —
composed in a fixed order and never re-derived:

```js
translate3d(tx, ty, 0) scale(s) rotate(r) scaleX(±1) scaleY(±1)
```

Cursor-anchored zoom keeps the pixel under the pointer fixed via
`t' = cursor - (cursor - t) * factor`. `rotateClockwise()` and
`flipHorizontal()` additionally rewrite `translateX/Y` so the operation pivots
around the *centre of the viewport* rather than the canvas origin — the flip
uses a double-angle reflection because the current `rotation` tilts the mirror
axis. If you touch one of these, verify by rotating while zoomed in on a
corner: the corner must stay put.

At `scale >= 4` the canvas gets `.pf-pixelated` for nearest-neighbour
inspection. Copy falls back to copying the URL as text when `fetch` or the
canvas is tainted.

## Styling

- `tokens.css` is a **vendored copy** of `../Design-Principles/tokens.css` with
  only the accent swapped: `--accent-h: 254`, `--accent: #6a4cce`. When the
  house file changes, re-copy it and re-apply that one edit. It is loaded by
  `popup/`, `options/` and `test.html`; neither page sets `class="dark"` or
  `class="web"`, so both follow the OS theme at desktop scale.
- UI follows `../Design-Principles/STYLE-GUIDE.md` (the `§` numbers scattered
  through the CSS and JS comments point into it). Never a raw hex in popup or
  options CSS — add a token instead.
- **The viewer is the deliberate exception.** It renders in Shadow DOM inside
  arbitrary pages, cannot reach `tokens.css`, and starts from `all: initial`, so
  it redeclares the palette as literal hexes at the top of `VIEWER_STYLES` and
  stamps `stroke="#FFFFFF"` on every SVG element and `!important` on the icon
  rules — hostile page stylesheets otherwise repaint the toolbar.

### `content/viewer.css` is dead code

The live stylesheet is the `VIEWER_STYLES` template literal at the top of
`content/viewer.js` (lines 6–313), injected into the shadow root synchronously.
`content/viewer.css` is a byte-for-byte copy that nothing ever fetches, despite
being listed in `web_accessible_resources`. **Edit the string in `viewer.js`;**
editing the `.css` file changes nothing. Either keep both in sync or delete the
file — do not assume a change landed because the `.css` looks right.

Icons are hand-inlined Lucide geometry (24×24 viewBox, 1.5 stroke, round caps).
There is no icon library to import from; copy the paths from lucide.dev.

## Conventions

- Every content script is an IIFE. Nothing is exported; cross-file access is via
  the `window.__pictureframe_*` globals listed above.
- User-facing strings end in a full stop (house voice, STYLE-GUIDE §12) — see
  the toasts and `title` attributes.
- Logging is prefixed `[Pictureframe]`.
