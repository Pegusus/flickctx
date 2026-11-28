# Flickctx Browser Bridge (Chrome extension)

Gives Flickctx structured browser data (URL, DOM under the mark, Set-of-Marks refs) and in-page highlight / click for Guide mode.

## Install (unpacked)

1. Start Flickctx (`npm start`) — bridge listens on `127.0.0.1:19234`
2. Chrome → **Extensions** → enable **Developer mode**
3. **Load unpacked** → select this `extension/` folder
4. Open the extension popup — should say **Connected**
5. Mark a region on a web page → ask uses DOM context (silent inspect, no badges)
6. Use **Guide me** or a walkthrough phrase → SoM badges appear and Guide may return `ref` values

## What it does

| Command | Effect |
|---------|--------|
| `inspect` | Map mark rect → element(s); **no** SoM badges (silent) |
| `som` | Stamp `data-flickctx-ref=eN` on interactive elements; `showBadges: true` only when Guide intent is active |
| `highlight` | Draw rings on **ref** and/or CSS selector |
| `click` | Scroll into view + click by **ref** and/or selector |
| `clear` | Remove in-page highlights and SoM badges |

## Intent gating

Numbered SoM badges are **not** shown for normal Mark / Ask. Flickctx passes `showBadges: true` only for Guide me / explicit walkthrough intent.

## Privacy

Traffic stays on localhost. The extension only talks to `http://127.0.0.1:19234`.