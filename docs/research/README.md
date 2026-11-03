# Watching people use EyeTime

Numbers (see `../MEASUREMENT.md`) say **where** people stop. Only watching says **why**. This folder is everything needed to run 15–20 short sessions and turn them into decisions, in about two weeks with two people.

**Question for this round:** *does the new Home (Today) do what we think it does for someone who has never seen it?* We believe: a new person understands within seconds what to do, starts a first focus session without help, finds the look beautiful and calm rather than empty, and can change what they dislike without getting lost in settings.

| File | What it is |
|---|---|
| [`protocol.md`](protocol.md) | The session, minute by minute, with the words the moderator says and the tasks |
| [`consent.md`](consent.md) | What people are told and sign before they are recorded (short, plain) |
| [`screener.md`](screener.md) | Who to invite, the questions that select them, how to recruit |
| [`observation-sheet.csv`](observation-sheet.csv) | One row per session: the same columns every time, so sessions can be compared |
| [`analysis.md`](analysis.md) | How the sessions become decisions: coding, the rules for "a finding", the report template |

Tools (in `scripts-dev/research/`):

- `node scripts-dev/research/session.cjs --id P07` opens a **clean Chromium with the build of EyeTime installed, nothing configured, the language you choose**, and (with `--record`) records the screen of the browser to `research-out/P07/`. A fresh profile for every participant means every participant is a first-time user. Use it when the person sits at your computer or shares a screen.
- `node scripts-dev/research/summarize.mjs docs/research/observation-sheet.csv` turns the filled sheet into the numbers: how many started a first session unaided, how long it took, the SUS score, where people got stuck.

## The plan in six steps

1. **Fix the build.** Test the build you intend to release (`npm run build`, the zip). Do not change it between sessions: sessions are compared with each other.
2. **Recruit 18** (to have 15 whole sessions): `screener.md`. Pay or give something real (a 20–30 minute session, a gift card or a donation to a charity of their choice). Aim for the mix described there, not for friends.
3. **Pilot with 2 people** and fix only the protocol (never the product). Throw the pilots away unless nothing changed.
4. **Run 15–20 sessions**, 25 minutes each, two people per session (one asks, one writes). Do not help. Do not explain the product. Record, with consent.
5. **Code the sessions the same day**: fill `observation-sheet.csv` while the memory is fresh; the recording is for checking, not for the first pass.
6. **Decide** with `analysis.md`: a finding needs to be seen in ≥ 3 sessions (≥ 2 for a blocker). Everything else is a note. The report is two pages: what works (keep), what fails (fix, in this order), what to measure next.

## Rules that make the results worth having

- **First-time users only.** Someone who has seen EyeTime is a different test.
- **Never lead.** "What would you do here?" never "Do you see the button on the right?".
- **Silence is data.** Count to ten before helping. A person who is stuck for a minute has found a problem; helping hides it.
- **Watch what they do, not what they say they like.** "It's nice" is politeness; reaching for the first session without being asked is the answer.
- **A session is not a verdict on the person.** Nobody "fails"; the product does.
- **Privacy:** recordings are kept on one encrypted disk, shown only to the team, deleted 90 days after the report. Names are never written on the sheet: P01, P02 …
