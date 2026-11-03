# From sessions to decisions

## 1. Code (the same day, one row per session)

Fill `observation-sheet.csv`. Everything that can be a number is a number (yes/no, seconds, counts); everything else is a short quote in the person's own words. Do not interpret in the sheet.

Run `node scripts-dev/research/summarize.mjs docs/research/observation-sheet.csv` at any point: it prints the metrics below and which sessions are missing a value.

## 2. The numbers (what "works" means)

| Measure | How | A good result | Act when |
|---|---|---|---|
| **Understood the first screen** | median `first_look_understood_s`; share who said what it is for | median ≤ 15 s; ≥ 80 % right or close | < 60 % right: the first screen does not explain itself |
| **First session unaided** | share with `first_session_started = yes` and `hint_needed_at = none` | ≥ 70 % | < 50 %: the "what is your focus" line is not read as an invitation |
| **Time to first session** | median `first_session_time_s` of those who started | ≤ 45 s | > 90 s |
| **Make it mine** | share who changed something (`found_theme_change`) and got back (`changed_look_back_ok`) | ≥ 70 % and ≥ 90 % of those | undo not found: that is a trust problem, fix first |
| **Settings** | share who found the eye-break setting; median `settings_lost` | ≥ 80 %; ≤ 1 | ≥ 3 lost on average: the settings screen is the problem, not the person |
| **SUS** | the standard formula (below) | ≥ 80 = excellent, 68 = average, < 51 = poor | < 68 |
| **Would keep it** | share `would_keep_installed = yes` and the reasons | ≥ 70 % | the reasons for "no" are the roadmap |

SUS: odd items count (answer − 1), even items count (5 − answer); the sum × 2.5 gives 0–100. `summarize.mjs` does it, and the unit test checks the textbook example.

## 3. What counts as a finding

- **A finding is something seen in ≥ 3 sessions** (≥ 2 if it stopped the person from finishing a task: a *blocker*). One person's opinion is a quote, not a finding.
- Write each finding as **observation → cause (our best guess) → proposed change → how we will check it**. Example: *"5 of 15 looked at the clock and waited; none typed in the line (observation). The line reads as a decoration (cause). Show a pulsing caret for 3 s and the placeholder 'What is your focus?' in full contrast (change). Re-test with 5 people: ≥ 4 type within 15 s (check)."*
- **Rank by what stopped people, not by how many noticed.** Order: blockers (stopped), then trust (could not undo, did not know what happened), then friction (slowed), then taste (liked / disliked). Taste is last: it is the loudest and the least reliable.
- **Separate "they said" from "they did".** If the two disagree, believe the doing.
- **Keep what works.** Write down what delighted people; it is easy to remove by accident while fixing something else.

## 4. The report (two pages)

1. **What we tested** (build, number of sessions, who) — three lines.
2. **The numbers** — the table above, filled.
3. **What works — keep** — each with the evidence (session ids).
4. **What fails — fix, in this order** — the findings with the proposed change and who owns it.
5. **What we do not know yet** — and the cheapest way to find out (a usage query from `docs/MEASUREMENT.md`, five more sessions, a prototype).
6. **Decisions** — one line each, with a date and an owner. Anything without an owner is not a decision.

## 5. After the report

- Put the findings into the issue tracker, each with its evidence and its check.
- Change **one thing at a time per finding**, and re-test the changed part with 5 new people before the release (five people find most of what a given problem has; fifteen are for finding that there are problems).
- Delete the recordings 90 days after the report (the consent says so). Keep the sheet (it has no names).
