# Contributing

Thanks for helping make EyeTime useful for more people!

1. Fork and create a branch.
2. Load the repo folder in `chrome://extensions` (Developer mode → Load unpacked).
3. Run `npm run check` (syntax, manifest validation, unit tests) before opening a PR.
4. Keep the project dependency-free and local-first: no analytics, no remote code.

Good first issues: translations (`_locales/`), new blocking presets, macOS/Linux desktop tracker, Firefox port.

## Testing the UI
`npm run check` covers syntax, manifest, translations and unit tests. For visual checks load the folder as an unpacked extension (see README) — new strings go into `assets/i18n_en.js` (Russian is the source language; `{}` matches a dynamic part), and anything that renders user data must use `textContent` / escaping, never raw `innerHTML`.
