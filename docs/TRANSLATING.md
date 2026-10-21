# Translating EyeTime

EyeTime speaks English and Russian (written by the author) and Spanish, German, French and Portuguese (machine-translated, then reviewed). A wrong or clumsy phrase in any language is a bug — fixing one is the easiest first contribution.

## Fix a translation

1. Open `src/shared/locales/<lang>.js` (`es`, `de`, `fr`, `pt`, `ru`). Every line is `'area.key': 'text'`.
2. Change the text. Do not touch the key (left of the colon).
3. Keep `{placeholders}` exactly as they are — `{n}`, `{time}`, `{host}` … are filled in by the code.
4. Run `npm run check`. It fails if a key is missing, a placeholder differs, or a key is unknown.
5. Open a pull request (or an issue with the line and your suggestion — that is welcome too).

## Rules that keep the UI intact

- **Plural forms.** Values written as `{ one: …, other: … }` are chosen by the language's CLDR plural rules (`Intl.PluralRules`). Provide every category your language uses (Russian: one, few, many, other; Spanish, French, Portuguese: one, many, other; German: one, other).
- **Quick-add syntax stays as is.** The task field understands English and Russian words (`daily`, `weekdays`, `tomorrow`, `завтра`, `!`, `~45m`, `14:30`). Examples inside hints keep those tokens; translate only the words around them.
- **Length matters.** Chips, tabs and buttons are narrow. Prefer short words; the end-to-end test `scripts-dev/e2e/upgrade.cjs` opens every page at 400 px width, 125 % zoom and with very long names in every language and fails on horizontal scrolling.
- **Units.** `unit.h`, `unit.m`, `unit.s` are glued to numbers (`1h 5min`). Keep them short, no trailing dot.
- **Quotes and punctuation** follow the language (German „…“, French « … » with no-break spaces).

## Add a new language

1. Copy `src/shared/locales/en.js` to `xx.js`, rename the export (`export const xx = {…}`), translate the values.
2. Register it in `src/shared/locales/index.js` — add it to `LOCALES` and to `LANGUAGES` (the name written in that language).
3. Copy `_locales/en/messages.json` to `_locales/xx/messages.json` (Chrome uses `pt_BR`, `zh_CN` style names for regional variants) and translate the store name, description and the two overlay strings.
4. Add `'xx'` to the `narrow` loop in `scripts-dev/e2e/upgrade.cjs`.
5. `npm run check && npm test`, then look at Home, the popup, Settings and Insights in your language.

The date and number formats come from `Intl` for the chosen language, so only strings that exist as keys need translating.
