# HTML Capture Kit

Private tooling for capturing a live web page from Chrome and importing the result into Figma without depending on a paid third-party service.

This kit contains:

- `chrome-extension/`: a Manifest V3 Chrome extension that captures the current page into a portable `.figcap.json` file.
- `figma-plugin/`: a Figma development plugin that imports `.figcap.json` files and rebuilds the page as editable Figma layers.

## Why you may have seen "Could not establish connection. Receiving end does not exist."

That error means the popup tried to send a message into the active tab, but no content script was listening there yet.

Common causes:

- the tab was opened before the extension was loaded or reloaded
- the current tab is a Chrome-internal page like `chrome://...`
- the current tab is the Chrome Web Store
- the current tab is a local `file://...` page and `Allow access to file URLs` is not enabled

Version `0.3.0` now tries to inject the content script dynamically before capture, so normal website tabs should recover automatically instead of failing with that raw error.

## What the MVP does

- Captures page dimensions, title, URL, and viewport metadata.
- Captures visible text blocks with font, size, weight, alignment, and color hints.
- Captures visible boxes with backgrounds, borders, radius, and opacity.
- Captures `img`, `svg`, and `canvas` elements as image-backed layers when possible.
- Lets you ignore sticky or fixed elements at capture time.
- Lets you ignore any subtree by selector or by adding `data-capture-ignore`.
- Remembers popup settings between captures.

## What the MVP does not guarantee yet

- Pixel-perfect recreation of every CSS effect.
- Reliable import of cross-origin images that block extraction.
- Full auto-layout reconstruction.
- Full support for pseudo-elements, transforms, video frames, and complex masks.

This version is intentionally built as a reliable internal tool first. It is designed to unblock documentation, wireframing, and Figma handoff, then we can keep improving fidelity.

## Chrome Extension Setup

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select:

```text
/Users/maxwell/Downloads/SEP492-Project-main/tools/html-capture-kit/chrome-extension
```

5. Open the page you want to capture.
6. Click the extension icon.
7. Adjust ignore options if needed.
8. Click `Capture Current Page`.
9. Save the downloaded `.figcap.json` file.

## Figma Plugin Setup

1. Open Figma desktop app or web app.
2. Go to `Plugins` -> `Development` -> `Import plugin from manifest...`
3. Select:

```text
/Users/maxwell/Downloads/SEP492-Project-main/tools/html-capture-kit/figma-plugin/manifest.json
```

4. Run the plugin from `Plugins` -> `Development` -> `HTML Capture Importer`.
5. Choose the `.figcap.json` file exported by the Chrome extension.
6. Click `Import Into Figma`.

If you update the plugin files locally, re-import the manifest or use Figma's reload action before testing again.

## Capture Tips

- Add `data-capture-ignore` to any element you never want exported, like help bubbles or noisy footers.
- Use the extension's `Ignore sticky elements` option when headers or sidebars repeat during scrolling captures.
- Use the extension's `Ignore fixed elements` option for floating chat widgets, docked toolbars, and overlays.
- If a page still feels noisy, pass selectors like `.toast, .intercom-lightweight-app, footer`.
- After reloading the extension in `chrome://extensions`, refresh any already-open tab once so Chrome can apply static content scripts consistently.

## Suggested next upgrades

- Add a `?capture=1` mode in the app to disable sticky headers, footers, and animations before export.
- Bundle assets into a zip-based format instead of a plain JSON file.
- Add a node grouping pass so sections come into Figma as frames instead of a flat layer list.
- Add an image extraction fallback through extension background fetch for stricter origins.

## File Format

The extension currently exports a JSON document with:

- `format`
- `version`
- `capturedAt`
- `source`
- `settings`
- `document`
- `root`

For best results after upgrading the tool, recapture the page and import the new file instead of reusing an older `.figcap.json` export.

The plugin validates `format === "html-capture-kit"` before importing.
