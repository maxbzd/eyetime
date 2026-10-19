# EyeTime design system

A calm, neutral interface with one warm accent. Light and dark are first-class. Everything lives in `src/ui/`.

## Principles

1. **Quiet by default.** Neutral surfaces, hairline borders, soft shadows (light) or borders only (dark). Colour is reserved for meaning.
2. **One accent.** Ember orange by default for actions and focus; the user may pick a look's own colour, one of ten presets or any custom colour. Accent never carries data. See [THEMES.md](THEMES.md).
3. **Data colours are semantic.** Productive = blue, neutral = warm gray, distracting = red. Always paired with a text label or icon — never colour alone.
4. **Honest empty states.** Zero is zero. Empty states explain what will appear and what to do next.
5. **Comfortable density.** Body 14 px, minimum UI text 12 px, 36 px controls, 8 px grid.
6. **Motion is functional.** 120–400 ms ease-out for state changes; `prefers-reduced-motion` removes all of it.

## Tokens (`src/ui/tokens.css`)

| Group | Tokens |
|---|---|
| Surfaces | `--bg` page · `--surface` card · `--surface-2/3` fills · `--border` hairline · `--border-strong` controls |
| Text | `--text` · `--text-2` · `--text-3` (≥ 4.5:1 on every surface) |
| Accent | `--accent` fill · `--accent-fg` text on fill · `--accent-text` accent as text · `--accent-soft` tint · `--accent-ring` focus glow |
| Semantic | `--productive` / `--neutral` / `--distracting` (+ `-text`, `-soft`) · `--success` · `--warning` |
| Shape | radius 8 / 12 / 16 / 24 · spacing 4-pt scale `--s-1…--s-16` |
| Type | Inter variable (Latin + Cyrillic, bundled) · sizes 12 / 13 / 14 / 16 / 20 / 28 / 40 |

Looks: `<html data-look="…" data-scheme="light|dark">`. All tokens above are *resolved per look* by `src/shared/looks.js` and applied by `theme-init.js` before first paint (no flash); `tokens.css` only holds the Calm fallback. Shape tokens (`--r-*`, density `--d`, `--ctl-h`, card style `--card-*`) are user-tunable. Full description: [THEMES.md](THEMES.md).

### Accessibility guarantees (enforced by `scripts-dev/tests/looks.test.mjs`)

- All text pairs ≥ 4.5:1, large text / UI marks ≥ 3:1 — light **and** dark, for **every** look and accent preset (custom colours are corrected at runtime).
- Chart palette `#2d6cdf / #9a948c / #e0483f` (light) and `#4a89ee / #9a948c / #e8584f` (dark) validated for colour-vision deficiency (adjacent ΔE ≥ 8 under protan/deutan simulation). The gray is deliberately low-chroma; identity is also carried by legend labels, tooltips and a table view.
- Every interactive element is keyboard-reachable with a 2 px accent focus ring; charts' marks are focusable and expose the same tooltip.
- Dialogs use native `<dialog>`; toasts use `role=status`.

## Components (`components.css`)

`.btn` (primary · ghost · soft · danger · sm · lg · icon) · `.card` · `.input/.select/.textarea` · `.switch` · `.check` · `.segmented` · `.chip` (+ `chip-x`) · `.badge` · `.tag-*` (site class) · `.fav` (favicon) · `.list` + `.setting` rows · `.tabs` · `.progress` · `.empty` · `.callout` · `dialog.dialog` · `.toast` · `[data-tip]` tooltips · `.legend` · `.kbd`.

Charts (`charts.js/css`): `stackedColumns`, `heatmap`, `classLegend`, shared tooltip. Marks follow the dataviz spec: bars ≤ 24 px, 4 px rounded data-end, 2 px gaps between segments, hairline grid, labels in text tokens (never series colour).

## Surfaces

| Surface | Job | Layout |
|---|---|---|
| Popup (380 px) | Start focus, classify the current site, glance at today | Focus card → site card → today → capture |
| Home (new tab) | Calm start page; one focus input | Clock → focus card → masonry of cards; customise drawer |
| Insights | Understand the week | KPI row → time chart → sites + highlights → typical day + calendar |
| Settings | Tune defaults | Sticky section nav, long scrolling page, auto-save |
| Onboarding | Set up in < 60 s | 4 steps, one decision per screen |
| Block page | Interrupt gently | Centred; breathing orb or countdown; honest reason |
| Break page | 20-second guided rest | Full-screen ring |

## Voice

Plain, warm, specific. "Take a breath." not "Access denied." Never guilt: no red for "you spent too long". Numbers are shown with units ("1h 25m"), never raw seconds.

## Research notes

The redesign drew on patterns from Opal, Forest, Jomo, Brick and Stoic (focus timers, interventions, weekly stats — via Mobbin), and on settings/analytics pages from Linear, Vercel, Cloudflare, Dropbox Dash, Mintlify and Framer.
