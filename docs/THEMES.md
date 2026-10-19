# Looks & customisation

Every person can make EyeTime theirs. **Settings → Appearance** (and the *Customize* drawer on Home) expose:

| Control | Options |
|---|---|
| **Look** | Calm · Paper · Midnight · Terminal · Sakura · Forest · Aurora · Mono · Sunset · Nord · Ocean — each has a light *and* a dark scheme and its own character (fonts, corner radii, card style, border weight, shadows, page backdrop). The gallery shows live miniatures built from the real components, split light/dark. |
| **Colour mode** | System · Light · Dark · **Schedule** (e.g. dark from 20:00, light from 07:00) |
| **Accent** | the look's own colour, ten presets, or **any colour** (picker / hex). Text contrast is corrected automatically. |
| **Type & shape** | Font (Inter, Manrope, Nunito, Source Serif, JetBrains Mono, System) · interface size 90–125 % · corners (sharp → pill) · density (compact / comfortable / spacious) · card style (solid / glass / outline / flat) · reduce motion |
| **Home** | 17 backdrops (look-derived mesh, aurora, night sky, waves, grain, dots, grid, living gradient, solid colour, your photo …), 7 clock styles, 3 layouts (centred / split / minimal), card order |
| **Advanced** | custom CSS, copy / import a look as JSON, reset |

## How it works

A look is a *small palette* (`bg`, `surface`, `text`, `accent` for each scheme) plus a *character*. Everything else — borders, tints, `-text` / `-soft` variants, shadows, chart-safe semantic colours — is **derived** in `src/shared/looks.js` (`resolveVars`), with WCAG contrast enforced by `src/shared/color.js` (`ensureContrast`, `readableFill`). That is why *any* accent on *any* look stays readable.

`scripts-dev/tests/looks.test.mjs` checks, for every look × scheme × accent preset (and a spread of custom colours): body text ≥ 4.5:1, secondary/tertiary text, accent as text, text on accent fills, semantic tags, and that each look is visibly distinct.

Rendering path:

1. Settings page / any settings change → `buildCache(settings.appearance)` → resolved CSS variables for **both** schemes → `localStorage['et-look']`.
2. `src/ui/theme-init.js` (classic script in every page `<head>`) reads the cache, picks the scheme (system / schedule / explicit) and sets the variables and `data-look`, `data-scheme`, `data-motion`, `data-density` before first paint — no flash. A schedule re-evaluates every minute.
3. Components only consume tokens (`--bg`, `--r-md`, `--font`, `--card-bg` …), so a new look never needs component CSS.

Data colours in charts (productive / neutral / distracting) are deliberately **not** themed per look beyond a tonal shift: they are validated for colour-vision deficiency and must keep their meaning.

## Safety of shared looks and custom CSS

- `sanitizeAppearance()` accepts only known keys and values; unknown input is dropped.
- Custom CSS may not contain `@import`, `url(http…)`, `expression(` or similar remote/executable constructs; it is limited to 20 KB and applied as a `<style>` element (no scripts are possible in extension CSS).
- Copying a look never includes data — only the appearance options.

## Adding a look

Add an entry to `LOOKS` in `src/shared/looks.js` (palette for `light` and `dark`, plus character), add `look.<id>` / `lookd.<id>` to the locale files, run `npm test` — the contrast suite covers it automatically.
