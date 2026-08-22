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
| Gradient Generator | [`/minecraft-gradient-generator/`](minecraft-gradient-generator/) | Turns text into a hex gradient (any number of color stops, RGB/HSL/OKLab blending) with bold/italic/underline/strikethrough/obfuscated formatting, for Minecraft (1.16+). Output as MiniMessage, legacy `§`/`&` per-character color codes, or raw JSON. |
| Animated Gradient Generator | [`/minecraft-animated-gradient-generator/`](minecraft-animated-gradient-generator/) | Turns text into a scanning gradient animation (left-to-right, right-to-left, bouncing, or full-text color cycle) and exports every frame as a ready-to-paste [TAB plugin](https://github.com/NEZNAMY/TAB) `animations.yml` block, with a live animated preview. |

## Project structure

The root of the site holds the shared base that every page depends on:

```
index.html
404.html
robots.txt
sitemap.xml
components/
├── header.html
└── footer.html
css/
└── style.css
js/
├── main.js
└── minecraft-color-utils.js
```

- `components/header.html`, `components/footer.html` — the site-wide header and footer, fetched at runtime via absolute paths (`/components/header.html`) and injected into each page's `<div id="header"></div>` / `<div id="footer"></div>` mount points. The header's "Tools" entry is a dropdown (hover or click on desktop, a tap-open accordion on mobile via Bootstrap's collapse) grouping every tool by category.
- `css/style.css` — design tokens (CSS custom properties, light and dark), base `html`/`body` rules, header/footer/dropdown/theme-toggle styling, the homepage's own sections (hero, principles, tools grid), the 404 page's section, the generic **tool page shell** (intro block, panel, output+copy row, form fields, primary button) shared by every `*-generator/` subpage, and the **Minecraft tool widgets** (color-stop list, gradient preview box) shared by the two `minecraft-*-generator/` pages specifically. A page's own `tool.css` only needs rules genuinely unique to that page — before adding a class to a tool's local `css/tool.css`, check whether it's already 1:1 identical on another tool page; if so it belongs here instead.
- `js/main.js` — component loading, theme sync (with the manual toggle override), active-nav-link detection, the desktop dropdown's hover/click behavior, and the shared `window.ShadeTools` helpers every tool's own script calls into: `copyToClipboard()` (copy text, flash the trigger icon), `renderOutput()` (the placeholder ⇄ result-text swap used by every tool's output box), and `prefersReducedMotion()`. Loaded by every page via `/js/main.js`.
- `js/minecraft-color-utils.js` — RGB/HSL/OKLab color math, gradient sampling, animation-frame generation, Minecraft output-format builders (MiniMessage, legacy `§`/`&`, JSON, BBCode), and the two small UI pieces both Minecraft tools needed identically (`readFormatting()` for the bold/italic/… checkboxes, `createColorList()` for the color-stop-list widget) — all exposed as `window.ShadeToolsMC`. Shared by both `minecraft-gradient-generator/` and `minecraft-animated-gradient-generator/`; loaded via `/js/minecraft-color-utils.js` only by the pages that need it, after `main.js` and before that page's own `generator.js`.
- `404.html` — a styled not-found page using the same header/footer/design tokens as the rest of the site, marked `noindex` and linking back to the homepage and every tool. Most static hosts (GitHub Pages, Netlify, Vercel, etc.) pick this up automatically for unmatched routes; check your specific host's docs if it doesn't.
- `robots.txt`, `sitemap.xml` — allow all crawlers and point them at the sitemap, which lists the homepage and every tool page with its canonical URL.

Each tool subpage links this shared base with absolute paths (`/css/style.css`, `/js/main.js`) and adds only what's specific to that tool:

```
password-generator/
├── index.html
├── css/
│   └── tool.css      # panel, output, strength meter, etc. — nothing shared
└── js/
    └── generator.js   # the generator logic itself, no component loading
```

`index.html` in a subpage links the shared stylesheet first, then its own local one (`/css/style.css` before `css/tool.css`), and likewise `/js/main.js` before its own script — so shared tokens and behavior are in place before the tool-specific styles and logic layer on top. A rebrand (new colors, new fonts, header/footer changes) means editing the two root files once; it doesn't need to touch every tool. When adding a new tool, copy the `password-generator/` shape: an `index.html` linking the shared base plus a small local `css/` and `js/` for whatever that tool actually needs. When adding a *Minecraft* tool specifically, also link `/js/minecraft-color-utils.js` and reuse its `createColorList()`/`readFormatting()` rather than re-implementing them — that pairing is what keeps `minecraft-gradient-generator/` and `minecraft-animated-gradient-generator/` down to only their own logic (frame generation, output-format dispatch) instead of re-duplicating the color-stop-list UI each time.

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

- Supports any number of color stops (2+), evenly distributed along the text, with a choice of three interpolation modes: RGB (linear, can look muddy between very different hues), HSL (keeps hues vivid via shortest-path hue interpolation), and OKLab (perceptually uniform — equal steps look like equal steps to the eye). The color math is ported from [birdflop/web](https://github.com/birdflop/web)'s `@birdflop/rgbirdflop` package, simplified from its class-per-color-space design into plain functions.
- Formatting (bold/italic/underline/strikethrough/obfuscated) applies to the whole string, not per-character selection — a deliberate simplification of birdflop's per-selection rich-text formatting, which needs a full selection-tracking text editor to do properly.
- In MiniMessage output, RGB mode emits a compact `<gradient:#aaa:#bbb>text</gradient>` tag, since Adventure's own gradient tag interpolates in plain RGB and matches exactly. HSL/OKLab modes emit an explicit `<#RRGGBB>` color before each character instead, since Adventure has no equivalent for those color spaces.
- Seven output formats total, matching birdflop/web's own format list: MiniMessage, a standalone `<#rrggbb>` shorthand tag, legacy `§x§r§r§g§g§b§b` (split per digit), legacy `&x&r&r&g&g&b&b` (split per digit), a flatter `&#rrggbb` (no digit splitting, for Discord bots and non-Adventure plugins), raw JSON (Minecraft text component), and BBCode (`[COLOR=#rrggbb]…[/COLOR]`, for forum signatures). All the hex-code-per-character formats insert an explicit color before every non-space character; a color code resets formatting state in legacy text, so format codes are reinserted after every color code rather than once at the start. BBCode has no obfuscated-text equivalent, so that toggle has no effect on it.
- The obfuscated-text preview continuously cycles random glyphs (skipped under `prefers-reduced-motion`), echoing how Minecraft actually renders obfuscated text in-game.

## Notes on the animated gradient generator

- Ported from birdflop/web's `AnimTABUtils.generateAnimTABFrames`, simplified the same way the static gradient generator is: no rich per-selection formatting and no custom (non-evenly-spaced) color-stop positions, and MiniMessage output always emits an explicit color before each character rather than porting the color-stop-shifting math behind birdflop's compact animated `<gradient>` output.
- Four scan styles: **left to right** and **right to left** sweep the gradient across the text once; **bouncing** plays that sweep forward then in reverse; **full-text cycle** recolors the whole string as one solid, shifting color instead of a per-character gradient.
- Each animation frame samples the gradient at a step offset by the frame index and the character's position, reflected through a triangle-wave function (`easedStep` in `js/minecraft-color-utils.js`) so the scan direction reverses smoothly at the text's ends instead of jumping or clamping.
- **Color band size** groups that many consecutive characters under one shared color per frame — set above 1, the animation reads as wider bands sweeping across the text rather than a per-letter shimmer, which holds up better on longer strings.
- The output is a complete [TAB plugin](https://github.com/NEZNAMY/TAB) `animations.yml` entry: `<name>:` header, `change-interval:` (in game ticks, 20 = 1 second) taken from the speed field, and a `texts:` list with one quoted line per generated frame — matching TAB's own animation format exactly, so the block can be pasted in as-is. The same seven color-code formats as the static gradient generator are available per frame; JSON frames use compact (non-pretty-printed) JSON so the embedded newlines a pretty-printed component would have don't break the YAML list structure.
- The live preview animates at the same interval as the exported `change-interval` (converted from ticks to milliseconds), so what's on screen matches the timing of the exported frames. It freezes on the first frame under `prefers-reduced-motion`.

