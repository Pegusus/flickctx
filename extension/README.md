# Flickctx Browser Bridge (Chrome extension)

Gives Flickctx structured browser data (URL, DOM under the mark, CSS selectors) and in-page highlight / click for Guide mode.

## Install (unpacked)

1. Start Flickctx (`npm start`) — bridge listens on `127.0.0.1:19234`
2. Chrome → **Extensions** → enable **Developer mode**
3. **Load unpacked** → select this `extension/` folder
4. Open the extension popup — should say **Connected**
5. Mark a region on a web page → Guide / ask uses DOM + selectors when available

## What it does

| Command | Effect |
|---------|--------|
| `inspect` | Map mark rect → element(s), return selector/text/href |
| `highlight` | Draw rings on CSS selectors in the page |
| `click` | Scroll into view + click selector |
| `clear` | Remove in-page highlights |

## Privacy

Traffic stays on localhost. The extension only talks to `http://127.0.0.1:19234`.
