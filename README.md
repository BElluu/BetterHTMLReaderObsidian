# BetterHTMLReader

An [Obsidian](https://obsidian.md) plugin that displays HTML properly, with its CSS and JavaScript, instead of showing nothing or raw markup.

## Features

- **Open `.html` / `.htm` files** directly in Obsidian as fully rendered pages. The view refreshes when the file changes.
- **Inline HTML in notes** with a `htmlrender` code block. The block resizes to fit its content.
- **Local resources**: relative `<link rel="stylesheet">`, `<script src>` and images are resolved from your vault, relative to the HTML file or note.
- **Remote resources** (CDNs, web APIs) work as in a normal browser.
- `#anchor` links inside the page work.

### Example

````markdown
```htmlrender
<style>button { padding: 8px 16px; }</style>
<button onclick="this.textContent = 'Clicked!'">Click me</button>
```
````

> The opening ```` ```htmlrender ```` and the closing ```` ``` ```` must each be on their own line, with the HTML on the lines between them. Putting everything on one line is not a valid code block and will not render.

## Installation

### From the community plugin directory

Settings → Community plugins → Browse → search for **BetterHTMLReader**.

### Manually

1. Download `main.js`, `manifest.json` and `styles.css` from the latest [release](https://github.com/BElluu/BetterHTMLReaderObsidian/releases).
2. Put them in `<vault>/.obsidian/plugins/better-html-reader/`.
3. Reload Obsidian and enable the plugin in Settings → Community plugins.

## Security

HTML is rendered in an `<iframe>` with `sandbox="allow-scripts allow-popups allow-forms allow-downloads"` and **without** `allow-same-origin`. Scripts in the page run, but they cannot access Obsidian's API, your vault, or other notes.

Additional safeguards:

- Only local `.css` and `.js` files outside hidden folders (e.g. `.obsidian`) are inlined, so a page cannot pull your notes or plugin configs into its sandbox.
- A Content-Security-Policy blocks `fetch`/XHR to local vault resources; requests to the web are allowed.
- Pop-up dialogs (`alert`, `confirm`) are disabled.

What the plugin cannot prevent: an HTML page can still load remote content (trackers, remote scripts) and show its own UI. **Only open HTML from sources you trust.**

## Limitations

- Scripts cannot use `localStorage`, cookies or same-origin APIs (a consequence of the sandbox).
- `fetch` of local vault files from within the page is blocked.
- Embedding with `![[file.html]]` is not supported; use a `htmlrender` block.
- `.html` files are read-only in Obsidian; edit them in an external editor.

## Development

No build step. Copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/better-html-reader/` and reload.

## License

[MIT](LICENSE)
