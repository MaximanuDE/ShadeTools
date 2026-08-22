# ShadeTools

Small, focused browser tools that run entirely on the client. No accounts, no servers, no data leaving the browser.

## Live tools

Grouped into categories, shown the same way in the header's Tools dropdown and on the homepage.

**General**

| Tool | Path | Description |
|---|---|---|
| Password Generator | [`/password-generator/`](password-generator/) | Generates random passwords or word-based passphrases using the browser's cryptographic random source (`crypto.getRandomValues`). Includes an entropy-based strength estimate and a session-only history. |
| Small Caps Generator | [`/small-caps-generator/`](small-caps-generator/) | Converts typed text into small-capital Unicode look-alike characters, live as you type. |

**Minecraft**

| Tool | Path | Description |
|---|---|---|
| Gradient Generator | [`/minecraft-gradient-generator/`](minecraft-gradient-generator/) | Turns text into a two-color hex gradient for Minecraft (1.16+), output as MiniMessage and as legacy `§`/`&` per-character color codes. |

## Project structure

The root of the site holds the shared base that every page depends on:

```
index.html
components/
├── header.html
└── footer.html
css/
└── style.css
js/
└── main.js
```

- `components/header.html`, `components/footer.html` — the site-wide header and footer, fetched at runtime via absolute paths (`/components/header.html`) and injected into each page's `<div id="header"></div>` / `<div id="footer"></div>` mount points. The header's "Tools" entry is a dropdown (hover or click on desktop, a tap-open accordion on mobile via Bootstrap's collapse) grouping every tool by category.
- `css/style.css` — design tokens (CSS custom properties, light and dark), base `html`/`body` rules, header/footer/dropdown styling, the homepage's own sections (hero, principles, tools grid), and the generic **tool page shell** (intro block, panel, output+copy row, form fields, primary button) shared by every `*-generator/` subpage.
- `js/main.js` — component loading, theme sync, active-nav-link detection, the desktop dropdown's hover/click behavior, and `window.ShadeTools.copyToClipboard()` — a small shared helper (copy text, flash the trigger icon) every tool's own script calls into. Loaded by every page via `/js/main.js`.

Each tool subpage links this shared base with absolute paths (`/css/style.css`, `/js/main.js`) and adds only what's specific to that tool:

```
password-generator/
├── index.html
├── css/
│   └── tool.css      # panel, output, strength meter, etc. — nothing shared
└── js/
    └── generator.js   # the generator logic itself, no component loading
```

`index.html` in a subpage links the shared stylesheet first, then its own local one (`/css/style.css` before `css/tool.css`), and likewise `/js/main.js` before its own script — so shared tokens and behavior are in place before the tool-specific styles and logic layer on top. A rebrand (new colors, new fonts, header/footer changes) means editing the two root files once; it doesn't need to touch every tool. When adding a new tool, copy the `password-generator/` shape: an `index.html` linking the shared base plus a small local `css/` and `js/` for whatever that tool actually needs.

## Design system

Shared across all pages via CSS custom properties defined in each page's `css/style.css`:

- **Colors:** a violet (`--st-accent`) / cyan (`--st-accent-2`) duotone on a cool neutral gray background, with separate light and dark value sets under `[data-bs-theme="dark"]`.
- **Type:** [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) for UI text, [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) for anything data-like (passwords, entropy values, the eyebrow labels).
- **Framework:** [Bootstrap 5.3.8](https://getbootstrap.com/) + [Bootstrap Icons 1.13.1](https://icons.getbootstrap.com/), loaded from jsDelivr CDN. Custom styles in `style.css` sit on top of Bootstrap's defaults rather than overriding them wholesale.

## Dark / light mode

Theme is **not** a manual toggle — it follows the operating system automatically:

```js
const mq = window.matchMedia("(prefers-color-scheme: dark)");
document.documentElement.setAttribute("data-bs-theme", mq.matches ? "dark" : "light");
mq.addEventListener("change", (e) => {
  document.documentElement.setAttribute("data-bs-theme", e.matches ? "dark" : "light");
});
```

Because it listens for the `change` event on the media query, switching the system theme updates the page immediately, with no reload. This logic lives at the top of every page's `main.js`.

## Running locally

These are static files with no build step. Because `main.js` loads `components/header.html` and `components/footer.html` via `fetch()`, opening `index.html` directly from the filesystem (`file://`) will fail in most browsers due to CORS restrictions on local file access. Serve the folder over HTTP instead, for example:

```bash
# from the ShadeTools/ folder
npx serve .
# then open the URL it prints (typically http://localhost:3000/)
```

Any other static file server works too (e.g. the "Live Server" extension in VS Code).

## Notes on the password generator

- Randomness is generated with `crypto.getRandomValues`, not `Math.random`.
- Passphrase words come from a fixed, local list of 256 common English words (`WORDLIST` in `password-generator/js/generator.js`) — nothing is fetched from an external dictionary API. 256 words means exactly 8 bits of entropy per word.
- The entropy estimate only counts genuinely random choices (character pool size × length, or word count × word-list size). Fixed choices like the separator or capitalization style are not counted toward it, so the number shown is a conservative estimate rather than an inflated one.
- History is kept in memory only (a plain JS array), not in `localStorage` or `sessionStorage`. It's cleared on reload by design — generated passwords are not meant to persist in browser storage.

## Notes on the small caps generator

- The character map only covers letters that have a dedicated small-capital glyph in Unicode (Latin Extended and IPA Extensions blocks). `x` has no such glyph and passes through unchanged; `q` and `s` use the small-capital letters from Latin Extended-D.
- Everything else (digits, punctuation, spaces, non-Latin scripts) passes through unchanged.

## Notes on the Minecraft gradient generator

- The MiniMessage output (`<gradient:#aaa:#bbb>text</gradient>`) is the simplest to use directly in Paper/Adventure-based plugin configs, since the client resolves the gradient itself.
- The legacy outputs insert an explicit hex color code before every non-space character (`§x§R§R§G§G§B§B` / `&x&R&R&G&G&B&B`), which is what Minecraft Java Edition 1.16+ expects for per-character RGB color in raw/legacy text.

